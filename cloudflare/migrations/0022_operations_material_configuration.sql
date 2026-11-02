CREATE TABLE IF NOT EXISTS operations_material_configuration (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  config TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
