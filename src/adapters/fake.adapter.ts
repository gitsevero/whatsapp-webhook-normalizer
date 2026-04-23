import { z } from 'zod';
import type { ProviderAdapter, NormalizedMessage } from '../core/types';
import { MalformedWebhookError } from '../core/errors';

const FakePayload = z.object({
  id: z.string(),
  sender: z.string(),
  senderName: z.string().optional(),
  message: z.string(),
  sentAt: z.number(),
});

export const fakeAdapter: ProviderAdapter = {
  id: 'fake',

  normalize(payload: unknown): NormalizedMessage {
    const parsed = FakePayload.safeParse(payload);
    if (!parsed.success) throw new MalformedWebhookError('fake', parsed.error);

    const p = parsed.data;
    return {
      providerId: 'fake',
      externalMessageId: p.id,
      from: { phone: p.sender, name: p.senderName },
      text: p.message,
      timestamp: new Date(p.sentAt * 1000),
      raw: payload,
    };
  },
};
