import { useSyncExternalStore } from 'react';
import { getRenderVersion, subscribeRender } from '../core/renderBridge';
import { DB } from '../store/state';
import { ownsRequisition } from '../domain/ownerIdentity';
import type { OrderRecord, RequisitionRecord, User, SupplierRecord, DeliveryRecord } from '../types/procurement';

/** Imperative actions call renderApp() after data changes; subscribe without polling.
 * Values are read from the current store on each render, never cached per account.
 * API authorization remains on the Worker. These filters are UI only. */
function useStoreVersion(): void { useSyncExternalStore(subscribeRender, getRenderVersion, getRenderVersion); }

export function useCurrentUser(): User | null {
  useStoreVersion();
  return DB.currentUser;
}

export function useRequisitions(scope: 'all' | 'mine' | 'visible' = 'visible'): RequisitionRecord[] {
  useStoreVersion();
  const user = DB.currentUser;
  if (!user) return [];
  if (user.role === 'Supplier') return [];
  if (scope === 'all' || (scope === 'visible' && user.role !== 'Employee')) return DB.requisitions;
  return DB.requisitions.filter(req => ownsRequisition(req,user));
}

export function useOrders(scope: 'all' | 'visible' = 'visible'): OrderRecord[] {
  useStoreVersion();
  const user = DB.currentUser;
  if (!user) return [];
  if (scope === 'all') return user.role === 'Supplier' ? [] : DB.orders;
  if (user.role === 'Supplier') return DB.orders.filter(order =>
    Boolean(user.supplierId) && order.supplierId === user.supplierId);
  return DB.orders;
}

export function useSuppliers(): SupplierRecord[] {
  useStoreVersion();
  // Supplier directory is permission-protected by canAccessTab('suppliers').
  return DB.currentUser?.role === 'Supplier' ? [] : DB.suppliers;
}

export function useDeliveries(): DeliveryRecord[] {
  useStoreVersion();
  const user = DB.currentUser;
  if (!user) return [];
  if (user.role === 'Employee') return DB.deliveries.filter(item => item.department === user.department);
  if (user.role === 'Supplier') {
    if (!user.supplierId) return [];
    const supplier = DB.suppliers.find(item => item.id === user.supplierId);
    if (!supplier) return []; // Fail closed if the supplier profile is unavailable.
    return DB.deliveries.filter(item => item.supplierId
      ? item.supplierId === user.supplierId
      : item.supplierName === supplier.name);
  }
  return DB.deliveries;
}
