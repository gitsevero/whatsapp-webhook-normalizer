-- dead_letters deve registrar qualquer falha, inclusive de providers
-- desconhecidos ("/webhooks/telegram" chegando sem estar cadastrado).
-- Por isso removemos a FK: a tabela é de auditoria, não exige integridade
-- referencial com providers.
ALTER TABLE dead_letters
  DROP CONSTRAINT IF EXISTS dead_letters_provider_id_fkey;
