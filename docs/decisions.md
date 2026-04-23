# Decisões Arquiteturais (ADR leve)

Registro curto das decisões técnicas que moldaram o projeto. Cada entrada segue o formato **Contexto · Opções · Escolha · Motivo**. Decisões *just-in-time* (cliente Postgres, test runner, runtime final) ficam no final, sem aprofundar até serem necessárias.

---

## ADR-001 — Pattern de Normalização: Strategy + Registry

**Contexto.** O sistema recebe webhooks de múltiplos provedores (Meta, Evolution, Z-API) com formatos completamente diferentes e precisa normalizá-los em um tipo único `NormalizedMessage`. O requisito 1.4 do enunciado pede que adicionar um novo provedor seja simples e não exija alterações no código existente.

**Opções consideradas.**

| Pattern | Mecânica | Avaliação |
| --- | --- | --- |
| **Strategy + Registry** | URL `/webhooks/:provider` seleciona adapter por ID em O(1) via `Map<string, ProviderAdapter>` | Escolhido |
| Chain of Responsibility | URL única, cada adapter implementa `canHandle(payload)`, chain tenta até um aceitar | Rejeitado |
| Factory Method | Factory constrói adapter baseado em input | Redundante com Registry (mesma semântica, nome diferente) |
| Adapter (GoF clássico) | Adapta interface *pré-existente* a outra | Não aplicável — estamos escrevendo normalizadores do zero, não encaixando classes legadas |

**Escolha.** Strategy + Registry **com auto-discovery de adapters**. No domínio de integrações, o arquivo por provedor é tradicionalmente chamado de "adapter" mesmo sendo mecanicamente um Strategy — essa nomenclatura está mantida (`src/adapters/*.adapter.ts`) por clareza semântica, mas a justificativa técnica cita Strategy para evitar confusão com o Adapter GoF.

**Motivo.**

1. **A URL já carrega o provider ID.** Todo provedor exige que uma URL única seja registrada no dashboard dele — então `:provider` na rota é metadata gratuita e confiável. Ignorar isso para detectar via payload seria jogar fora informação que o transporte entrega.
2. **O(1) e sem ambiguidade.** Lookup por `Map.get` é determinístico. Chain of Responsibility introduz ordem e risco de dois adapters aceitarem o mesmo payload.
3. **Open/Closed literal.** Adicionar provedor = **criar um arquivo novo** (`*.adapter.ts`). O `src/adapters/index.ts` varre a pasta no boot e registra automaticamente qualquer arquivo que bate `*.adapter.ts` e exporta um objeto com shape `ProviderAdapter`. Nenhum arquivo existente é tocado, nenhuma migration de banco é necessária (ver ADR sobre schema simplificado, abaixo).
4. **Type safety plena.** Cada adapter tem seu schema zod, e `normalize` recebe o tipo inferido. Chain perderia parte disso até a detecção resolver.
5. **Testabilidade.** Cada adapter vira função pura `payload → NormalizedMessage` — teste unitário de 3 linhas, sem mock de ordem de chain.

**Trade-off do auto-discovery.** Erros de registro (export com shape errado) são descobertos em boot, não em compile. Esse risco é mitigado pela combinação de: tipo `ProviderAdapter` forte, type guard `isProviderAdapter` em `src/adapters/index.ts` rejeitando exports malformados, e zod validando o payload em runtime de qualquer jeito.

**Quando Chain of Responsibility ganharia.** Apenas se houvesse **uma única rota** (`/webhook`) e fosse necessário detectar o provedor pela forma do payload. Não é esse o caso: os três payloads de exemplo do enunciado são estruturalmente distintos e a URL parametrizada já resolve o despacho.

---

## ADR-002 — Framework HTTP: Express

**Contexto.** Precisamos de um servidor HTTP para receber webhooks. O ponto sensível é a **verificação de assinatura HMAC da Meta**, que exige acesso ao **raw body** da request (qualquer re-serialização do JSON quebra o hash).

**Opções consideradas.** Express · Fastify · Hono (Deno/Edge) · handler nativo Node.

**Escolha.** Express.

**Motivo.** Express tem suporte direto a `rawBody` via `express.json({ verify: (req, res, buf) => { req.rawBody = buf } })` — solução de 2 linhas amplamente documentada. Fastify também suporta, mas com mais cerimônia. Hono faria sentido se fôssemos rodar em Supabase Edge Functions (runtime Deno), mas o deploy alvo é Node local (ver nota de *Runtime* abaixo). Para 3 rotas, Express é a escolha pragmática: baixo atrito, ecossistema conhecido, zero magia.

---

## ADR-003 — Validação de Payload: zod

**Contexto.** Cada provedor manda um payload diferente e potencialmente malformado. Precisamos validar estrutura **e** extrair tipos tipados para o normalizador.

**Opções consideradas.** zod · valibot · validação manual com type guards.

**Escolha.** zod.

**Motivo.** zod dá **tipagem inferida** (`z.infer<typeof Schema>`) sem duplicar a definição em interface TS separada — o schema É a fonte da verdade. Erros de validação vêm com caminho do campo problemático, útil para popular `dead_letters`. Valibot é mais leve mas o ecossistema e a documentação do zod são superiores para entrevista/avaliação. Validação manual seria mais código sem ganho real.

---

---

## ADR-004 — Banco: Supabase Postgres (managed), consumido via `pg` puro

**Contexto.** O enunciado sugere Supabase Edge Functions como deploy, com nota "fique à vontade para outra plataforma". Indícios adicionais sobre o stack em produção da empresa (Supabase-native: Edge Functions + Postgres + Auth + RLS) reforçam o valor de alinhamento. Precisamos escolher entre: (A) Postgres local via Docker, (B) Supabase apenas como Postgres managed, (C) Supabase Edge Functions full.

**Opções consideradas.**

| Opção | Código muda | Sinaliza alinhamento com stack | Custo de setup |
| --- | --- | --- | --- |
| **A — Postgres local (Docker)** | Nada | Não | Médio (docker-compose, onboarding) |
| **B — Supabase apenas-DB** ⭐ | Nada (só `DATABASE_URL`) | Parcial | Baixo (criar projeto grátis, copiar string) |
| C — Supabase Edge Functions full | Trocar Express→Hono, `pg`→client Deno, HMAC em Edge | Total | Alto (rewrite do HTTP layer) |

**Escolha.** Opção B — Supabase como Postgres managed, aplicação continua Node + Express + `pg`.

**Motivo.**

1. **Alinhamento com o stack da empresa sem rewrite.** Teste2 deixa claro que o produto é Supabase-native. Usar Postgres do Supabase demonstra familiaridade com o ambiente deles; ir até Edge Functions custa refatoração pesada sem ganho proporcional para uma prova técnica.
2. **Código permanece portável.** `DATABASE_URL` abstrai o provedor — se fosse pra voltar para Postgres local ou migrar para RDS, só muda a env var.
3. **Reduz fricção do avaliador.** Quem roda o projeto só precisa de conta Supabase grátis (sem Docker, sem build local). Critério "código funcional" da seção 9 é atendido com menos atrito.
4. **Não bloqueia evolução.** Se o projeto seguir adiante, migrar de Node local para Edge Functions é incremental — o schema e migrations já estão no Supabase.

**Nota sobre Edge Functions.** Documentado no README como alternativa viável, com o caminho de adaptação esboçado (trocar Express por Hono, usar Deno postgres client, preservar `rawBody` via `request.text()`). Não implementado nesta versão.

---

## ADR-005 — Schema sem tabela `providers`

**Contexto.** Primeira versão do schema tinha uma tabela `providers` (id, name, created_at) com FK `messages.provider_id → providers(id)`. Design "manual de banco 101" — normalização 3NF, referential integrity, espaço pra metadata futura. Mas cada provedor novo exigia uma migration de seed (`INSERT INTO providers`) só para satisfazer a FK, o que **contradizia** o requisito 1.4 do teste ("adicionar provedor novo sem alterar código existente"). Auto-discovery de adapters resolvia o lado do código, mas o lado do DB continuava burocrático.

**Opções consideradas.**

| Opção | Extensibilidade | Integridade |
| --- | --- | --- |
| Manter tabela + migration por provedor | Atrito real | FK rígida |
| Manter tabela + auto-seed em `save()` | Zero atrito | FK rígida |
| **Remover tabela** ⭐ | Zero atrito | Validação em runtime via registry |

**Escolha.** Remover a tabela. `messages.provider_id` vira `TEXT NOT NULL` sem FK (migration 004).

**Motivo.**

1. **O enunciado não pede tabela `providers`.** A seção 2.1 pede "schema simples para armazenar as mensagens normalizadas". Uma tabela auxiliar para 3-10 provedores cujos IDs são literais no código é normalização acadêmica sem ganho real.
2. **Pragmatismo (critério seção 9).** "A solução é implementável ou é over-engineering?" Tabela `providers` com seed manual para cada entrada é exatamente o tipo de cerimônia que o critério visa penalizar.
3. **Proteção contra typos já existe em runtime.** `AdapterRegistry.get(id)` lança `UnknownProviderError` (→ 404 + dead_letter) para qualquer ID não registrado. FK seria validação duplicada.
4. **YAGNI para metadata.** "E se um dia precisarmos de `enabled`, `display_name`, `rate_limit` por provedor?" — cria a tabela naquele dia. Hoje, a adição de metadados via tabela nova é adição pura (não altera `messages`).

**Consequência narrativa.** "Adicionar provedor novo = 1 arquivo" se torna literal. Sem migration, sem seed, sem JOIN, sem nada. Fecha o requisito 1.4 do teste com elegância.

---

## Decisões *just-in-time* (não bloqueiam o scaffold)

Estas são registradas como **notas de contexto** — a decisão concreta é refinada quando o código correspondente nasce.

- **Cliente Postgres:** `pg` puro com SQL migrations. Motivo preliminar: schema visível, sem ORM/mágica, alinhado com o critério "clareza" da seção 9.
- **Test runner:** vitest (caso o Chunk 8 seja executado). Zero-config para TypeScript, API similar a jest.
- **Runtime final:** Node local alvo primário (ver ADR-004).

---

## Mudanças e revisões

Se uma decisão acima for revertida ou refinada durante a implementação, **atualizar a entrada correspondente** (não criar ADR novo) e anotar data + motivo em uma linha no rodapé da entrada. ADRs só viram entradas novas quando a decisão for realmente independente das anteriores.
