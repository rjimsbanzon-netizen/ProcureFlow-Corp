import { CLOUD_API_BASE, CLOUD_TOKEN_KEY, cloudRequest } from '../../services/cloud';
import { DB } from '../../store/state';
import type { ProcurementRecord, User } from '../../types/procurement';
import type { ContractAlert } from '../../services/contracts';
import type { Delegation } from '../../services/delegations';
import { canAccessTab } from '../../domain/permissions';
import {loadDeadlines} from '../../services/sourcing';

/**
 * Read/unread receipts live in D1, keyed by the authenticated user's ID.
 * Notification content comes from the shared D1-backed enterprise snapshot.
 * Polling every 30 s makes changes on other devices visible without needing
 * a paid push service. This module never overwrites the active form or DB.
 */
export type CloudNotificationStatus = 'local' | 'connecting' | 'synced' | 'offline';
export type NotificationDataSnapshot = Record<string, ProcurementRecord[]>;
export type CloudMessageAlert = {
  id: string; entityType: string; entityId: string; senderName: string; createdAt: string;
};
export type CloudDirectMessageAlert = {
  id: string; senderId: string; senderName: string; createdAt: string;
};

type AccountCache = {
  read: Set<string>;
  queued: Set<string>;
  snapshot: NotificationDataSnapshot | null;
  messageAlerts: CloudMessageAlert[];
  directMessageAlerts: CloudDirectMessageAlert[];
  contractAlerts: ContractAlert[];
  delegationAlerts: Delegation[];
  status: CloudNotificationStatus;
  lastError: string | null;
};

const stores = new Map<string, AccountCache>();
const listeners = new Set<() => void>();
const LOCAL_PREFIX = 'procureflow_read_notifications_v1_';
let revision = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
let flushing = false;

function accountId(user: User): string {
  return String(user.id || user.username);
}

function storeFor(user: User): AccountCache {
  const id = accountId(user);
  let store = stores.get(id);
  if (!store) {
    store = { read: new Set(), queued: new Set(), snapshot: null, messageAlerts: [], directMessageAlerts: [], contractAlerts: [], delegationAlerts: [],
      status: CLOUD_API_BASE ? 'connecting' : 'local', lastError: null };
    stores.set(id, store);
  }
  return store;
}

function notify(): void {
  revision++;
  for (const listener of listeners) listener();
}

export function getNotificationRevision(): number { return revision; }
export function getNotificationSyncStatus(user: User | null = DB.currentUser): CloudNotificationStatus {
  return user ? storeFor(user).status : 'local';
}
export function getNotificationSyncError(user: User | null = DB.currentUser): string | null {
  return user ? storeFor(user).lastError : null;
}

export function getCloudReadIds(user: User | null = DB.currentUser): ReadonlySet<string> {
  return user ? storeFor(user).read : new Set<string>();
}

export function getCloudNotificationSnapshot(user: User | null = DB.currentUser): NotificationDataSnapshot | null {
  return user ? storeFor(user).snapshot : null;
}

export function getCloudMessageAlerts(user: User | null = DB.currentUser): readonly CloudMessageAlert[] {
  return user ? storeFor(user).messageAlerts : [];
}
export function getCloudDirectMessageAlerts(user: User | null = DB.currentUser): readonly CloudDirectMessageAlert[] {
  return user ? storeFor(user).directMessageAlerts : [];
}

/** Immediately remove messages already marked read in D1 from the local feed. */
export function clearReadDirectMessageAlerts(ids: string[], user: User | null = DB.currentUser): void {
  if (!user || !ids.length) return;
  const store = storeFor(user);
  const read = new Set(ids);
  const remaining = store.directMessageAlerts.filter(alert => !read.has(alert.id));
  if (remaining.length === store.directMessageAlerts.length) return;
  store.directMessageAlerts = remaining;
  notify();
}

export function getCloudContractAlerts(user: User | null = DB.currentUser): readonly ContractAlert[] {
  return user ? storeFor(user).contractAlerts : [];
}
export function getCloudDelegationAlerts(user: User | null = DB.currentUser): readonly Delegation[] {
  return user ? storeFor(user).delegationAlerts : [];
}

function localReadIds(user: User): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LOCAL_PREFIX + encodeURIComponent(accountId(user))) || '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch { return []; }
}

/** Save optimistically, then sync in the background. Failures are retried on the next poll. */
export function queueCloudNotificationRead(ids: string[], user: User | null = DB.currentUser): void {
  if (!CLOUD_API_BASE || !user || !ids.length) return;
  const store = storeFor(user);
  for (const id of ids) {
    store.read.add(id);
    store.queued.add(id);
  }
  notify();
  void flushQueuedReads(user);
}

async function flushQueuedReads(user: User): Promise<void> {
  if (flushing || !CLOUD_API_BASE || !localStorage.getItem(CLOUD_TOKEN_KEY)) return;
  flushing = true;
  try {
    const store = storeFor(user);
    while (store.queued.size) {
      if (DB.currentUser?.id !== user.id) return;
      const ids = [...store.queued].slice(0, 80);
      try {
        await cloudRequest('/notifications/read', {
          method: 'POST', body: JSON.stringify({ ids }),
        });
        ids.forEach(id => store.queued.delete(id));
        store.status = 'synced';
        store.lastError = null;
      } catch (error) {
        store.status = 'offline';
        store.lastError = error instanceof Error ? error.message : 'Cloud sync unavailable';
        notify();
        return; // Keep the pending IDs for the next successful refresh.
      }
    }
    notify();
  } finally { flushing = false; }
}

async function refreshCloudNotifications(): Promise<void> {
  const user = DB.currentUser;
  if (running || !user || !CLOUD_API_BASE || !localStorage.getItem(CLOUD_TOKEN_KEY)) return;
  running = true;
  const expectedId = accountId(user);
  const store = storeFor(user);
  try {
    const canMessage = ['Admin', 'Procurement Head', 'Procurement Officer', 'Supplier'].includes(user.role);
    const [receiptsResult, workspaceResult, messagesResult, contractResult, delegationResult, , directMessagesResult] = await Promise.all([
      cloudRequest('/notifications/read'),
      cloudRequest('/enterprise-state'),
      canMessage ? cloudRequest('/sourcing/message-alerts').catch((error: unknown) => {
        // An old Worker deployment may not have the new endpoint yet.
        // Keep all other notifications working if messaging is unavailable.
        console.warn('Message alerts unavailable; confirm the latest sourcingRoutes.ts is deployed.', error);
        return null;
      }) : Promise.resolve(null),
      (canAccessTab('contracts') ? cloudRequest('/contracts/alerts') : Promise.resolve(null)).catch((error: unknown) => {
        console.warn('Contract renewal alerts unavailable; apply migration 0013 and redeploy the Worker.',error);
        return null;
      }),
      (!['Supplier'].includes(user.role) ? cloudRequest('/delegations') : Promise.resolve(null)).catch((error: unknown) => {
        console.warn('Delegation notifications unavailable; apply migration 0014 and redeploy the Worker.', error);
        return null;
      }),
      (user.role==='Supplier' ? loadDeadlines() : Promise.resolve(null)).catch((error: unknown) => {
        console.warn('Bidding deadline reminders unavailable until sourcing deadlines can be loaded.',error);
        return null;
      }),
      cloudRequest('/account/message-alerts').catch((error: unknown) => {
        // Older Worker deployments may not yet expose this endpoint.
        console.warn('Private message alerts unavailable; deploy the updated accountRoutes.ts.', error);
        return null;
      }),
    ]);
    const receipts = receiptsResult as { readIds?: unknown };
    const workspace = workspaceResult as { data?: unknown };
    if (accountId(DB.currentUser || user) !== expectedId || DB.currentUser?.id !== user.id) return;

    const remoteReads: string[] = Array.isArray(receipts.readIds)
      ? receipts.readIds.filter((id: unknown): id is string => typeof id === 'string') : [];
    remoteReads.forEach(id => store.read.add(id));
    if (messagesResult && typeof messagesResult === 'object') {
      const rows = (messagesResult as { alerts?: unknown }).alerts;
      if (Array.isArray(rows)) {
        store.messageAlerts = rows.filter((item): item is CloudMessageAlert => {
          if (!item || typeof item !== 'object') return false;
          const row = item as Record<string, unknown>;
          return typeof row.id === 'string' && typeof row.entityType === 'string' &&
            typeof row.entityId === 'string' && typeof row.senderName === 'string' &&
            typeof row.createdAt === 'string';
        }).slice(0, 200);
      }
    }

    if (directMessagesResult && typeof directMessagesResult === 'object') {
      const alerts = (directMessagesResult as { alerts?: unknown }).alerts;
      if (Array.isArray(alerts)) {
        store.directMessageAlerts = alerts.filter((item): item is CloudDirectMessageAlert => {
          if (!item || typeof item !== 'object') return false;
          const row = item as Record<string, unknown>;
          return typeof row.id === 'string' && typeof row.senderId === 'string' &&
            typeof row.senderName === 'string' && typeof row.createdAt === 'string';
        }).slice(0, 100);
      }
    }

    if(contractResult && typeof contractResult==='object' && Array.isArray((contractResult as {alerts?:unknown}).alerts)) {
      store.contractAlerts = ((contractResult as {alerts:unknown[]}).alerts).filter((a):a is ContractAlert=>{
        if(!a||typeof a!=='object')return false;
        const r=a as Record<string,unknown>;
        return typeof r.id==='string'&&typeof r.reference==='string'&&typeof r.endsOn==='string'&&typeof r.daysUntilExpiry==='number';
      }).slice(0,200);
    }
    if(delegationResult && typeof delegationResult==='object' && Array.isArray((delegationResult as {delegations?:unknown}).delegations)) {
      store.delegationAlerts = ((delegationResult as {delegations:unknown[]}).delegations).filter((d):d is Delegation=>{
        if(!d||typeof d!=='object')return false;
        const r=d as Record<string,unknown>;
        return typeof r.id==='string'&&typeof r.review_status==='string'&&typeof r.primary_user_id==='string'
          &&typeof r.delegate_user_id==='string'&&typeof r.created_at==='string';
      }).slice(0,200);
    }
    // Migrate existing browser-local read marks to the user's cloud account.
    // Never delete the browser copy when the network fails.
    for (const id of localReadIds(user)) {
      if (!remoteReads.includes(id)) store.queued.add(id);
      store.read.add(id);
    }
    const data = workspace?.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const records = data as Record<string, unknown>;
      const snapshot: NotificationDataSnapshot = {};
      const collections = ['stockNeeds', 'bids', 'proposalMeetings', 'requisitions', 'orders',
        'deliveries', 'amendments', 'payments', 'suppliers', 'ratings', 'auditLogs'];
      for (const key of collections) {
        if (Array.isArray(records[key])) snapshot[key] = records[key] as ProcurementRecord[];
      }
      store.snapshot = snapshot;
    }
    store.status = 'synced';
    store.lastError = null;
    notify();
    if (store.queued.size) void flushQueuedReads(user);
  } catch (error) {
    store.status = 'offline';
    store.lastError = error instanceof Error ? error.message : 'Cloud sync unavailable';
    notify();
  } finally { running = false; }
}

/** Shared subscription for the bell and the notifications page; one poller per tab. */
export function subscribeCloudNotifications(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && CLOUD_API_BASE) {
    void refreshCloudNotifications();
    timer = setInterval(() => { void refreshCloudNotifications(); }, 30_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function refreshNotificationsNow(): Promise<void> {
  return refreshCloudNotifications();
}
