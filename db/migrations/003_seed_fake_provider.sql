-- Provedor didático para demonstrar extensibilidade (ver src/adapters/fake.ts
-- e docs/adding-a-provider.md).
INSERT INTO providers (id, name) VALUES
  ('fake', 'Fake Provider (demo)')
ON CONFLICT (id) DO NOTHING;
