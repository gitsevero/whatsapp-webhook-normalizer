import { z } from 'zod';
import type { ProviderAdapter, NormalizedMessage } from '../core/types';
import { MalformedWebhookError } from '../core/errors';

// "momment" segue o typo original da documentação oficial da Z-API.
const ZApiPayload = z.object({
  messageId: z.string(),
  phone: z.string(),
  momment: z.number(),
  senderName: z.string().optional(),
  chatName: z.string().optional(),
  text: z.object({ message: z.string() }),
});

export const zapiAdapter: ProviderAdapter = {
  id: 'zapi',

  normalize(payload: unknown): NormalizedMessage {
    const parsed = ZApiPayload.safeParse(payload);
    if (!parsed.success) {
      throw new MalformedWebhookError('zapi', parsed.error);
    }

    const p = parsed.data;

    return {
      providerId: 'zapi',
      externalMessageId: p.messageId,
      from: {
        phone: p.phone,
        name: p.senderName ?? p.chatName,
      },
      text: p.text.message,
      timestamp: new Date(p.momment),
      raw: payload,
    };
  },
};
