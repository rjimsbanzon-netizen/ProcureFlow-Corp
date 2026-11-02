-- Supply-chain extension. Apply after 0020. No existing tables are modified.
-- Operational A/B/C priorities differ from financial stock ABC and government Approved Budget for Contract.
CREATE TABLE IF NOT EXISTS supplier_company_inventory (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  sku TEXT NOT NULL COLLATE NOCASE,
  item_name TEXT NOT NULL,
  specifications TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'pcs',
  on_hand REAL NOT NULL DEFAULT 0 CHECK(on_hand>=0),
  reserved REAL NOT NULL DEFAULT 0 CHECK(reserved>=0 AND reserved<=on_hand),
  unit_price_cents INTEGER NOT NULL DEFAULT 0 CHECK(unit_price_cents>=0),
  lead_time_days INTEGER NOT NULL DEFAULT 0 CHECK(lead_time_days BETWEEN 0 AND 365),
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(supplier_id,sku)
);
CREATE INDEX IF NOT EXISTS idx_supplier_inventory_supplier ON supplier_company_inventory(supplier_id,item_name);

CREATE TABLE IF NOT EXISTS recurring_supply_plans (
  id TEXT PRIMARY KEY,
  item_name TEXT NOT NULL,
  sku TEXT NOT NULL COLLATE NOCASE,
  unit TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL CHECK(priority IN ('A','B','C')),
  primary_supplier_id TEXT NOT NULL,
  backup_supplier_id TEXT,
  primary_contract_id TEXT NOT NULL REFERENCES procurement_contracts(id),
  backup_contract_id TEXT REFERENCES procurement_contracts(id),
  quantity_per_cycle REAL NOT NULL CHECK(quantity_per_cycle>0),
  frequency TEXT NOT NULL CHECK(frequency IN ('Weekly','Monthly','Quarterly','Annually')),
  next_release_date TEXT NOT NULL,
  safety_stock REAL NOT NULL DEFAULT 0 CHECK(safety_stock>=0),
  status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Paused')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_supply_plans_due ON recurring_supply_plans(status,next_release_date);

CREATE TABLE IF NOT EXISTS supply_shortage_cases (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES recurring_supply_plans(id),
  required_qty REAL NOT NULL CHECK(required_qty>0),
  primary_confirmed_qty REAL NOT NULL CHECK(primary_confirmed_qty>=0),
  shortage_qty REAL NOT NULL CHECK(shortage_qty>0),
  backup_available_at_report REAL NOT NULL DEFAULT 0,
  backup_confirmed_qty REAL,
  confirmation_reference TEXT,
  status TEXT NOT NULL DEFAULT 'Open' CHECK(status IN ('Open','Recommended','Reviewed','Closed')),
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_notes TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_shortage_plan ON supply_shortage_cases(plan_id,created_at);
CREATE TABLE IF NOT EXISTS supplier_stock_audit (
  id TEXT PRIMARY KEY,
  inventory_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  old_on_hand REAL,
  new_on_hand REAL NOT NULL,
  old_reserved REAL,
  new_reserved REAL NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stock_audit_supplier ON supplier_stock_audit(supplier_id,changed_at);

CREATE TABLE IF NOT EXISTS supply_chain_audit (
  id TEXT PRIMARY KEY, action TEXT NOT NULL, description TEXT NOT NULL, user_id TEXT NOT NULL, created_at TEXT NOT NULL
);
