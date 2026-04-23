import { z } from 'zod';
import type { ProviderAdapter, NormalizedMessage } from '../core/types';
import { MalformedWebhookError } from '../core/errors';

const EvolutionPayload = z.object({
  data: z.object({
    key: z.object({
      remoteJid: z.string(),
      id: z.string(),
    }),
    pushName: z.string().optional(),
    message: z.object({
      conversation: z.string().optional(),
      extendedTextMessage: z.object({ text: z.string() }).optional(),
    }),
    messageTimestamp: z.number(),
  }),
  destination: z.string().optional(),
});

const stripJid = (jid: string): string => jid.split('@')[0] ?? jid;

export const evolutionAdapter: ProviderAdapter = {
  id: 'evolution',

  normalize(payload: unknown): NormalizedMessage {
    const parsed = EvolutionPayload.safeParse(payload);
    if (!parsed.success) {
      throw new MalformedWebhookError('evolution', parsed.error);
    }

    const { data, destination } = parsed.data;
    const text =
      data.message.conversation ?? data.message.extendedTextMessage?.text;

    if (!text) {
      throw new MalformedWebhookError(
        'evolution',
        'No text found in message (neither conversation nor extendedTextMessage)',
      );
    }

    return {
      providerId: 'evolution',
      externalMessageId: data.key.id,
      from: {
        phone: stripJid(data.key.remoteJid),
        name: data.pushName,
      },
      to: destination ? { phone: stripJid(destination) } : undefined,
      text,
      timestamp: new Date(data.messageTimestamp * 1000),
      raw: payload,
    };
  },
};
