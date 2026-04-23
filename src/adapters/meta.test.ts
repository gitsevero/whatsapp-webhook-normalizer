import { describe, it, expect } from 'vitest';
import { metaAdapter } from './meta';
import { MalformedWebhookError } from '../core/errors';

// Payload da seção 5 do teste.md
const validPayload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
      changes: [
        {
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '5511999999999',
              phone_number_id: 'PHONE_NUMBER_ID',
            },
            contacts: [
              {
                profile: { name: 'João Silva' },
                wa_id: '5511988888888',
              },
            ],
            messages: [
              {
                from: '5511988888888',
                id: 'wamid.HBgNNTUxMTk5OTk5OTk5ORUCABIYFjNFQjBCNkU3',
                timestamp: '1677234567',
                type: 'text',
                text: {
                  body: 'Olá, gostaria de saber mais sobre o produto',
                },
              },
            ],
          },
          field: 'messages',
        },
      ],
    },
  ],
};

describe('metaAdapter', () => {
  it('normaliza o payload de exemplo do teste.md', () => {
    const result = metaAdapter.normalize(validPayload);

    expect(result.providerId).toBe('meta');
    expect(result.externalMessageId).toBe(
      'wamid.HBgNNTUxMTk5OTk5OTk5ORUCABIYFjNFQjBCNkU3',
    );
    expect(result.from.phone).toBe('5511988888888');
    expect(result.from.name).toBe('João Silva');
    expect(result.to?.phone).toBe('5511999999999');
    expect(result.text).toBe('Olá, gostaria de saber mais sobre o produto');
    expect(result.timestamp).toEqual(new Date(1677234567 * 1000));
    expect(result.raw).toBe(validPayload);
  });

  it('trata contato ausente (from.name undefined)', () => {
    const payload = structuredClone(validPayload);
    payload.entry[0].changes[0].value.contacts = undefined as unknown as never;

    const result = metaAdapter.normalize(payload);
    expect(result.from.name).toBeUndefined();
  });

  it('lança MalformedWebhookError para payload não estruturado', () => {
    expect(() => metaAdapter.normalize({ nonsense: true })).toThrow(
      MalformedWebhookError,
    );
  });

  it('lança MalformedWebhookError quando message.type !== "text"', () => {
    const payload = structuredClone(validPayload);
    payload.entry[0].changes[0].value.messages[0].type = 'image';

    expect(() => metaAdapter.normalize(payload)).toThrow(MalformedWebhookError);
  });

  it('lança MalformedWebhookError para payload vazio', () => {
    expect(() => metaAdapter.normalize({})).toThrow(MalformedWebhookError);
    expect(() => metaAdapter.normalize(null)).toThrow(MalformedWebhookError);
  });
});
