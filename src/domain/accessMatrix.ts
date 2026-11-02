/** ProcureFlow access-control catalogue.
 * The underlying login role is separate from the appointed responsibility.
 * Workflow-controlled rights are advisory displays, not bypassable checkboxes.
 */
export const MATRIX_ROLES = [
  'Admin', 'Procurement Head', 'Procurement Officer', 'Department Head',
  'Employee', 'Finance Officer', 'Finance Head', 'Supplier'
] as const;
export type MatrixRole = typeof MATRIX_ROLES[number];
export const LEGACY_PERMISSIONS = [
  'create_pr', 'approve_pr', 'manage_suppliers', 'manage_bidding',
  'record_delivery', 'manage_delivery_issues', 'approve_amendment',
  'process_payment', 'confirm_payment', 'rate_supplier', 'manage_users',
  'manage_permissions', 'view_all_po', 'view_assigned_po',
  'view_supplier_portal', 'submit_bids'
] as const;
export type MatrixPermission = typeof LEGACY_PERMISSIONS[number];
type MatrixRow = { key:string; label:string; info?:string; system?:boolean };
export type MatrixGroup = { title:string; rows:MatrixRow[] };

export const MATRIX_GROUPS:MatrixGroup[] = [
  {title:'Overview & tracking',rows:[
    {key:'view_dashboard',label:'View dashboard',system:true,info:'Available to approved staff and suppliers for their respective portal.'},
    {key:'view_notifications',label:'View own notifications and conversation alerts',system:true,info:'Alerts and read status are scoped to each authenticated account.'},
    {key:'view_tracking',label:'View procurement or assigned order tracking',system:true,info:'Transactions are filtered by account and workflow permissions.'}
  ]},
  {title:'Requisitions, approvals & budgets',rows:[
    {key:'create_pr',label:'Create Purchase Requisitions'},
    {key:'head_submit',label:'Submit department request',system:true,info:'Only the assigned Department Head may submit their department’s PR.'},
    {key:'approve_pr',label:'Approve / reject procurement requisitions',info:'Procurement Head / Admin stage; actual approval uses the assigned step and prevents self-approval.'},
    {key:'finance_pr_review',label:'Review assigned Finance Officer approval step',system:true,info:'Only the currently appointed Finance Officer, and only when the amount meets configured rules.'},
    {key:'finance_head_pr_review',label:'Authorize high-value Finance Head approval',system:true,info:'Only the separately appointed Finance Head, for amounts meeting the Finance Head threshold.'},
    {key:'manage_budget',label:'Set budgets and amount thresholds',system:true,info:'Admin-controlled financial settings.'},
    {key:'assign_staff',label:'Manage staff assignments and departments',system:true,info:'Admin-only assignment directory.'}
  ]},
  {title:'Sourcing & supplier management',rows:[
    {key:'manage_suppliers',label:'Manage supplier directory'},
    {key:'supplier_accreditation',label:'Submit accreditation documents',system:true,info:'Supplier may submit only their own business documents.'},
    {key:'review_accreditation',label:'Review supplier accreditation',system:true,info:'Authorized Procurement Head or Admin, subject to server validation.'},
    {key:'manage_bidding',label:'Manage bidding, deadlines and meetings'},
    {key:'submit_bids',label:'Submit supplier quotations'},
    {key:'evaluate_quotations',label:'Evaluate supplier quotations',system:true,info:'Procurement reviewers assess compliance; bidding permissions and assigned roles still apply.'},
    {key:'supplier_messaging',label:'Supplier and procurement messaging',system:true,info:'Available only to participants authorized for each transaction.'}
  ]},
  {title:'Purchase orders, deliveries & issues',rows:[
    {key:'view_all_po',label:'View all purchase orders'},
    {key:'view_assigned_po',label:'View assigned supplier orders'},
    {key:'record_delivery',label:'Record and inspect deliveries'},
    {key:'manage_delivery_issues',label:'Resolve shortages or damaged goods'},
    {key:'approve_amendment',label:'Approve order amendments'},
    {key:'rate_supplier',label:'Rate supplier performance'}
  ]},
  {title:'Invoices, payments & financial control',rows:[
    {key:'submit_invoice',label:'Submit supplier invoice',system:true,info:'Supplier only, for an assigned Purchase Order.'},
    {key:'match_invoice',label:'Confirm PO / receipt / invoice match',system:true,info:'Assigned Finance Officer reviews; only after document and delivery checks.'},
    {key:'process_payment',label:'Process verified payment',info:'Finance Officer below the Finance Head threshold; Finance Head at/above threshold. Assignment and PO value checked by server.'},
    {key:'confirm_payment',label:'Confirm completed disbursement',info:'Protected by the same Finance assignment and amount threshold as payment processing.'},
    {key:'view_payment',label:'View payment status',system:true,info:'Authorized staff see status; suppliers see their own payments only.'}
  ]},
  {title:'Documents, accounts & administration',rows:[
    {key:'view_supplier_portal',label:'Access supplier portal'},
    {key:'manage_documents',label:'Upload, view and download documents',system:true,info:'Access follows each document’s transaction and authenticated owner.'},
    {key:'generate_pdf',label:'Generate procurement PDFs',system:true,info:'Requires access to the related transaction.'},
    {key:'manage_users',label:'Verify, revoke or remove accounts'},
    {key:'manage_permissions',label:'Edit access control matrix'},
    {key:'view_audit',label:'View complete audit log',system:true,info:'Admin-only audit records.'}
  ]}
];

/** Defaults are conservative. Finance responsibilities are NOT general Employee rights. */
export const DEFAULT_MATRIX:Record<MatrixRole,string[]> = {
  'Admin': ['create_pr','approve_pr','manage_suppliers','manage_bidding','record_delivery','manage_delivery_issues','approve_amendment','rate_supplier','manage_users','manage_permissions','view_all_po'],
  'Procurement Head': ['create_pr','approve_pr','manage_suppliers','manage_bidding','record_delivery','manage_delivery_issues','approve_amendment','rate_supplier','view_all_po'],
  'Procurement Officer': ['create_pr','manage_suppliers','record_delivery','rate_supplier','view_all_po'],
  'Department Head': ['create_pr'],
  'Employee': ['create_pr'],
  'Finance Officer': ['process_payment','confirm_payment','view_all_po'],
  'Finance Head': ['process_payment','confirm_payment','view_all_po'],
  'Supplier': ['view_assigned_po','view_supplier_portal','submit_bids']
};

const ALWAYS_ROLE:Partial<Record<MatrixPermission,readonly MatrixRole[]>> = {
  manage_users:['Admin'], manage_permissions:['Admin'],
  process_payment:['Finance Officer','Finance Head'],
  confirm_payment:['Finance Officer','Finance Head'],
  view_supplier_portal:['Supplier'], submit_bids:['Supplier'],
  view_assigned_po:['Supplier'],
  approve_pr:['Admin','Procurement Head'],
  manage_bidding:['Admin','Procurement Head'],
  manage_delivery_issues:['Admin','Procurement Head'],
  approve_amendment:['Admin','Procurement Head'],
  record_delivery:['Admin','Procurement Head','Procurement Officer'],
  create_pr:['Admin','Procurement Head','Procurement Officer','Department Head','Employee'],
  manage_suppliers:['Admin','Procurement Head','Procurement Officer'],
  rate_supplier:['Admin','Procurement Head','Procurement Officer']
};
export function permissible(role:MatrixRole,key:string):boolean {
  const restricted=ALWAYS_ROLE[key as MatrixPermission];
  return !restricted || restricted.includes(role);
}
/** Position / finance / account security checks cannot be switched off or granted to an ineligible role. */
export function fixedValue(role:MatrixRole,key:string):boolean|null {
  if (key==='process_payment'||key==='confirm_payment') return role==='Finance Officer'||role==='Finance Head';
  if (key==='manage_users'||key==='manage_permissions')return role==='Admin';
  return permissible(role,key)?null:false;
}
export function normalizeMatrix(input:Record<string,unknown>|null|undefined):Record<MatrixRole,string[]> {
  const result={} as Record<MatrixRole,string[]>;
  for (const role of MATRIX_ROLES) {
    const incoming=input?.[role];
    const proposed=Array.isArray(incoming)?incoming:DEFAULT_MATRIX[role];
    const enabled=new Set(proposed.filter((p):p is string=>typeof p==='string'));
    result[role]=LEGACY_PERMISSIONS.filter(key=>{
      const locked=fixedValue(role,key);
      return locked!==null?locked:enabled.has(key);
    });
  }
  return result;
}
/** Workflow rows describe actual server-side conditions; this is NOT a permission grant. */
export function workflowRoleChecked(key:string,role:MatrixRole):boolean {
  const allowed:Record<string,MatrixRole[]>={
    view_dashboard:[...MATRIX_ROLES],view_notifications:[...MATRIX_ROLES],view_tracking:[...MATRIX_ROLES],
    finance_pr_review:['Finance Officer'],finance_head_pr_review:['Finance Head'],
    head_submit:['Department Head'],manage_budget:['Admin'],assign_staff:['Admin'],
    supplier_accreditation:['Supplier'],review_accreditation:['Admin','Procurement Head'],
    evaluate_quotations:['Admin','Procurement Head'],supplier_messaging:['Admin','Procurement Head','Procurement Officer','Supplier'],
    submit_invoice:['Supplier'],match_invoice:['Finance Officer','Finance Head'],
    view_payment:['Admin','Procurement Head','Procurement Officer','Finance Officer','Finance Head','Supplier'],
    manage_documents:[...MATRIX_ROLES],generate_pdf:[...MATRIX_ROLES],view_audit:['Admin']
  };
  return (allowed[key]||[]).includes(role);
}
