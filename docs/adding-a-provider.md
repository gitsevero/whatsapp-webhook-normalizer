# Como adicionar um novo provedor

Esta implementação usa **Strategy + Registry com auto-discovery** (ver [decisions.md — ADR-001](decisions.md#adr-001--pattern-de-normalização-strategy--registry)). O carregamento de adapters acontece no boot via varredura de filesystem: qualquer arquivo `*.adapter.ts` em `src/adapters/` é detectado, validado estruturalmente e registrado automaticamente.

**Consequência:** adicionar um provedor exige **dois arquivos novos** e **zero alterações** em arquivos existentes. O `docs/adding-a-provider.md` (este arquivo), o `src/adapters/index.ts`, `src/core/registry.ts`, `src/http/server.ts` — nenhum deles é tocado.

O adapter de demonstração [src/adapters/fake.adapter.ts](../src/adapters/fake.adapter.ts) serve como referência viva (≤30 linhas).

---

## Passo a passo

Suponha que você quer integrar um provedor fictício chamado **Twilio WhatsApp**. O payload que ele manda é (exemplo):

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

[src/adapters/twilio.adapter.ts](../src/adapters/twilio.adapter.ts) *(não existe — é o exemplo)*

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

**Requisitos para ser detectado automaticamente:**
- Nome do arquivo termina com `.adapter.ts`
- Exporta um objeto com shape `ProviderAdapter` (`id: string` + `normalize(payload: unknown)`)

### 2. Cadastre o provedor no banco

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

No startup log do próximo boot, você vê o adapter registrado:
```json
{"message":"server started","adapters":["meta","evolution","zapi","fake","twilio"],...}
```

---

## O que **não** precisou mudar

Provando Open/Closed literalmente:

| Arquivo | Tocado? |
|---|---|
| `src/adapters/index.ts` (auto-discovery) | ❌ |
| `src/core/types.ts` | ❌ |
| `src/core/registry.ts` | ❌ |
| `src/core/errors.ts` | ❌ |
| `src/http/server.ts` | ❌ |
| `src/db/repositories.ts` | ❌ |
| `src/db/migrate.ts` | ❌ |
| `src/observability/logger.ts` | ❌ |
| `src/security/*` | ❌ |
| Outros adapters | ❌ |
| Schema de `messages` e `dead_letters` | ❌ |

**Zero arquivos existentes tocados.** Somente dois arquivos **novos** (adapter + migration).

---

## Como o auto-discovery funciona

[src/adapters/index.ts](../src/adapters/index.ts) roda no boot:

1. Lê todos os arquivos de `src/adapters/` que batem `/\.adapter\.(ts|js)$/`
2. Para cada arquivo, importa via `require()` e procura um export com shape `ProviderAdapter`
3. Registra no `AdapterRegistry`

Arquivos como `*.test.ts` ou `index.ts` não batem o padrão e são ignorados.

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

Essa é a **única** alteração em arquivo existente necessária — e só se o provedor requer assinatura específica. Sem assinatura, o adapter sozinho já funciona.
