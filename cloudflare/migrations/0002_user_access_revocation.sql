ALTER TABLE users ADD COLUMN access_revoked INTEGER NOT NULL DEFAULT 0
  CHECK (access_revoked IN (0, 1));
