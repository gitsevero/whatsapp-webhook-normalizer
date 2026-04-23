import type { NormalizedMessage } from '../core/types';
import { pool } from './client';

export const messageRepository = {
  async save(message: NormalizedMessage): Promise<void> {
    await pool.query(
      `INSERT INTO messages (
        provider_id, external_id, from_phone, from_name, to_phone,
        text, sent_at, raw
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (provider_id, external_id) DO NOTHING`,
      [
        message.providerId,
        message.externalMessageId,
        message.from.phone,
        message.from.name ?? null,
        message.to?.phone ?? null,
        message.text,
        message.timestamp,
        message.raw,
      ],
    );
  },

  async updateIntent(
    providerId: string,
    externalMessageId: string,
    intent: string,
  ): Promise<void> {
    await pool.query(
      `UPDATE messages SET intent = $1
       WHERE provider_id = $2 AND external_id = $3`,
      [intent, providerId, externalMessageId],
    );
  },
};

export const deadLetterRepository = {
  async save(
    providerId: string | null,
    payload: unknown,
    error: string,
  ): Promise<void> {
    await pool.query(
      `INSERT INTO dead_letters (provider_id, payload, error)
       VALUES ($1, $2, $3)`,
      [providerId, payload, error],
    );
  },
};
