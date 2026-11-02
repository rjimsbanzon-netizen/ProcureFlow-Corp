/**
 * Unified data service: uses Cloudflare D1 when online + configured,
 * otherwise falls back to local SQLite (sql.js) persisted in IndexedDB.
 */
import type { User, PurchaseOrder, Supplier, CreateUserInput } from '../types';
import { cloudApi, clearCloudSession, isCloudConfigured } from './cloudApi';
import { localStore, initLocalDb } from './localStore';

export type StorageMode = 'cloud' | 'local';

let currentMode: StorageMode = 'local';

export function getStorageMode(): StorageMode {
  return currentMode;
}

export async function detectStorageMode(): Promise<StorageMode> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    currentMode = 'local';
    await initLocalDb();
    return currentMode;
  }
  if (isCloudConfigured()) {
    currentMode = 'cloud';
    return currentMode;
  }
  currentMode = 'local';
  await initLocalDb();
  return currentMode;
}

function isUsingCloud(): boolean {
  return currentMode === 'cloud' && isCloudConfigured();
}

export const dataService = {
  getMode: getStorageMode,
  detectMode: detectStorageMode,

  async login(username: string, password: string): Promise<User | null> {
    await detectStorageMode();
    if (isUsingCloud()) return cloudApi.login(username, password);
    clearCloudSession();
    return localStore.login(username, password);
  },

  async register(input: CreateUserInput): Promise<{ ok: boolean; error?: string; user?: User }> {
    await detectStorageMode();
    if (isUsingCloud()) {
      return cloudApi.register(input);
    }
    return localStore.register(input);
  },

  async listUsers(): Promise<User[]> {
    await detectStorageMode();
    if (isUsingCloud()) return cloudApi.listUsers();
    return localStore.listUsers();
  },

  async listSuppliers(): Promise<Supplier[]> {
    await detectStorageMode();
    if (isUsingCloud()) return cloudApi.listSuppliers();
    return localStore.listSuppliers();
  },

  async upsertSupplier(s: Supplier): Promise<Supplier> {
    await detectStorageMode();
    if (isUsingCloud()) return cloudApi.upsertSupplier(s);
    return localStore.upsertSupplier(s);
  },

  async deleteSupplier(id: string): Promise<void> {
    await detectStorageMode();
    if (isUsingCloud()) return cloudApi.deleteSupplier(id);
    return localStore.deleteSupplier(id);
  },

  async listOrders(): Promise<PurchaseOrder[]> {
    await detectStorageMode();
    if (isUsingCloud()) return cloudApi.listOrders();
    return localStore.listOrders();
  },

  async upsertOrder(o: PurchaseOrder): Promise<PurchaseOrder> {
    await detectStorageMode();
    if (isUsingCloud()) return cloudApi.upsertOrder(o);
    return localStore.upsertOrder(o);
  },

  async logout(): Promise<void> {
    await cloudApi.logout();
  },

  exportSqlFile: () => localStore.exportSqlFile(),
  importSqlFile: (file: File) => localStore.importSqlFile(file),
};

// Re-detect when connectivity changes
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void detectStorageMode();
  });
  window.addEventListener('offline', () => {
    currentMode = 'local';
    void initLocalDb();
  });
}
