import { describe, it, expect } from 'vitest';
import { zapiAdapter } from './zapi.adapter';
import { MalformedWebhookError } from '../core/errors';

const validPayload = {
  instanceId: 'SUA_INSTANCE_ID',
  messageId: '3EB0B430B6F8C1D073A0',
  phone: '5511988888888',
  fromMe: false,
  momment: 1677234567000, // milissegundos (não segundos!)
  status: 'RECEIVED',
  chatName: 'João Silva',
  senderName: 'João Silva',
  type: 'ReceivedCallback',
  text: {
    message: 'Olá, gostaria de saber mais sobre o produto',
  },
};

describe('zapiAdapter', () => {
  it('normaliza o payload oficial da Z-API', () => {
    const result = zapiAdapter.normalize(validPayload);

    expect(result.providerId).toBe('zapi');
    expect(result.externalMessageId).toBe('3EB0B430B6F8C1D073A0');
    expect(result.from.phone).toBe('5511988888888');
    expect(result.from.name).toBe('João Silva');
    expect(result.text).toBe('Olá, gostaria de saber mais sobre o produto');
    expect(result.timestamp).toEqual(new Date(1677234567000));
  });

  it('to é undefined (Z-API não expõe destinatário)', () => {
    const result = zapiAdapter.normalize(validPayload);
    expect(result.to).toBeUndefined();
  });

  it('usa chatName como fallback quando senderName ausente', () => {
    const payload = structuredClone(validPayload) as Partial<
      typeof validPayload
    >;
    delete payload.senderName;

    const result = zapiAdapter.normalize(payload);
    expect(result.from.name).toBe('João Silva'); // do chatName
  });

  it('trata momment em milissegundos (não converte de segundos)', () => {
    // Se o adapter convertesse *1000 como o Meta/Evolution, o ano seria lá em 55000
    const result = zapiAdapter.normalize(validPayload);
    expect(result.timestamp.getUTCFullYear()).toBe(2023);
  });

  it('lança MalformedWebhookError quando text.message ausente', () => {
    const payload = { ...validPayload, text: {} };
    expect(() => zapiAdapter.normalize(payload)).toThrow(MalformedWebhookError);
  });
});
