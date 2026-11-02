-- Operations Officer is an operational appointment, not an account role.
-- Keep the assignment separate so users.app_role remains within its existing CHECK constraint.
CREATE TABLE IF NOT EXISTS operations_officers (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointed_by TEXT NOT NULL REFERENCES users(id),
  appointed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
