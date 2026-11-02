/**
 * Offline SQLite store using sql.js (loaded from CDN).
 * Persists the DB as a binary blob in IndexedDB so data survives refresh.
 * Can export/import a .sqlite file for backup.
 */
import type { User, PurchaseOrder, Supplier, CreateUserInput, UserRole } from '../types';
import { hashPassword, verifyPassword } from './hash';

// sql.js types (minimal)
type SqlJsDatabase = {
  run: (sql: string, params?: unknown[]) => void;
  exec: (sql: string) => { columns: string[]; values: unknown[][] }[];
  prepare: (sql: string) => {
    bind: (params: unknown[]) => void;
    step: () => boolean;
    getAsObject: () => Record<string, unknown>;
    free: () => void;
  };
  export: () => Uint8Array;
  close: () => void;
};

type SqlJsStatic = {
  Database: new (data?: ArrayLike<number> | null) => SqlJsDatabase;
};

const IDB_NAME = 'procurecorp-offline';
const IDB_STORE = 'sqlite';
const IDB_KEY = 'db';

let SQL: SqlJsStatic | null = null;
let db: SqlJsDatabase | null = null;
let ready: Promise<void> | null = null;

async function loadSqlJs(): Promise<SqlJsStatic> {
  if (SQL) return SQL;
  // Dynamic load from CDN so no npm dependency is required for offline mode
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.11.0/sql-wasm.js';
  document.head.appendChild(script);
  await new Promise<void>((resolve, reject) => {
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load sql.js'));
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initSqlJs = (window as any).initSqlJs;
  SQL = await initSqlJs({
    locateFile: (file: string) =>
      `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.11.0/${file}`,
  });
  return SQL!;
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const idb = req.result;
      if (!idb.objectStoreNames.contains(IDB_STORE)) {
        idb.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadDbBytes(): Promise<Uint8Array | null> {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(IDB_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function saveDbBytes(bytes: Uint8Array): Promise<void> {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put(bytes, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  category TEXT NOT NULL,
  rating REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  supplier TEXT,
  category TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

async function seedIfEmpty(database: SqlJsDatabase) {
  const rows = database.exec('SELECT COUNT(*) as c FROM users');
  const count = (rows[0]?.values[0]?.[0] as number) ?? 0;
  if (count > 0) return;

  const now = new Date().toISOString();
  const seeds: [string, string, string, string, string, UserRole][] = [
    ['1', 'admin', 'admin123', 'Alex Rivera', 'alex.rivera@procurecorp.com', 'admin'],
    ['2', 'employee', 'emp123', 'Jordan Lee', 'jordan.lee@procurecorp.com', 'employee'],
    ['3', 'guest', 'guest123', 'Guest User', 'guest@example.com', 'guest'],
  ];
  for (const [id, username, pass, name, email, role] of seeds) {
    const hash = await hashPassword(pass);
    database.run(
      `INSERT INTO users (id, username, password_hash, name, email, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, username, hash, name, email, role, now, now]
    );
  }

  const suppliers = [
    ['SUP-001', 'TechSource Inc.', 'sales@techsource.com', 'IT Equipment', 4.8, 'active'],
    ['SUP-002', 'SafeWork Supplies', 'orders@safework.com', 'Safety', 4.5, 'active'],
    ['SUP-003', 'MetalForge Ltd.', 'procurement@metalforge.com', 'Raw Materials', 4.9, 'active'],
    ['SUP-004', 'Adobe Systems', 'enterprise@adobe.com', 'Software', 4.7, 'active'],
    ['SUP-005', 'Workspace Pro', 'hello@workspacepro.com', 'Furniture', 4.2, 'active'],
    ['SUP-006', 'LogiTrans Partners', 'fleet@logitrans.com', 'Logistics', 3.9, 'inactive'],
  ];
  for (const [id, name, contact, category, rating, status] of suppliers) {
    database.run(
      `INSERT INTO suppliers (id, name, contact, category, rating, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, contact, category, rating, status, now, now]
    );
  }

  const orders = [
    [
      'PO-2026-001',
      'Office Laptops (Batch 12)',
      '15x Dell Latitude 5540 for engineering team',
      18750,
      'pending',
      'Jordan Lee',
      '2026-10-20',
      'TechSource Inc.',
      'IT Equipment',
    ],
    [
      'PO-2026-002',
      'Warehouse Safety Gear',
      'Helmets, gloves, and high-vis vests restock',
      3200,
      'approved',
      'Jordan Lee',
      '2026-10-18',
      'SafeWork Supplies',
      'Safety',
    ],
    [
      'PO-2026-003',
      'Raw Materials - Steel Sheets',
      'Grade A steel sheets for Q4 production',
      45200,
      'completed',
      'Alex Rivera',
      '2026-10-05',
      'MetalForge Ltd.',
      'Raw Materials',
    ],
    [
      'PO-2026-004',
      'Software Licenses Renewal',
      'Annual Adobe Creative Cloud enterprise licenses',
      9800,
      'pending',
      'Jordan Lee',
      '2026-10-22',
      'Adobe Systems',
      'Software',
    ],
  ];
  for (const o of orders) {
    database.run(
      `INSERT INTO purchase_orders
       (id, title, description, amount, status, requested_by, requested_at, supplier, category, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...o, now, now]
    );
  }
}

async function persist() {
  if (!db) return;
  const bytes = db.export();
  await saveDbBytes(bytes);
}

export async function initLocalDb(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    const sqljs = await loadSqlJs();
    const bytes = await loadDbBytes();
    db = bytes ? new sqljs.Database(bytes) : new sqljs.Database();
    db.run(SCHEMA);
    await seedIfEmpty(db);
    await persist();
  })();
  return ready;
}

function ensureDb(): SqlJsDatabase {
  if (!db) throw new Error('Local DB not initialized. Call initLocalDb() first.');
  return db;
}

function queryAll<T>(sql: string, params: unknown[] = []): T[] {
  const database = ensureDb();
  const stmt = database.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

function mapUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    username: String(row.username),
    name: String(row.name),
    email: String(row.email),
    role: row.role as UserRole,
  };
}

function mapSupplier(row: Record<string, unknown>): Supplier {
  return {
    id: String(row.id),
    name: String(row.name),
    contact: String(row.contact),
    category: String(row.category),
    rating: Number(row.rating),
    status: row.status as 'active' | 'inactive',
  };
}

function mapOrder(row: Record<string, unknown>): PurchaseOrder {
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description),
    amount: Number(row.amount),
    status: row.status as PurchaseOrder['status'],
    requestedBy: String(row.requested_by),
    requestedAt: String(row.requested_at),
    supplier: row.supplier ? String(row.supplier) : undefined,
    category: String(row.category),
  };
}

export const localStore = {
  async login(username: string, password: string): Promise<User | null> {
    await initLocalDb();
    const rows = queryAll<Record<string, unknown>>(
      'SELECT * FROM users WHERE username = ? LIMIT 1',
      [username.toLowerCase()]
    );
    if (!rows.length) return null;
    const row = rows[0];
    const ok = await verifyPassword(password, String(row.password_hash));
    if (!ok) return null;
    return mapUser(row);
  },

  async register(input: CreateUserInput): Promise<{ ok: boolean; error?: string; user?: User }> {
    await initLocalDb();
    const database = ensureDb();
    const existing = queryAll('SELECT id FROM users WHERE username = ?', [input.username.toLowerCase()]);
    if (existing.length) return { ok: false, error: 'Username already exists' };

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(input.password);
    database.run(
      `INSERT INTO users (id, username, password_hash, name, email, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.username.toLowerCase(), passwordHash, input.name, input.email, input.role, now, now]
    );
    await persist();
    return {
      ok: true,
      user: {
        id,
        username: input.username.toLowerCase(),
        name: input.name,
        email: input.email,
        role: input.role,
      },
    };
  },

  async listUsers(): Promise<User[]> {
    await initLocalDb();
    return queryAll<Record<string, unknown>>('SELECT id, username, name, email, role FROM users ORDER BY username').map(
      mapUser
    );
  },

  async listSuppliers(): Promise<Supplier[]> {
    await initLocalDb();
    return queryAll<Record<string, unknown>>('SELECT * FROM suppliers ORDER BY name').map(mapSupplier);
  },

  async upsertSupplier(s: Supplier): Promise<Supplier> {
    await initLocalDb();
    const database = ensureDb();
    const now = new Date().toISOString();
    const existing = queryAll('SELECT id FROM suppliers WHERE id = ?', [s.id]);
    if (existing.length) {
      database.run(
        `UPDATE suppliers SET name=?, contact=?, category=?, rating=?, status=?, updated_at=? WHERE id=?`,
        [s.name, s.contact, s.category, s.rating, s.status, now, s.id]
      );
    } else {
      database.run(
        `INSERT INTO suppliers (id, name, contact, category, rating, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [s.id, s.name, s.contact, s.category, s.rating, s.status, now, now]
      );
    }
    await persist();
    return s;
  },

  async deleteSupplier(id: string): Promise<void> {
    await initLocalDb();
    ensureDb().run('DELETE FROM suppliers WHERE id = ?', [id]);
    await persist();
  },

  async listOrders(): Promise<PurchaseOrder[]> {
    await initLocalDb();
    return queryAll<Record<string, unknown>>(
      'SELECT * FROM purchase_orders ORDER BY requested_at DESC'
    ).map(mapOrder);
  },

  async upsertOrder(o: PurchaseOrder): Promise<PurchaseOrder> {
    await initLocalDb();
    const database = ensureDb();
    const now = new Date().toISOString();
    const existing = queryAll('SELECT id FROM purchase_orders WHERE id = ?', [o.id]);
    if (existing.length) {
      database.run(
        `UPDATE purchase_orders SET title=?, description=?, amount=?, status=?, requested_by=?,
         requested_at=?, supplier=?, category=?, updated_at=? WHERE id=?`,
        [
          o.title,
          o.description,
          o.amount,
          o.status,
          o.requestedBy,
          o.requestedAt,
          o.supplier ?? null,
          o.category,
          now,
          o.id,
        ]
      );
    } else {
      database.run(
        `INSERT INTO purchase_orders
         (id, title, description, amount, status, requested_by, requested_at, supplier, category, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          o.id,
          o.title,
          o.description,
          o.amount,
          o.status,
          o.requestedBy,
          o.requestedAt,
          o.supplier ?? null,
          o.category,
          now,
          now,
        ]
      );
    }
    await persist();
    return o;
  },

  /** Export current DB as a downloadable .sqlite file */
  async exportSqlFile(): Promise<void> {
    await initLocalDb();
    const bytes = ensureDb().export();
    const blob = new Blob([Uint8Array.from(bytes).buffer], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `procurecorp-offline-${new Date().toISOString().slice(0, 10)}.sqlite`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /** Import a .sqlite file and replace local DB */
  async importSqlFile(file: File): Promise<void> {
    const sqljs = await loadSqlJs();
    const buf = await file.arrayBuffer();
    if (db) db.close();
    db = new sqljs.Database(new Uint8Array(buf));
    db.run(SCHEMA);
    await persist();
  },
};
