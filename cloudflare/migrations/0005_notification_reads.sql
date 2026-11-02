-- Per-account, cross-device notification read state. No KV or R2 required.
-- Apply once to your EXISTING remote D1 database:
-- npx wrangler d1 execute procureflowcorp-db --remote --file=./migrations/0005_notification_reads.sql
CREATE TABLE IF NOT EXISTS notification_reads (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_id TEXT NOT NULL,
  read_at TEXT NOT NULL,
  PRIMARY KEY (user_id, notification_id)
);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user_time
ON notification_reads(user_id, read_at DESC);
