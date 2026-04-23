import { z } from 'zod';
import type { ProviderAdapter, NormalizedMessage } from '../core/types';
import { MalformedWebhookError } from '../core/errors';

const MetaPayload = z.object({
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          value: z.object({
            metadata: z
              .object({ display_phone_number: z.string() })
              .optional(),
            contacts: z
              .array(
                z.object({
                  profile: z.object({ name: z.string() }).optional(),
                  wa_id: z.string(),
                }),
              )
              .optional(),
            messages: z
              .array(
                z.object({
                  from: z.string(),
                  id: z.string(),
                  timestamp: z.string(),
                  type: z.string(),
                  text: z.object({ body: z.string() }).optional(),
                }),
              )
              .optional(),
          }),
        }),
      ),
    }),
  ),
});

export const metaAdapter: ProviderAdapter = {
  id: 'meta',

  normalize(payload: unknown): NormalizedMessage {
    const parsed = MetaPayload.safeParse(payload);
    if (!parsed.success) {
      throw new MalformedWebhookError('meta', parsed.error);
    }

    const change = parsed.data.entry[0]?.changes[0];
    const message = change?.value.messages?.[0];

    if (!message || message.type !== 'text' || !message.text) {
      throw new MalformedWebhookError(
        'meta',
        'No text message found in payload (may be a status update or unsupported message type)',
      );
    }

    const contact = change.value.contacts?.[0];

    return {
      providerId: 'meta',
      externalMessageId: message.id,
      from: {
        phone: message.from,
        name: contact?.profile?.name,
      },
      to: change.value.metadata?.display_phone_number
        ? { phone: change.value.metadata.display_phone_number }
        : undefined,
      text: message.text.body,
      timestamp: new Date(Number(message.timestamp) * 1000),
      raw: payload,
    };
  },
};
