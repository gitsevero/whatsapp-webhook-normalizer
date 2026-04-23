import OpenAI from 'openai';
import { logger } from '../observability/logger';

export type Intent =
  | 'asking_price'
  | 'ready_to_buy'
  | 'asking_info'
  | 'not_interested'
  | 'support_issue'
  | 'other';

const VALID_INTENTS: readonly Intent[] = [
  'asking_price',
  'ready_to_buy',
  'asking_info',
  'not_interested',
  'support_issue',
  'other',
];

const SYSTEM_PROMPT = `Você classifica intenções de leads recebidos via WhatsApp.
Categorias permitidas:
- asking_price: cliente pergunta valor/preço
- ready_to_buy: cliente demonstra intenção clara de comprar
- asking_info: pede informação sobre produto, prazo, disponibilidade
- not_interested: declina explicitamente
- support_issue: reclamação ou problema pós-venda
- other: não se encaixa em nenhuma das anteriores

Responda APENAS com JSON no formato {"intent": "..."}, sem texto adicional.`;

const MODEL = 'gpt-4o-mini';
const TIMEOUT_MS = 5000;

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  cachedClient = new OpenAI({ apiKey, timeout: TIMEOUT_MS });
  return cachedClient;
}

export function isLlmEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function classifyIntent(text: string): Promise<Intent | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      max_tokens: 30,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
    });

    const content = response.choices[0]?.message.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as { intent?: string };
    const intent = parsed.intent;

    if (intent && VALID_INTENTS.includes(intent as Intent)) {
      return intent as Intent;
    }
    return 'other';
  } catch (err) {
    logger.warn('llm classification failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
