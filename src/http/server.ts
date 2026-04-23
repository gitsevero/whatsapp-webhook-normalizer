import 'dotenv/config';
import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import { randomUUID } from 'node:crypto';
import { registry } from '../adapters';
import {
  MalformedWebhookError,
  UnknownProviderError,
  SignatureVerificationError,
} from '../core/errors';
import {
  messageRepository,
  deadLetterRepository,
} from '../db/repositories';
import { logger } from '../observability/logger';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      rawBody?: Buffer;
      requestId?: string;
      startedAt?: number;
    }
  }
}

const app = express();

app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as Request).rawBody = buf;
    },
  }),
);

app.use((req, _res, next) => {
  req.requestId = req.header('x-request-id') ?? randomUUID();
  req.startedAt = Date.now();
  next();
});

app.post('/webhooks/:provider', async (req, res) => {
  const { provider } = req.params;

  const adapter = registry.get(provider);
  const message = adapter.normalize(req.body);
  await messageRepository.save(message);

  logger.info('webhook ingested', {
    requestId: req.requestId,
    providerId: provider,
    externalMessageId: message.externalMessageId,
    status: 200,
    durationMs: Date.now() - (req.startedAt ?? Date.now()),
  });

  res.status(200).json({
    ok: true,
    externalMessageId: message.externalMessageId,
  });
});

function mapErrorToStatus(err: Error): number {
  if (err instanceof MalformedWebhookError) return 400;
  if (err instanceof UnknownProviderError) return 404;
  if (err instanceof SignatureVerificationError) return 401;
  return 500;
}

function extractProviderFromPath(url: string): string | null {
  return url.match(/^\/webhooks\/([^/?]+)/)?.[1] ?? null;
}

app.use(
  async (err: Error, req: Request, res: Response, _next: NextFunction) => {
    const status = mapErrorToStatus(err);
    const providerId = extractProviderFromPath(req.url);

    await deadLetterRepository
      .save(providerId, req.body, `${err.name}: ${err.message}`)
      .catch((dbErr) =>
        logger.error('failed to persist dead_letter', {
          requestId: req.requestId,
          error: String(dbErr),
        }),
      );

    logger.error('webhook failed', {
      requestId: req.requestId,
      providerId,
      status,
      durationMs: Date.now() - (req.startedAt ?? Date.now()),
      error: err.name,
      message: err.message,
    });

    res.status(status).json({
      ok: false,
      error: err.name,
      message: err.message,
    });
  },
);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  logger.info('server started', {
    port,
    adapters: ['meta', 'evolution', 'zapi'],
  });
});
