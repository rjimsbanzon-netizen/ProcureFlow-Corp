-- Follow-up to migration 0013: principal-initiated requests and Admin reviews.
-- Existing Admin-created delegations remain approved and continue to work.
-- Apply this ONCE after 0013. Back up D1 first.
ALTER TABLE approval_delegations ADD COLUMN request_kind TEXT NOT NULL DEFAULT 'Delegation'
  CHECK (request_kind IN ('Leave', 'Delegation'));
ALTER TABLE approval_delegations ADD COLUMN review_status TEXT NOT NULL DEFAULT 'Approved'
  CHECK (review_status IN ('Pending', 'Approved', 'Rejected', 'Cancelled'));
ALTER TABLE approval_delegations ADD COLUMN reviewed_by TEXT;
ALTER TABLE approval_delegations ADD COLUMN reviewed_at TEXT;
ALTER TABLE approval_delegations ADD COLUMN review_note TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_delegations_review ON approval_delegations(review_status, step_role, starts_on, ends_on);
