# Como adicionar um novo provedor

Esta implementação usa o pattern **Strategy + Registry** (ver [decisions.md — ADR-001](decisions.md#adr-001--pattern-de-normalização-strategy--registry)). O registro de adapters vive em [src/adapters/index.ts](../src/adapters/index.ts) — esse é o único arquivo "do core" que cresce quando um provedor novo entra.

O adapter de demonstração [src/adapters/fake.ts](../src/adapters/fake.ts) serve como referência viva (≤30 linhas).

---

## Passo a passo

Suponha que você quer integrar um provedor fictício chamado **Twilio WhatsApp**. O payload que ele manda nos webhooks é (exemplo):

```json
{
  "MessageSid": "SM1234567890",
  "From": "whatsapp:+5511988888888",
  "Body": "Olá",
  "ProfileName": "João Twilio",
  "DateSent": "2024-01-15T10:30:00Z"
}
```

### 1. Crie o arquivo do adapter

[src/adapters/twilio.ts](../src/adapters/twilio.ts) *(não existe — é o exemplo)*

```ts
import { z } from 'zod';
import type { ProviderAdapter, NormalizedMessage } from '../core/types';
import { MalformedWebhookError } from '../core/errors';

const TwilioPayload = z.object({
  MessageSid: z.string(),
  From: z.string(),
  Body: z.string(),
  ProfileName: z.string().optional(),
  DateSent: z.string(),
});

export const twilioAdapter: ProviderAdapter = {
  id: 'twilio',

  normalize(payload: unknown): NormalizedMessage {
    const parsed = TwilioPayload.safeParse(payload);
    if (!parsed.success) throw new MalformedWebhookError('twilio', parsed.error);

    const p = parsed.data;
    return {
      providerId: 'twilio',
      externalMessageId: p.MessageSid,
      from: {
        phone: p.From.replace(/^whatsapp:\+?/, ''),
        name: p.ProfileName,
      },
      text: p.Body,
      timestamp: new Date(p.DateSent),
      raw: payload,
    };
  },
};
```

### 2. Registre no ponto único

[src/adapters/index.ts](../src/adapters/index.ts) — **2 linhas adicionais**:

```diff
  import { fakeAdapter } from './fake';
+ import { twilioAdapter } from './twilio';

  registry.register(metaAdapter);
  registry.register(evolutionAdapter);
  registry.register(zapiAdapter);
  registry.register(fakeAdapter);
+ registry.register(twilioAdapter);
```

### 3. Cadastre o provedor no banco

[db/migrations/004_seed_twilio.sql](../db/migrations/004_seed_twilio.sql) *(não existe — é o exemplo)*

```sql
INSERT INTO providers (id, name) VALUES
  ('twilio', 'Twilio WhatsApp API')
ON CONFLICT (id) DO NOTHING;
```

Rode:

```bash
npm run migrate
```

### Pronto — a rota já existe

```bash
curl -X POST http://localhost:3000/webhooks/twilio \
  -H "Content-Type: application/json" \
  -d '{"MessageSid":"SM123","From":"whatsapp:+5511988888888","Body":"hello","DateSent":"2024-01-15T10:30:00Z"}'

# → {"ok":true,"externalMessageId":"SM123"}
```

---

## O que **não** precisou mudar

Provando o princípio Open/Closed:

| Arquivo | Tocado? |
|---|---|
| `src/core/types.ts` (tipo `NormalizedMessage`, interface `ProviderAdapter`) | ❌ |
| `src/core/registry.ts` (lookup por ID) | ❌ |
| `src/core/errors.ts` (erros tipados) | ❌ |
| `src/http/server.ts` (HTTP layer, middleware, error handler) | ❌ |
| `src/db/repositories.ts` (persistência) | ❌ |
| `src/db/migrate.ts` (migration runner) | ❌ |
| `src/observability/logger.ts` (logger) | ❌ |
| `src/security/*` (HMAC da Meta e outros) | ❌ |
| Outros adapters (`meta.ts`, `evolution.ts`, `zapi.ts`, `fake.ts`) | ❌ |
| Schema `messages`, `dead_letters` | ❌ |

Somente **3 arquivos** tocados — dois criados do zero (adapter + migration) e um editado com 2 linhas (registro).

---

## Se o provedor tiver auth/assinatura customizada

Adicione um verificador em [src/security/](../src/security/) e plugue no dispatcher [src/security/index.ts](../src/security/index.ts):

```ts
switch (req.params.provider) {
  case 'meta':   return verifyMetaSignature(req, res, next);
  case 'twilio': return verifyTwilioSignature(req, res, next); // novo case
  default:       return next();
}
```

Continua sendo adição, não alteração das verificações existentes.
