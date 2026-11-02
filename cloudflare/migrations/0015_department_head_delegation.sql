-- Upgrade approved delegation requests to include scoped Department Head coverage.
-- Apply once AFTER 0013 and 0014. Back up the remote D1 database first.
-- Existing delegations are preserved; Procurement Head -> Procurement Officer is unchanged.
-- Department Head is a requisition SUBMISSION authority, not an approval sign-off.
CREATE TABLE approval_delegations_scope_upgrade (
  id TEXT PRIMARY KEY,
  step_role TEXT NOT NULL CHECK (step_role IN ('Procurement Head','Finance Officer','Finance Head','Department Head')),
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
INSERT INTO approval_delegations_scope_upgrade
  (id,step_role,department,primary_user_id,delegate_user_id,starts_on,ends_on,reason,revoked_at,
   revoked_by,created_by,created_at,request_kind,review_status,reviewed_by,reviewed_at,review_note)
SELECT id,step_role,'',primary_user_id,delegate_user_id,starts_on,ends_on,reason,revoked_at,
       revoked_by,created_by,created_at,request_kind,review_status,reviewed_by,reviewed_at,review_note
FROM approval_delegations;
DROP TABLE approval_delegations;
ALTER TABLE approval_delegations_scope_upgrade RENAME TO approval_delegations;
CREATE INDEX idx_delegations_active ON approval_delegations(step_role,department,starts_on,ends_on,revoked_at);
CREATE INDEX idx_delegations_user ON approval_delegations(delegate_user_id);
CREATE INDEX idx_delegations_review ON approval_delegations(review_status,step_role,department,starts_on,ends_on);
