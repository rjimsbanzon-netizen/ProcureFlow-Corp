-- Deliberately empty until an authenticated Admin opts into a dedicated DEMO workspace.
-- Never seed password123 accounts into an ordinary production migration.
CREATE TABLE IF NOT EXISTS demo_scenario_state (
 id INTEGER PRIMARY KEY CHECK(id=1), scenario_id TEXT NOT NULL,
 seed_version INTEGER NOT NULL DEFAULT 1, activated_by TEXT NOT NULL,
 activated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS demo_material_catalog (
 id TEXT PRIMARY KEY, scenario_id TEXT NOT NULL, sku TEXT NOT NULL,
 item_name TEXT NOT NULL, priority TEXT NOT NULL CHECK(priority IN ('A','B','C')),
 unit TEXT NOT NULL, on_hand REAL NOT NULL, reorder_point REAL NOT NULL,
 target_qty REAL NOT NULL, unit_price_cents INTEGER NOT NULL,
 specifications TEXT NOT NULL DEFAULT '', supplier_id TEXT NOT NULL,
 UNIQUE(scenario_id,sku)
);
CREATE TABLE IF NOT EXISTS demo_supplier_terms (
 supplier_id TEXT PRIMARY KEY, scenario_id TEXT NOT NULL,
 supplier_name TEXT NOT NULL, contact TEXT NOT NULL, category TEXT NOT NULL,
 terms_json TEXT NOT NULL, simulated INTEGER NOT NULL DEFAULT 1
);
