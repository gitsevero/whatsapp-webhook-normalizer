import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { SignatureVerificationError } from '../core/errors';

const SIGNATURE_PREFIX = 'sha256=';

export function verifyMetaSignature(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const secret = process.env.META_APP_SECRET;

  // Sem secret configurado → skip (modo dev). README documenta que produção
  // deve setar META_APP_SECRET.
  if (!secret) {
    return next();
  }

  const header = req.header('x-hub-signature-256');
  if (!header || !header.startsWith(SIGNATURE_PREFIX) || !req.rawBody) {
    return next(new SignatureVerificationError('meta'));
  }

  const received = header.slice(SIGNATURE_PREFIX.length);
  const expected = createHmac('sha256', secret)
    .update(req.rawBody)
    .digest('hex');

  if (
    received.length !== expected.length ||
    !timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'))
  ) {
    return next(new SignatureVerificationError('meta'));
  }

  next();
}
