import type { QuantityUnit } from '../domain/measurementUnits';
import type { ProcurementPriority, PurchaseCategory, ProcurementRecurrence } from '../domain/procurementClassification';
export type Role = 'Admin' | 'Procurement Head' | 'Procurement Officer' | 'Operations Officer' | 'Employee' | 'Supplier';
export type PermissionRole = Exclude<Role, 'Operations Officer'> | 'Department Head' | 'Finance Officer' | 'Finance Head';
export type Permission =
  | 'create_pr' | 'approve_pr' | 'record_delivery' | 'manage_delivery_issues'
  | 'approve_amendment' | 'process_payment' | 'confirm_payment'
  | 'manage_users' | 'manage_suppliers' | 'rate_supplier'
  | 'manage_permissions' | 'view_all_po' | 'manage_bidding'
  | 'view_assigned_po' | 'view_supplier_portal' | 'submit_bids';

export interface User {
  id: string;
  username: string;
  usernameAliases?: string[];
  nameAliases?: string[];
  requestedPosition?: string;
  name: string;
  role: Role;
  department: string;
  status: string;
  email?: string;
  supplierId?: string | null;
  companyName?: string;
  accessRevoked?: boolean;
  password?: string; // Local demo mode only; do not store real passwords client-side.
}
export interface ProcurementRecord {
  id: string;
  [field: string]: any;
}
/** Gradually adopted normalized record contracts. Old fields remain available via
 * ProcurementRecord until legacy HTML-string modules are retired. */
export interface RequisitionRecord extends ProcurementRecord {
  department: string;
  itemTitle: string;
  specs: string;
  status: string;
  quantity: number;
  unit?: QuantityUnit;
  unitPrice: number;
  totalCost: number;
  requestedBy: string;
  requestedByUsername?: string;
  targetDate?: string;
  createdAt?: string;
  remarks?: string;
  priority?: ProcurementPriority;
  priorityName?: string;
  purchaseCategory?: PurchaseCategory;
  recurrence?: ProcurementRecurrence;
}
export interface OrderRecord extends ProcurementRecord {
  prId: string;
  supplierId: string;
  supplierName: string;
  department: string;
  itemTitle: string;
  quantity: number;
  unit?: QuantityUnit;
  totalCost: number;
  status: string;
  poDate?: string;
  expectedDate?: string;
  signedBy?: string;
  specs?: string;
  bidId?: string;
  priority?: ProcurementPriority;
  priorityName?: string;
  purchaseCategory?: PurchaseCategory;
  recurrence?: ProcurementRecurrence;
  type?: string;
}
export interface BidRecord extends ProcurementRecord {
  needId: string;
  supplierId: string;
  supplierName: string;
  status: string;
  unitPrice: number;
  totalCost: number;
  leadTimeDays?: number;
  submittedAt?: string;
}
export interface DeliveryRecord extends ProcurementRecord {
  poId: string;
  supplierName: string;
  department: string;
  itemTitle: string;
  complianceStatus: string;
  orderedQty: number;
  deliveredQty: number;
  unit?: QuantityUnit;
  expectedDate?: string;
  actualDate?: string;
  specs?: string;
  supplierId?: string;
}
export interface SupplierRecord extends ProcurementRecord {
  name: string;
  category?: string;
  email?: string;
  phone?: string;
  contact?: string;
  status?: string;
}
export interface PaymentRecord extends ProcurementRecord {
  poId: string;
  status: string;
  paymentAmount?: number;
}
/** Contracts and invoices are fetched through separate secured cloud APIs. */
export interface ContractRecord extends ProcurementRecord {
  supplier_id?: string;
  po_id?: string | null;
  bid_id?: string | null;
  status: 'Draft' | 'Active' | 'Expired' | 'Terminated' | string;
  starts_on?: string;
  ends_on?: string;
  negotiated_price?: number;
}
export interface InvoiceRecord extends ProcurementRecord {
  poId?: string;
  supplierId?: string;
  amount?: number;
  status?: string;
}
export interface ProcurementState {
  currentUser: User | null;
  nonAdminUsersPruned: boolean;
  permissions: Record<PermissionRole, string[]>;
  users: User[];
  stockNeeds: ProcurementRecord[];
  bids: BidRecord[];
  proposalMeetings: ProcurementRecord[];
  requisitions: RequisitionRecord[];
  orders: OrderRecord[];
  deliveries: DeliveryRecord[];
  amendments: ProcurementRecord[];
  payments: PaymentRecord[];
  suppliers: SupplierRecord[];
  ratings: ProcurementRecord[];
  auditLogs: ProcurementRecord[];
  accessControl?: ProcurementRecord[];
}
export type Tab = 'dashboard' | 'requisitions' | 'bidding' | 'orders' | 'delivery'
  | 'amendments' | 'payments' | 'suppliers' | 'audit' | 'users' | 'access_control'
  | 'notifications' | 'tracking' | 'documents' | 'pdf_generator'
  | 'bidding_deadlines' | 'bid_comparison' | 'bid_evaluation' | 'proposal_meetings'
  | 'global_search' | 'approval_delegation' | 'contracts' | 'supplier_analytics'
  | 'operations_materials';
