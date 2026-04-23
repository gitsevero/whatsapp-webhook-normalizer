import { describe, it, expect } from 'vitest';
import { AdapterRegistry } from './registry';
import { UnknownProviderError } from './errors';
import type { ProviderAdapter, NormalizedMessage } from './types';

function makeAdapter(id: string): ProviderAdapter {
  return {
    id,
    normalize: (payload: unknown): NormalizedMessage => ({
      providerId: id,
      externalMessageId: 'x',
      from: { phone: '1' },
      text: 't',
      timestamp: new Date(0),
      raw: payload,
    }),
  };
}

describe('AdapterRegistry', () => {
  it('registra e recupera adapter por id', () => {
    const registry = new AdapterRegistry();
    const adapter = makeAdapter('alpha');

    registry.register(adapter);

    expect(registry.get('alpha')).toBe(adapter);
  });

  it('lança UnknownProviderError quando id não está registrado', () => {
    const registry = new AdapterRegistry();

    expect(() => registry.get('missing')).toThrow(UnknownProviderError);
  });

  it('UnknownProviderError carrega o providerId que falhou', () => {
    const registry = new AdapterRegistry();

    try {
      registry.get('telegram');
      expect.fail('deveria ter lançado');
    } catch (err) {
      expect(err).toBeInstanceOf(UnknownProviderError);
      expect((err as UnknownProviderError).providerId).toBe('telegram');
    }
  });

  it('re-registro com mesmo id sobrescreve (última instância vence)', () => {
    const registry = new AdapterRegistry();
    const first = makeAdapter('beta');
    const second = makeAdapter('beta');

    registry.register(first);
    registry.register(second);

    expect(registry.get('beta')).toBe(second);
  });
});
