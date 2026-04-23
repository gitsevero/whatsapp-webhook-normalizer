CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO providers (id, name) VALUES
  ('meta', 'Meta Cloud API'),
  ('evolution', 'Evolution API'),
  ('zapi', 'Z-API')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id),
  external_id TEXT NOT NULL,
  from_phone TEXT NOT NULL,
  from_name TEXT,
  to_phone TEXT,
  text TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw JSONB NOT NULL,
  intent TEXT,
  CONSTRAINT messages_provider_external_unique UNIQUE (provider_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_from_phone ON messages(from_phone);

CREATE TABLE IF NOT EXISTS dead_letters (
  id BIGSERIAL PRIMARY KEY,
  provider_id TEXT REFERENCES providers(id),
  payload JSONB NOT NULL,
  error TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
