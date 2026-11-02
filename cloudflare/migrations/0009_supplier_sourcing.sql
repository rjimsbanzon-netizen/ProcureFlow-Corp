-- Feature 9: private supplier/staff correspondence, immutable message history.
CREATE TABLE IF NOT EXISTS sourcing_messages (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('BID','MEETING','PO','DELIVERY','ISSUE')),
  entity_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  sender_user_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sourcing_messages_entity ON sourcing_messages(entity_type,entity_id,created_at);

-- Feature 10: deadlines are independent of the client-editable workspace snapshot.
-- Deadline is a UTC ISO 8601 timestamp; a closed flag is independent of scheduled expiry.
CREATE TABLE IF NOT EXISTS sourcing_deadlines (
  need_id TEXT PRIMARY KEY,
  closes_at TEXT NOT NULL,
  manually_closed INTEGER NOT NULL DEFAULT 0 CHECK (manually_closed IN (0,1)),
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Feature 11: one accreditation case per login, review retained in D1.
CREATE TABLE IF NOT EXISTS supplier_accreditations (
  supplier_user_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  review_note TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT,
  reviewed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS supplier_accreditation_files (
  id TEXT PRIMARY KEY,
  supplier_user_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Business Registration','Tax Certificate','Business Permit','Other')),
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL CHECK (size > 0 AND size <= 5242880),
  kv_key TEXT NOT NULL UNIQUE,
  valid_until TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_accreditation_files_user ON supplier_accreditation_files(supplier_user_id,uploaded_at);
