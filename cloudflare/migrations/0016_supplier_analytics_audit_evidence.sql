-- Features 18-20: Audit evidence is server-owned; no changes to business snapshots.
CREATE TABLE IF NOT EXISTS audit_evidence (
  id TEXT PRIMARY KEY, occurred_at TEXT NOT NULL, actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL, actor_role TEXT NOT NULL,
  entity_type TEXT NOT NULL, entity_ref TEXT NOT NULL, action TEXT NOT NULL,
  before_json TEXT, after_json TEXT,
  review_state TEXT NOT NULL DEFAULT 'Unreviewed'
    CHECK (review_state IN ('Unreviewed','Reviewed','Flagged')),
  review_note TEXT NOT NULL DEFAULT '', reviewer_id TEXT, reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_evidence_date ON audit_evidence(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_evidence_review ON audit_evidence(review_state,occurred_at DESC);
CREATE TABLE IF NOT EXISTS audit_evidence_reviews (
  id TEXT PRIMARY KEY, evidence_id TEXT NOT NULL REFERENCES audit_evidence(id),
  reviewer_id TEXT NOT NULL, old_state TEXT NOT NULL, new_state TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '', recorded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_review_history ON audit_evidence_reviews(evidence_id,recorded_at DESC);
