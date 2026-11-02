-- Run once against D1 before deploying the account/direct-message Worker routes.
-- Requested positions are unprivileged registration preferences. Staff appointments
-- continue to be made through Admin's existing Staff Assignments workflow.
ALTER TABLE users ADD COLUMN requested_position TEXT NOT NULL DEFAULT 'Employee'
  CHECK(requested_position IN ('Employee','Officer','Head','Supplier'));
ALTER TABLE users ADD COLUMN profile_bio TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN profile_discoverable INTEGER NOT NULL DEFAULT 1
  CHECK(profile_discoverable IN (0,1));
ALTER TABLE users ADD COLUMN email_verified_at TEXT;
ALTER TABLE users ADD COLUMN username_aliases TEXT NOT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN name_aliases TEXT NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS account_username_history (
  username TEXT PRIMARY KEY COLLATE NOCASE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  changed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS account_email_verifications (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  pending_email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS account_direct_messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK(length(body)>0 AND length(body)<=2000),
  created_at TEXT NOT NULL,
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender ON account_direct_messages(sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient ON account_direct_messages(recipient_id, sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_unread ON account_direct_messages(recipient_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_discoverable ON users(status, access_revoked, profile_discoverable);
