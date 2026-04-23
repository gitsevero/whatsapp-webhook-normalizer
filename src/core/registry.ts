import type { ProviderAdapter } from './types';
import { UnknownProviderError } from './errors';

export class AdapterRegistry {
  private readonly adapters = new Map<string, ProviderAdapter>();

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(providerId: string): ProviderAdapter {
    const adapter = this.adapters.get(providerId);
    if (!adapter) throw new UnknownProviderError(providerId);
    return adapter;
  }

  list(): string[] {
    return Array.from(this.adapters.keys());
  }
}

export const registry = new AdapterRegistry();
