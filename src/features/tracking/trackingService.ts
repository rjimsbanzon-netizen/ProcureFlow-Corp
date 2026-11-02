import { formatQuantity } from '../../domain/measurementUnits';
import { DB } from '../../store/state';
import { ownsRequisition } from '../../domain/ownerIdentity';
import type { ProcurementRecord, ProcurementState, User } from '../../types/procurement';

export type TrackingStageStatus = 'complete' | 'current' | 'upcoming' | 'blocked' | 'not-recorded';
export interface TrackingStage {
  id: string;
  title: string;
  detail: string;
  status: TrackingStageStatus;
  reference?: string;
  date?: string;
}
export interface ProcurementJourney {
  pr: ProcurementRecord;
  need?: ProcurementRecord;
  bid?: ProcurementRecord;
  order?: ProcurementRecord;
  deliveries: ProcurementRecord[];
  payment?: ProcurementRecord;
  stages: TrackingStage[];
  progress: number;
}

function owned(pr: ProcurementRecord, user: User): boolean {
  return ownsRequisition(pr, user);
}

/** Keep supplier access scoped to its own awarded purchase orders. */
export function getTrackableRequisitions(state: ProcurementState = DB, user: User | null = state.currentUser): ProcurementRecord[] {
  if (!user) return [];
  if (user.role === 'Employee') return state.requisitions.filter(pr => owned(pr, user));
  if (user.role === 'Supplier') {
    if (!user.supplierId) return [];
    const myPRs = new Set(state.orders.filter(order => order.supplierId === user.supplierId).map(order => order.prId));
    return state.requisitions.filter(pr => myPRs.has(pr.id));
  }
  return state.requisitions;
}

/** A transaction timeline is calculated from the existing PR → need → bid → PO → delivery → payment relations. */
export function getProcurementJourney(prId: string, state: ProcurementState = DB, user: User | null = state.currentUser): ProcurementJourney | null {
  const pr = getTrackableRequisitions(state, user).find(record => record.id === prId);
  if (!pr) return null;

  const need = state.stockNeeds.find(record => record.prId === pr.id);
  const order = state.orders.find(record => record.prId === pr.id);
  const bid = state.bids.find(record => record.id === (need?.selectedBidId || order?.bidId));
  const deliveries = order ? state.deliveries.filter(record => record.poId === order.id) : [];
  const payments = order ? state.payments.filter(record => record.poId === order.id) : [];
  const payment = payments.find(record => record.status === 'Paid') || payments[0];
  const completeQty = deliveries
    .filter(record => record.complianceStatus === 'Completed - Verified')
    .reduce((sum, record) => sum + Number(record.deliveredQty || 0), 0);
  const fullyVerified = Boolean(order && deliveries.length &&
    deliveries.every(record => record.complianceStatus === 'Completed - Verified') &&
    completeQty >= Number(order.quantity));
  const approval = pr.status !== 'Pending' && pr.status !== 'Rejected';
  const rejected = pr.status === 'Rejected';
  const sourcingRecorded = Boolean(need || bid);
  const sourcingComplete = Boolean(bid?.status === 'Selected' || need?.selectedBidId);

  const stages: TrackingStage[] = [
    {
      id: 'request', title: 'Purchase requisition submitted', detail: `${pr.requestedBy || 'Employee'} · ${pr.department || 'Department not specified'}`,
      status: 'complete', reference: pr.id, date: pr.createdAt
    },
    {
      id: 'approval', title: 'Requisition approval',
      detail: rejected ? 'Request rejected' : approval ? 'Request approved' : 'Awaiting an authorized approver',
      status: rejected ? 'blocked' : approval ? 'complete' : 'current', reference: pr.id
    },
    {
      id: 'sourcing', title: 'Sourcing & supplier selection',
      detail: sourcingComplete ? `Selected: ${bid?.supplierName || 'Supplier recorded'}` :
        need ? `${need.title || need.id} · ${need.status || 'Published'}` :
        order ? 'No bidding record linked to this historical order' : 'Procurement need not yet published',
      status: sourcingComplete ? 'complete' : order && !sourcingRecorded ? 'not-recorded' :
        rejected ? 'upcoming' : need ? 'current' : approval ? 'current' : 'upcoming',
      reference: bid?.id || need?.id, date: need?.createdAt
    },
    {
      id: 'order', title: 'Purchase order issued', detail: order ? `${order.id} · ${order.supplierName || 'Supplier'}` : 'Waiting for final supplier agreement',
      status: order ? 'complete' : 'upcoming', reference: order?.id, date: order?.poDate
    },
    {
      id: 'delivery', title: 'Delivery & inspection',
      detail: fullyVerified ? `All ${formatQuantity(completeQty, order?.unit || pr.unit)} inspected and verified` : deliveries.length ?
        `${formatQuantity(completeQty, order?.unit || pr.unit)} verified out of ${formatQuantity(order?.quantity, order?.unit || pr.unit)} ordered · inspection in progress` : 'No delivery inspection recorded yet',
      status: fullyVerified ? 'complete' : order ? 'current' : 'upcoming',
      reference: deliveries[0]?.id, date: deliveries[0]?.actualDate
    },
    {
      id: 'payment', title: 'Payment completed',
      detail: payment?.status === 'Paid' ? `${payment.id} · Payment confirmed` : payment ?
        `${payment.id} · ${payment.status}` : 'Payment not yet recorded',
      status: payment?.status === 'Paid' ? 'complete' : fullyVerified ? 'current' : 'upcoming',
      reference: payment?.id, date: payment?.paymentDate
    }
  ];

  const scored = stages.filter(stage => stage.status !== 'not-recorded');
  const progress = Math.round((scored.filter(stage => stage.status === 'complete').length / scored.length) * 100);
  return { pr, need, bid, order, deliveries, payment, stages, progress };
}
