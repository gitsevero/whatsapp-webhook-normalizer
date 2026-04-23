-- Remove a tabela `providers` e a FK em `messages`.
--
-- Motivação: para um normalizador de webhooks com catálogo pequeno e fixo de
-- adapters (definido em código), uma tabela `providers` separada adiciona
-- complexidade sem ganho real. Cada novo provedor exigia uma migration de seed
-- só para satisfazer a FK, contradizendo o requisito 1.4 do teste ("adicionar
-- provedor sem alterar código existente").
--
-- `messages.provider_id` continua TEXT NOT NULL — proteção contra typos é feita
-- pelo AdapterRegistry em runtime (registry.get(id) lança UnknownProviderError).
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_provider_id_fkey;

DROP TABLE IF EXISTS providers;
