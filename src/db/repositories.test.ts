import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { messageRepository, deadLetterRepository } from './repositories';
import { pool } from './client';
import type { NormalizedMessage } from '../core/types';

// Testes de integração — requerem DATABASE_URL válido (Supabase).
// Pulados se DATABASE_URL não estiver setado.
const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

const TEST_RUN_ID = `test-${randomUUID()}`;

function makeMessage(overrides: Partial<NormalizedMessage> = {}): NormalizedMessage {
  return {
    providerId: 'meta',
    externalMessageId: `${TEST_RUN_ID}-${Date.now()}-${Math.random()}`,
    from: { phone: '5511988888888', name: 'Test' },
    to: { phone: '5511999999999' },
    text: 'test message',
    timestamp: new Date(),
    raw: { test: true },
    ...overrides,
  };
}

describeDb('messageRepository (integration)', () => {
  beforeAll(async () => {
    // Garante que o provider 'meta' existe (pré-seed via migration 001)
    await pool.query(
      `INSERT INTO providers (id, name) VALUES ('meta', 'Meta Cloud API') ON CONFLICT DO NOTHING`,
    );
  });

  afterAll(async () => {
    // Limpa mensagens de teste
    await pool.query(`DELETE FROM messages WHERE external_id LIKE $1`, [
      `${TEST_RUN_ID}%`,
    ]);
    await pool.query(`DELETE FROM dead_letters WHERE error LIKE $1`, [
      `${TEST_RUN_ID}%`,
    ]);
    await pool.end();
  });

  it('save persiste a mensagem normalizada', async () => {
    const msg = makeMessage();
    await messageRepository.save(msg);

    const result = await pool.query(
      `SELECT provider_id, external_id, from_phone, text FROM messages WHERE external_id = $1`,
      [msg.externalMessageId],
    );

    expect(result.rowCount).toBe(1);
    expect(result.rows[0].provider_id).toBe('meta');
    expect(result.rows[0].from_phone).toBe('5511988888888');
    expect(result.rows[0].text).toBe('test message');
  });

  it('idempotência — dois saves do mesmo external_id resultam em 1 linha', async () => {
    const msg = makeMessage();

    await messageRepository.save(msg);
    await messageRepository.save(msg);

    const result = await pool.query(
      `SELECT COUNT(*)::int AS c FROM messages WHERE external_id = $1`,
      [msg.externalMessageId],
    );
    expect(result.rows[0].c).toBe(1);
  });

  it('updateIntent atualiza a coluna intent', async () => {
    const msg = makeMessage();
    await messageRepository.save(msg);

    await messageRepository.updateIntent(
      msg.providerId,
      msg.externalMessageId,
      'asking_price',
    );

    const result = await pool.query(
      `SELECT intent FROM messages WHERE external_id = $1`,
      [msg.externalMessageId],
    );
    expect(result.rows[0].intent).toBe('asking_price');
  });

  it('deadLetterRepository aceita provider_id nulo', async () => {
    await deadLetterRepository.save(
      null,
      { bad: true },
      `${TEST_RUN_ID}: unknown provider case`,
    );

    const result = await pool.query(
      `SELECT provider_id FROM dead_letters WHERE error = $1`,
      [`${TEST_RUN_ID}: unknown provider case`],
    );
    expect(result.rowCount).toBe(1);
    expect(result.rows[0].provider_id).toBeNull();
  });

  it('deadLetterRepository aceita provider_id não cadastrado (sem FK)', async () => {
    await deadLetterRepository.save(
      'telegram',
      { bad: true },
      `${TEST_RUN_ID}: telegram case`,
    );

    const result = await pool.query(
      `SELECT provider_id FROM dead_letters WHERE error = $1`,
      [`${TEST_RUN_ID}: telegram case`],
    );
    expect(result.rows[0].provider_id).toBe('telegram');
  });
});
