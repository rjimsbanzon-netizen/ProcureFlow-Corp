-- Apply once AFTER migrations 0013, 0014, 0015, 0018, 0019. Back up remote D1 first.
-- Removes approved accounts from active listings without breaking historical references.
ALTER TABLE users ADD COLUMN deleted_at TEXT;
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);

-- 0015 constrained the delegation step list, so adding Operations Head also
-- requires a table rebuild. Copy all existing requests, decisions and dates.
CREATE TABLE approval_delegations_ops_upgrade (
  id TEXT PRIMARY KEY,
  step_role TEXT NOT NULL CHECK (step_role IN ('Procurement Head','Operations Head','Finance Officer','Finance Head','Department Head')),
  department TEXT NOT NULL DEFAULT '',
  primary_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delegate_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  reason TEXT NOT NULL,
  revoked_at TEXT,
  revoked_by TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  request_kind TEXT NOT NULL DEFAULT 'Delegation' CHECK (request_kind IN ('Leave','Delegation')),
  review_status TEXT NOT NULL DEFAULT 'Approved' CHECK (review_status IN ('Pending','Approved','Rejected','Cancelled')),
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_note TEXT NOT NULL DEFAULT '',
  CHECK (primary_user_id <> delegate_user_id),
  CHECK (starts_on <= ends_on),
  CHECK ((step_role = 'Department Head' AND LENGTH(TRIM(department)) > 0)
      OR (step_role <> 'Department Head' AND department = ''))
);
INSERT INTO approval_delegations_ops_upgrade
 (id,step_role,department,primary_user_id,delegate_user_id,starts_on,ends_on,reason,revoked_at,
  revoked_by,created_by,created_at,request_kind,review_status,reviewed_by,reviewed_at,review_note)
SELECT id,step_role,department,primary_user_id,delegate_user_id,starts_on,ends_on,reason,revoked_at,
       revoked_by,created_by,created_at,request_kind,review_status,reviewed_by,reviewed_at,review_note
FROM approval_delegations;
DROP TABLE approval_delegations;
ALTER TABLE approval_delegations_ops_upgrade RENAME TO approval_delegations;
CREATE INDEX idx_delegations_active ON approval_delegations(step_role,department,starts_on,ends_on,revoked_at);
CREATE INDEX idx_delegations_user ON approval_delegations(delegate_user_id);
CREATE INDEX idx_delegations_review ON approval_delegations(review_status,step_role,department,starts_on,ends_on);
