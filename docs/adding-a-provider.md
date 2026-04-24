# Como adicionar um novo provedor

Um arquivo novo, nada mais. O loader em [src/adapters/index.ts](../src/adapters/index.ts) varre a pasta no boot e registra qualquer `*.adapter.ts` automaticamente.

[src/adapters/fake.adapter.ts](../src/adapters/fake.adapter.ts) é o exemplo mínimo (≤30 linhas).

---

## Exemplo: integrar um provedor fictício "Twilio WhatsApp"

Suponha que o payload dele seja:

```json
{
  "MessageSid": "SM1234567890",
  "From": "whatsapp:+5511988888888",
  "Body": "Olá",
  "ProfileName": "João Twilio",
  "DateSent": "2024-01-15T10:30:00Z"
}
```

### 1. Criar `src/adapters/twilio.adapter.ts`

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

Requisitos pro loader detectar:
- Nome termina em `.adapter.ts`
- Exporta um objeto com `id: string` + `normalize(payload: unknown)`

### 2. Reiniciar o servidor

```bash
npm run dev
# {"message":"server started","adapters":["evolution","fake","meta","twilio","zapi"],...}

curl -X POST http://localhost:3000/webhooks/twilio \
  -H "Content-Type: application/json" \
  -d '{"MessageSid":"SM123","From":"whatsapp:+5511988888888","Body":"hello","DateSent":"2024-01-15T10:30:00Z"}'
# → {"ok":true,"externalMessageId":"SM123"}
```
