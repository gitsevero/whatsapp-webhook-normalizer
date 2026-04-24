# Decisões Técnicas

Registro das principais decisões que moldaram o projeto.

---

## ADR-001 — Pattern: Strategy + Registry

**Problema.** Três provedores (Meta, Evolution, Z-API) com payloads completamente diferentes, mas adicionar um quarto não pode exigir alterar código existente (requisito 1.4 do teste).

**Escolha.** Cada provedor é uma Strategy num arquivo isolado. Um Registry (`Map<id, adapter>`) faz lookup por ID em O(1). A URL `/webhooks/:provider` já carrega o ID.

**Por quê.**

1. O ID do provedor **já vem na URL** — todo provedor obriga você a cadastrar uma URL dedicada no dashboard dele. Usar o `:provider` da rota é grátis.
2. Lookup por `Map.get` é O(1) e sem ambiguidade. Chain of Responsibility (`canHandle(payload)`) introduz ordem e risco de dois adapters aceitarem o mesmo payload.
3. Adicionar provedor = **criar um arquivo**. O `src/adapters/index.ts` varre a pasta no boot e registra qualquer `*.adapter.ts`. Nenhum arquivo existente é tocado.
4. Cada adapter vira função pura `payload → NormalizedMessage` — teste unitário trivial.

**Por que não Chain of Responsibility.** Só ganharia se houvesse uma rota única `/webhook` e a detecção tivesse que ser por payload. Com URL parametrizada, não há porquê.

**Por que não Factory / Adapter (GoF).** Factory é redundante com Registry (mesma semântica). Adapter clássico serve pra encaixar classes pré-existentes, não normalizadores escritos do zero.

**Nomenclatura.** Os arquivos se chamam `*.adapter.ts` porque no domínio de integrações esse é o nome que se usa — mas mecanicamente é Strategy.

**Risco do auto-discovery.** Export com shape errado só aparece no boot, não em compile. Mitigado pelo type guard `isProviderAdapter` no loader + zod validando payload em runtime.

---

## ADR-002 — HTTP: Express

**Problema.** A verificação HMAC da Meta exige o **corpo bruto** da request — qualquer re-serialização do JSON quebra o hash.

**Escolha.** Express.

**Por quê.** `express.json({ verify: (req, res, buf) => { req.rawBody = buf } })` resolve em duas linhas. Fastify faz o mesmo com mais cerimônia; Hono faria sentido só se fosse rodar em Edge (não é o caso). Pra 3 rotas, Express é a opção sem atrito.

---

## ADR-003 — Validação: zod

**Problema.** Payloads diferentes e potencialmente malformados. Precisa validar estrutura **e** tipar a saída pro normalizador.

**Escolha.** zod.

**Por quê.** `z.infer<typeof Schema>` dá a tipagem direto do schema — sem manter interface TS paralela. Erros trazem o path do campo problemático, útil pra popular `dead_letters`. Valibot é mais leve, mas a documentação e o ecossistema do zod são melhores.

---

## ADR-004 — Banco: Supabase Postgres, via `pg` puro

**Problema.** Precisa de Postgres. Opções: local via Docker, Supabase só como DB, ou Supabase Edge Functions full.

**Escolha.** Supabase como Postgres managed; aplicação continua Node + Express + `pg`.

**Por quê.**

1. **Zero atrito pro avaliador.** Basta conta grátis no Supabase e `DATABASE_URL` — sem Docker, sem build local.
2. **Código portável.** `DATABASE_URL` abstrai o provedor; trocar por RDS ou Postgres local é só mudar a env var.
3. **Evolução incremental.** Se migrar pra Edge Functions depois, o schema já está no Supabase; só o HTTP layer muda.

**Sobre Edge Functions.** Viável; documentado no README como alternativa (trocar Express→Hono, `pg`→client Deno, `rawBody` via `request.text()`). Não implementado nesta versão.

**Cliente Postgres.** `pg` puro + SQL migrations. Schema fica visível, sem mágica de ORM. Pra esse escopo, ORM seria overhead.

---

## ADR-005 — Sem tabela `providers`

**Problema.** Primeira versão tinha tabela `providers (id, name, created_at)` com FK `messages.provider_id → providers(id)`. Toda adição de provedor exigia migration de seed (`INSERT INTO providers`) só pra satisfazer a FK — contradizendo o requisito 1.4 ("adicionar provedor sem alterar código existente").

**Escolha.** Remover a tabela. `messages.provider_id` vira `TEXT NOT NULL` sem FK (migration 004).

**Por quê.**

1. O teste pede "schema simples pra armazenar as mensagens normalizadas". Tabela auxiliar pra 3-10 provedores com IDs literais no código é over-engineering.
2. **Proteção contra typo já existe em runtime.** `AdapterRegistry.get(id)` lança `UnknownProviderError` (→ 404 + dead_letter) pra qualquer ID não registrado. FK seria validação duplicada.
3. **YAGNI pra metadata.** Se um dia precisar de `enabled`, `display_name`, `rate_limit` por provedor, cria a tabela aí — adição pura, não muda `messages`.

**Resultado.** "Adicionar provedor = 1 arquivo" vira literal. Sem migration, sem seed, sem JOIN.

---

## Testes

vitest. Zero-config pra TypeScript, API parecida com jest. Rode com `npm test`.
