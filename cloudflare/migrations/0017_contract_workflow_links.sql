-- Phase 3: optional winning-bid linkage and explicit draft lifecycle.
-- Existing contracts remain Published and keep their current dates and terms.
ALTER TABLE procurement_contracts ADD COLUMN bid_id TEXT;
ALTER TABLE procurement_contracts ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'Published'
  CHECK(lifecycle_status IN ('Draft','Published'));
CREATE INDEX IF NOT EXISTS idx_contracts_bid ON procurement_contracts(bid_id);
CREATE INDEX IF NOT EXISTS idx_contracts_lifecycle ON procurement_contracts(lifecycle_status,ends_on);
