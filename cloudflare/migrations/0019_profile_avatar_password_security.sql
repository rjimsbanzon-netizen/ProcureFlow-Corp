-- Run once after 0018. Avatar images are resized client-side, verified by
-- the Worker, and limited to ~60KB so public account listings remain fast.
ALTER TABLE users ADD COLUMN profile_avatar TEXT NOT NULL DEFAULT '';

-- Per-account throttle for password change attempts, even across sessions.
CREATE TABLE IF NOT EXISTS account_password_attempts (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  failed_count INTEGER NOT NULL DEFAULT 0,
  window_started INTEGER NOT NULL
);
