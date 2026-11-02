-- Apply after base schema + existing user migrations.
-- Files stay in PRIVATE Workers KV storage; only metadata is stored in D1.
CREATE TABLE IF NOT EXISTS procurement_documents (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('PR','BID','PO','DEL','PAY')),
  entity_id TEXT NOT NULL,
  category TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL CHECK(size > 0 AND size <= 5242880),
  kv_key TEXT NOT NULL UNIQUE,
  uploader_id TEXT NOT NULL,
  uploader_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_documents_entity ON procurement_documents(entity_type, entity_id, created_at);
CREATE TABLE IF NOT EXISTS procurement_document_events (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);
