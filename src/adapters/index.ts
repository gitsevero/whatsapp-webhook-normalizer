import fs from 'node:fs';
import path from 'node:path';
import { registry } from '../core/registry';
import type { ProviderAdapter } from '../core/types';

// Auto-discovery: qualquer arquivo `*.adapter.ts` (dev) ou `*.adapter.js` (build)
// nesta pasta é carregado e registrado automaticamente. Adicionar um provedor
// novo não exige alterar este arquivo — basta criar `src/adapters/<id>.adapter.ts`.

function isProviderAdapter(value: unknown): value is ProviderAdapter {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'normalize' in value &&
    typeof (value as ProviderAdapter).id === 'string' &&
    typeof (value as ProviderAdapter).normalize === 'function'
  );
}

const ADAPTERS_DIR = __dirname;
const ADAPTER_FILE = /\.adapter\.(ts|js)$/;

for (const file of fs.readdirSync(ADAPTERS_DIR).filter((f) => ADAPTER_FILE.test(f))) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require(path.join(ADAPTERS_DIR, file)) as Record<string, unknown>;
  const adapter = Object.values(mod).find(isProviderAdapter);
  if (adapter) registry.register(adapter);
}

export { registry };
