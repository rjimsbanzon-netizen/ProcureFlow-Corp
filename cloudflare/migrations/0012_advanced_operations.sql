-- Feature 12-14: delivery discrepancies and verified-stock inventory ledger.
-- Idempotent D1 migration; existing procurement records are not modified.
CREATE TABLE IF NOT EXISTS delivery_discrepancies (
  delivery_id TEXT PRIMARY KEY,
  po_id TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  department TEXT NOT NULL,
  item_title TEXT NOT NULL,
  category TEXT NOT NULL,
  affected_qty INTEGER NOT NULL DEFAULT 0 CHECK(affected_qty >= 0),
  reported_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open' CHECK(status IN ('Open','Investigating','Awaiting Supplier','Replacement In Transit','Resolved')),
  resolution_notes TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_delivery_discrepancies_po ON delivery_discrepancies(po_id);
CREATE INDEX IF NOT EXISTS idx_delivery_discrepancies_status ON delivery_discrepancies(status);
CREATE TABLE IF NOT EXISTS delivery_discrepancy_events (
  id TEXT PRIMARY KEY,
  delivery_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  actor_id TEXT,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_discrepancy_events_delivery ON delivery_discrepancy_events(delivery_id, recorded_at);
CREATE TABLE IF NOT EXISTS verified_inventory_receipts (
  delivery_id TEXT PRIMARY KEY,
  po_id TEXT NOT NULL,
  department TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  item_title TEXT NOT NULL,
  specifications TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  first_received_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inventory_receipts_active ON verified_inventory_receipts(active, department, item_title);
CREATE TABLE IF NOT EXISTS verified_inventory_movements (
  id TEXT PRIMARY KEY,
  delivery_id TEXT NOT NULL,
  po_id TEXT NOT NULL,
  department TEXT NOT NULL,
  item_title TEXT NOT NULL,
  movement_type TEXT NOT NULL CHECK(movement_type IN ('Received','Reversed','Corrected')),
  quantity_delta INTEGER NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_date ON verified_inventory_movements(recorded_at);
