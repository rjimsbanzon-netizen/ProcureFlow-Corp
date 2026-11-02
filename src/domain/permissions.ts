// @ts-nocheck
import { DB } from '../store/state';
import { getCachedStaffAssignments, isFinanceDepartment } from './staffPositions';
import { DEFAULT_MATRIX, fixedValue, type MatrixRole } from './accessMatrix';
import { resolvePermissionRole } from './permissionResolution';
import { actingResponsibility } from './effectiveDelegation';
import { CLOUD_API_BASE } from '../services/cloud';

// Migrated from enterprise.html. Business rules / markup preserved.
/** Active permissions follow the appointed role, not just the stored Employee account type. */
export function getCurrentPermissionRole():MatrixRole | null {
    const user = DB.currentUser;
    return resolvePermissionRole(user, user ? getCachedStaffAssignments(user.id) : [], isFinanceDepartment);
}
export function hasPermission(action) {
    // A delegation grants only the approvals and payment functions that the
    // Worker validates for the delegated responsibility. It must NOT cause a
    // general role promotion (e.g. bidding, account admin, or supplier access).
    if ((action === 'process_payment' || action === 'confirm_payment') &&
        (actingResponsibility('Finance Officer') || actingResponsibility('Finance Head')))
        return true; // PO threshold and authority are rechecked by /finance/payment-authority.
    if (action === 'approve_pr' && actingResponsibility('Procurement Head'))
        return true; // Assigned PR step is still verified by /finance/approvals/:id/decision.
    const role=getCurrentPermissionRole();
    if(!role)return false;
    const locked=fixedValue(role,action);
    if(locked!==null)return locked;
    const perms=DB.permissions[role]||DEFAULT_MATRIX[role]||[];
    return perms.includes(action);
}

export function canAccessTab(tab) {
    if (!DB.currentUser) return false;
    const isSupplier = DB.currentUser.role === 'Supplier';
    switch (tab) {
        case 'dashboard': return !isSupplier || hasPermission('view_supplier_portal');
        case 'notifications': return true;
        case 'my_profile':
        case 'people_directory':
        case 'people_messages': return true;
        case 'global_search': return !isSupplier;
        case 'supplier_analytics': return isSupplier || ['Admin','Procurement Head','Procurement Officer'].includes(getCurrentPermissionRole() || '');
        case 'approval_delegation': return !isSupplier;
        case 'contracts': return isSupplier || ['Admin','Procurement Head','Procurement Officer','Finance Officer','Finance Head'].includes(getCurrentPermissionRole() || '');
        case 'approvals': return !isSupplier;
        case 'budgets': return ['Admin','Department Head','Procurement Head','Finance Officer','Finance Head'].includes(getCurrentPermissionRole() || '');
        case 'reports': return !isSupplier;
        case 'delivery_discrepancies': return true; // supplier only sees its own issues in D1
        case 'inventory': return !isSupplier;
        case 'supplier_inventory': return isSupplier || ['Admin','Procurement Head','Procurement Officer'].includes(getCurrentPermissionRole() || '');
        case 'supply_planning': return !isSupplier && ['Admin','Procurement Head','Procurement Officer'].includes(getCurrentPermissionRole() || '');
        case 'invoice_matching': return true;
        case 'supplier_messages': return isSupplier || ['Admin','Procurement Head','Procurement Officer'].includes(DB.currentUser.role);
        case 'accreditation': return isSupplier || ['Admin','Procurement Head'].includes(DB.currentUser.role);
        case 'staff_assignments': return DB.currentUser.role === 'Admin';
        case 'documents':
        case 'pdf_generator': return true;
        case 'tracking': return isSupplier ? hasPermission('view_assigned_po') : hasPermission('create_pr') || hasPermission('approve_pr') || hasPermission('view_all_po');
        case 'bidding': return isSupplier ? hasPermission('submit_bids') : canManageBidding();
        case 'proposal_meetings': return isSupplier ? hasPermission('submit_bids') : canManageBidding();
        case 'bid_comparison': return ['Admin','Procurement Head'].includes(DB.currentUser.role);
        case 'bidding_deadlines':
        case 'bid_evaluation': return canManageBidding();
        case 'requisitions': return hasPermission('create_pr') || hasPermission('approve_pr');
        case 'orders': return hasPermission(isSupplier ? 'view_assigned_po' : 'view_all_po');
        case 'delivery':
            return isSupplier
                ? hasPermission('view_assigned_po')
                : hasPermission('view_all_po') || hasPermission('record_delivery') || canManageDeliveryIssues();
        case 'amendments':
            return isSupplier
                ? hasPermission('view_assigned_po')
                : canManageDeliveryIssues() || canApproveAmendments();
        case 'payments':
            // Finance colleagues may view the payment page even before the
            // short-lived acting-role cache has loaded. Only the Worker's
            // /finance/payment-authority decision can enable disbursement.
            return isSupplier ? hasPermission('view_assigned_po')
                : ['Admin','Procurement Head','Procurement Officer'].includes(DB.currentUser.role) ||
                  hasPermission('process_payment') || hasPermission('confirm_payment') ||
                  Boolean(CLOUD_API_BASE && DB.currentUser.status === 'Active' &&
                    isFinanceDepartment(DB.currentUser.department));
        case 'suppliers': return hasPermission('manage_suppliers') || hasPermission('rate_supplier');
        case 'audit': return DB.currentUser.role === 'Admin';
        case 'users': return DB.currentUser.role === 'Admin' && hasPermission('manage_users');
        case 'access_control': return DB.currentUser.role === 'Admin';
        default: return false;
    }
}


export function canManageBidding() {
    return ['Admin', 'Procurement Head'].includes(DB.currentUser?.role) && hasPermission('manage_bidding');
}


export function getAgreementFinalizationError(bidId) {
    if (!canManageBidding()) return 'Only the Procurement Head or Admin can finalize supplier agreements.';

    const bid = DB.bids.find(item => item.id === bidId);
    if (!bid) return 'The selected supplier bid could not be found.';

    const need = DB.stockNeeds.find(item => item.id === bid.needId);
    if (!need) return 'The procurement need linked to this bid could not be found.';

    const pr = DB.requisitions.find(item => item.id === need.prId);
    if (!pr) return 'The approved Purchase Requisition linked to this need could not be found.';

    if (DB.orders.some(order => order.bidId === bid.id)) {
        return `A Purchase Order has already been issued for bid ${bid.id}.`;
    }
    if (pr.status !== 'Approved') {
        return `Purchase Requisition ${pr.id} is "${pr.status}". It must be Approved before a Purchase Order can be issued.`;
    }
    if (need.selectedBidId !== bid.id) {
        return 'This bid is not the supplier currently selected for the procurement need.';
    }
    if (need.status !== 'Supplier Selected') {
        return `The procurement need is "${need.status}". It must be in Supplier Selected status before finalizing.`;
    }
    if (bid.status !== 'Selected') {
        return `The bid is "${bid.status}". Select this supplier before finalizing the agreement.`;
    }

    const meeting = DB.proposalMeetings.find(item => item.bidId === bid.id);
    if (meeting?.status !== 'Agreed') {
        return 'The selected supplier must agree to the proposal meeting before the agreement can be finalized.';
    }

    return null;
}


export function canManageDeliveryIssues() {
    return ['Admin', 'Procurement Head'].includes(DB.currentUser?.role) &&
        hasPermission('manage_delivery_issues');
}


export function canApproveAmendments() {
    return ['Admin', 'Procurement Head'].includes(DB.currentUser?.role) &&
        hasPermission('approve_amendment');
}
