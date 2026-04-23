import { describe, it, expect } from 'vitest';
import { evolutionAdapter } from './evolution.adapter';
import { MalformedWebhookError } from '../core/errors';

const validPayload = {
  event: 'messages.upsert',
  instance: 'minha-instancia',
  data: {
    key: {
      remoteJid: '5511988888888@s.whatsapp.net',
      fromMe: false,
      id: '3EB0B430B6F8C1D073A0',
    },
    pushName: 'João Silva',
    message: {
      conversation: 'Olá, gostaria de saber mais sobre o produto',
    },
    messageType: 'conversation',
    messageTimestamp: 1677234567,
  },
  destination: '5511999999999@s.whatsapp.net',
};

describe('evolutionAdapter', () => {
  it('normaliza o payload de exemplo do teste.md', () => {
    const result = evolutionAdapter.normalize(validPayload);

    expect(result.providerId).toBe('evolution');
    expect(result.externalMessageId).toBe('3EB0B430B6F8C1D073A0');
    expect(result.from.phone).toBe('5511988888888'); // JID stripped
    expect(result.from.name).toBe('João Silva');
    expect(result.to?.phone).toBe('5511999999999');
    expect(result.text).toBe('Olá, gostaria de saber mais sobre o produto');
    expect(result.timestamp).toEqual(new Date(1677234567 * 1000));
  });

  it('aceita message.extendedTextMessage.text como fallback', () => {
    const payload = {
      data: {
        key: {
          remoteJid: '5511988888888@s.whatsapp.net',
          id: 'extended-msg',
        },
        message: {
          extendedTextMessage: { text: 'texto longo' },
        },
        messageTimestamp: 1677234567,
      },
    };

    const result = evolutionAdapter.normalize(payload);
    expect(result.text).toBe('texto longo');
  });

  it('lança MalformedWebhookError se text não existe em nenhum dos campos', () => {
    const payload = {
      data: {
        key: { remoteJid: 'x@s.whatsapp.net', id: 'no-text' },
        message: {},
        messageTimestamp: 1677234567,
      },
    };

    expect(() => evolutionAdapter.normalize(payload)).toThrow(
      MalformedWebhookError,
    );
  });

  it('lança MalformedWebhookError para payload sem data', () => {
    expect(() => evolutionAdapter.normalize({ event: 'no_data' })).toThrow(
      MalformedWebhookError,
    );
  });

  it('to fica undefined se destination ausente', () => {
    const payload = structuredClone(validPayload) as Partial<
      typeof validPayload
    >;
    delete payload.destination;

    const result = evolutionAdapter.normalize(payload);
    expect(result.to).toBeUndefined();
  });
});
