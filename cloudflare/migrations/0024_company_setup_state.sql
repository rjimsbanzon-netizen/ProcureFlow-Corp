CREATE TABLE IF NOT EXISTS company_setup_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  setup_id TEXT NOT NULL,
  annual_budget_cents INTEGER NOT NULL CHECK (annual_budget_cents > 0),
  setup_config TEXT NOT NULL,
  updated_by TEXT NOT NULL REFERENCES users(id),
  updated_at TEXT NOT NULL
);
