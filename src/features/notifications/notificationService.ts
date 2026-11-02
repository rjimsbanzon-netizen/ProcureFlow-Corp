import { ownsRequisition } from '../../domain/ownerIdentity';
import { DB } from '../../store/state';
import { getDeadline } from '../../services/sourcing';
import type { ProcurementRecord, ProcurementState, User } from '../../types/procurement';
import { getCloudNotificationSnapshot, getCloudMessageAlerts, getCloudDirectMessageAlerts, getCloudContractAlerts, getCloudDelegationAlerts, getCloudReadIds, queueCloudNotificationRead } from './cloudNotificationSync';

/**
 * Notifications are derived from existing procurement records.
 * This keeps the starter compatible with the current Cloudflare D1 schema.
 * Cloud mode syncs read/unread state in D1 and polls the shared workspace.
 * Local demo mode keeps browser-local read state.
 */
export type NotificationKind = 'info' | 'success' | 'warning' | 'action';

export interface ProcurementNotification {
  id: string;
  title: string;
  description: string;
  createdAt?: string;
  kind: NotificationKind;
  targetTab: string;
  targetRecordId?: string;
  messageContext?: string;
  /** True for past audit events. History is not an outstanding unread alert. */
  historical?: boolean;
}

const KEY_PREFIX = 'procureflow_read_notifications_v1_';
const asString = (value: unknown): string => typeof value === 'string' ? value : '';
const isOwner = (record: ProcurementRecord, user: User) => ownsRequisition(record,user);

function userKey(user: User): string {
  return `${KEY_PREFIX}${encodeURIComponent(String(user.id || user.username))}`;
}

function readIds(user: User): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(userKey(user)) || '[]');
    return new Set([...(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []), ...getCloudReadIds(user)]);
  } catch {
    return new Set(getCloudReadIds(user));
  }
}

export function markNotificationRead(notificationId: string, user = DB.currentUser): void {
  if (!user || notificationId.startsWith('history:')) return;
  const read = readIds(user);
  read.add(notificationId);
  try { localStorage.setItem(userKey(user), JSON.stringify([...read].slice(-2000))); }
  catch { /* Storage may be unavailable in restricted browsing contexts. */ }
  queueCloudNotificationRead([notificationId], user);
}

/** Opening a conversation marks the messages actually loaded into that thread as read. */
export function markMessageNotificationsRead(messageIds: string[], user = DB.currentUser): void {
  if (!user || !messageIds.length) return;
  const alreadyRead = readIds(user);
  const ids = [...new Set(messageIds.filter(Boolean).map(id => `message:${id}`))]
    .filter(id => !alreadyRead.has(id));
  if (!ids.length) return;
  ids.forEach(id => alreadyRead.add(id));
  try { localStorage.setItem(userKey(user), JSON.stringify([...alreadyRead].slice(-2000))); }
  catch { /* Browser storage unavailable; D1 receipts still sync. */ }
  queueCloudNotificationRead(ids, user);
}

export function markAllNotificationsRead(notifications: ProcurementNotification[], user = DB.currentUser): void {
  if (!user) return;
  const current = notifications.filter(notification => !notification.historical);
  if (!current.length) return;
  const read = readIds(user);
  current.forEach(notification => read.add(notification.id));
  try { localStorage.setItem(userKey(user), JSON.stringify([...read].slice(-2000))); }
  catch { /* No persistent read flags when storage is disabled. */ }
  queueCloudNotificationRead(current.map(notification => notification.id), user);
}

export function isNotificationRead(notification: ProcurementNotification, user = DB.currentUser): boolean {
  return notification.historical || Boolean(user && readIds(user).has(notification.id));
}

export function getUnreadCount(notifications: ProcurementNotification[], user = DB.currentUser): number {
  if (!user) return 0;
  const read = readIds(user);
  return notifications.filter(notification => !notification.historical && !read.has(notification.id)).length;
}

function sorted(notifications: ProcurementNotification[]): ProcurementNotification[] {
  return [...new Map(notifications.map(notification => [notification.id, notification])).values()]
    .sort((a, b) => (b.createdAt || '').replace(' ', 'T').localeCompare((a.createdAt || '').replace(' ', 'T')));
}

/**
 * Persistent activity history from the already-synced audit log. Audit entries
 * are only displayed when the relevant record is visible to this user.
 * This reconstructs historical events without requiring a Worker migration.
 * Older events cannot be reconstructed once the underlying audit log is deleted.
 */
function historyFromAudit(state: ProcurementState, user: User): ProcurementNotification[] {
  const entries = Array.isArray(state.auditLogs) ? state.auditLogs : [];
  const admin = user.role === 'Admin';
  const manager = user.role === 'Procurement Head';
  const officer = user.role === 'Procurement Officer';
  const employee = user.role === 'Employee';
  const supplier = user.role === 'Supplier';

  // Explicit allowlist; authentication, passwords, access settings and other
  // administrative audit details must never leak to supplier/staff feeds.
  const events: Record<string, { title: string; tab: string; kind: NotificationKind; category: string }> = {
    'PR Created': { title: 'Requisition submitted', tab: 'requisitions', kind: 'info', category: 'pr' },
    'PR Approved': { title: 'Requisition approved', tab: 'requisitions', kind: 'success', category: 'pr' },
    'PR Rejected': { title: 'Requisition rejected', tab: 'requisitions', kind: 'warning', category: 'pr' },
    'Stock Need Published': { title: 'Stock need published', tab: 'bidding', kind: 'info', category: 'need' },
    'Bid Submitted': { title: 'Supplier bid submitted', tab: supplier ? 'bidding' : 'bid_comparison', kind: 'info', category: 'need' },
    'Supplier Selected': { title: 'Supplier selected', tab: supplier ? 'bidding' : 'bid_comparison', kind: 'success', category: 'need' },
    'Supplier Bid Evaluated': { title: 'Bid evaluation recorded', tab: 'bid_evaluation', kind: 'info', category: 'bid' },
    'Proposal Meeting Scheduled': { title: 'Proposal meeting scheduled', tab: 'proposal_meetings', kind: 'info', category: 'meeting' },
    'Proposal Meeting Rescheduled': { title: 'Proposal meeting rescheduled', tab: 'proposal_meetings', kind: 'warning', category: 'meeting' },
    'Meeting Reschedule Requested': { title: 'Supplier requested a meeting change', tab: 'proposal_meetings', kind: 'action', category: 'meeting' },
    'Meeting Reschedule Approved': { title: 'Meeting change approved', tab: 'proposal_meetings', kind: 'success', category: 'meeting' },
    'Meeting Reschedule Rejected': { title: 'Meeting change declined', tab: 'proposal_meetings', kind: 'warning', category: 'meeting' },
    'Proposal Meeting Cancelled': { title: 'Proposal meeting cancelled', tab: 'proposal_meetings', kind: 'warning', category: 'meeting' },
    'Meeting Response': { title: 'Meeting response received', tab: 'proposal_meetings', kind: 'info', category: 'meeting' },
    'PO Issued': { title: 'Purchase order issued', tab: 'orders', kind: 'info', category: 'po' },
    'PO Signed by Supplier': { title: 'Purchase order signed', tab: 'orders', kind: 'success', category: 'po' },
    'Delivery Recorded': { title: 'Delivery recorded', tab: 'delivery', kind: 'info', category: 'delivery' },
    'Delivery Inspected': { title: 'Delivery inspection recorded', tab: 'delivery', kind: 'success', category: 'delivery' },
    'Amendment Issued': { title: 'Amendment issued', tab: 'amendments', kind: 'warning', category: 'amendment' },
    'Amendment Approved': { title: 'Amendment approved', tab: 'amendments', kind: 'success', category: 'amendment' },
    'Amendment Rejected': { title: 'Amendment rejected', tab: 'amendments', kind: 'warning', category: 'amendment' },
    'Supplier Amendment Response': { title: 'Supplier responded to amendment', tab: 'amendments', kind: 'info', category: 'amendment' },
    'Disbursement Completed': { title: 'Payment completed', tab: 'payments', kind: 'success', category: 'payment' },
    'Supplier Evaluated': { title: 'Supplier evaluation recorded', tab: 'suppliers', kind: 'info', category: 'supplier' },
  };
  const categories: Record<string, string> = { pr: 'PR', need: 'SN', bid: 'BID', meeting: 'MTG',
    po: 'PO', delivery: 'DEL', amendment: 'AMD', payment: 'PAY', supplier: 'sup' };
  const records: Record<string, ProcurementRecord[]> = {
    pr: state.requisitions, need: state.stockNeeds, bid: state.bids,
    meeting: state.proposalMeetings, po: state.orders, delivery: state.deliveries,
    amendment: state.amendments, payment: state.payments, supplier: state.suppliers
  };
  const findOrder = (poId: string | undefined) => state.orders.find(o => o.id === poId);
  const linkedSupplier = (category: string, record: ProcurementRecord) => {
    if (category === 'po') return record.supplierId;
    if (category === 'delivery' || category === 'amendment' || category === 'payment') return findOrder(record.poId)?.supplierId;
    if (category === 'meeting') return record.supplierId;
    if (category === 'bid') return record.supplierId;
    if (category === 'supplier') return record.id;
    if (category === 'need') return null;
    return null;
  };
  return entries.flatMap((entry) => {
    const event = events[asString(entry.action)];
    if (!event || !asString(entry.details)) return [];
    const { category } = event;
    const expectedPrefix = categories[category];
    const pattern = new RegExp('\\b' + expectedPrefix + '-[a-zA-Z0-9_-]+\\b', 'i');
    const reference = asString(entry.details).match(pattern)?.[0] || '';
    const record = records[category]?.find(r => asString(r.id).toLowerCase() === reference.toLowerCase());

    // Except for a published stock need, do not show details of deleted or
    // unrelated business records to a non-Admin.
    if (!admin && !record) return [];
    if (employee) {
      if (category !== 'pr' || !record || !isOwner(record, user)) return [];
    } else if (supplier) {
      if (category === 'need') {
        if (entry.action !== 'Stock Need Published' || !record ||
          (record.status !== 'Published' && !state.bids.some(b => b.needId === record.id && b.supplierId === user.supplierId))) return [];
      } else if (!record || !user.supplierId || linkedSupplier(category, record) !== user.supplierId) {
        return [];
      }
      // Do not reveal evaluations or supplier-internal activity.
      if (entry.action === 'Supplier Bid Evaluated' || entry.action === 'Supplier Evaluated') return [];
    } else if (officer && !['pr', 'po', 'delivery', 'amendment', 'payment'].includes(category)) {
      return [];
    } else if (!admin && !manager && !officer) {
      return [];
    }

    // For supplier/employee users, use a generic description based on their
    // own related record; do not expose free-text internal audit comments.
    const description = admin || manager || officer
      ? asString(entry.details)
      : `${reference} · ${event.title}.`;
    const id = asString(entry.id) || `${asString(entry.timestamp)}:${asString(entry.action)}:${asString(entry.details)}`;
    return [{
      id: `history:${id}:${asString(entry.action)}`,
      title: event.title,
      description,
      createdAt: asString(entry.timestamp),
      kind: event.kind,
      targetTab: event.tab,
      targetRecordId: record?.id || reference || undefined,
      historical: true,
    }];
  });
}

/** Resolve alerts for the logged-in user's authorized slice of procurement data. */
export function getNotifications(state: ProcurementState = DB, user: User | null = state.currentUser): ProcurementNotification[] {
  if (!user) return [];
  // When online, prefer the latest D1-backed snapshot for cross-device notifications.
  // This is read-only: never replace DB while someone is editing a form.
  const live = getCloudNotificationSnapshot(user);
  if (live && state === DB) state = { ...state, ...live };
  const result: ProcurementNotification[] = [];
  const add = (notification: ProcurementNotification) => result.push(notification);
  const supplier = user.role === 'Supplier';
  const employee = user.role === 'Employee';
  const approver = user.role === 'Admin' || user.role === 'Procurement Head';
  const procurement = approver || user.role === 'Procurement Officer';
  const supplierId = user.supplierId;

  if (employee) {
    state.requisitions.filter(pr => isOwner(pr, user)).forEach(pr => {
      const status = asString(pr.status);
      if (!['Approved', 'Rejected', 'In Process', 'Completed'].includes(status)) return;
      add({
        id: `pr-status:${pr.id}:${status}`,
        title: `Requisition ${status}`,
        description: `${pr.id} · ${asString(pr.itemTitle) || 'Purchase request'} is ${status.toLowerCase()}.`,
        createdAt: asString(pr.updatedAt),
        kind: status === 'Rejected' ? 'warning' : 'success',
        targetTab: 'tracking', targetRecordId: pr.id
      });
    });
  }

  if (approver) {
    state.requisitions.filter(pr => pr.status === 'Pending').forEach(pr => {
      add({
        id: `pr-awaiting-approval:${pr.id}`,
        title: 'Requisition needs approval',
        description: `${pr.id} · ${asString(pr.itemTitle)} (${asString(pr.department)})`,
        createdAt: asString(pr.createdAt), kind: 'action', targetTab: 'requisitions', targetRecordId: pr.id
      });
    });
    state.proposalMeetings.filter(m => m.rescheduleRequest?.status === 'Pending').forEach(m => {
      add({
        id: `meeting-reschedule-review:${m.id}:${asString(m.rescheduleRequest.requestedAt)}`,
        title: 'Supplier requested a new meeting time',
        description: `${m.id} · ${asString(m.supplierName)} proposed ${asString(m.rescheduleRequest.date)} at ${asString(m.rescheduleRequest.time)}.`,
        createdAt: asString(m.rescheduleRequest.requestedAt), kind: 'action', targetTab: 'proposal_meetings', targetRecordId: m.id
      });
    });
    state.bids.filter(bid => bid.status === 'Submitted').forEach(bid => {
      add({
        id: `bid-submitted:${bid.id}`,
        title: 'New supplier quotation',
        description: `${asString(bid.supplierName)} submitted bid ${bid.id}.`,
        createdAt: asString(bid.submittedAt), kind: 'action', targetTab: 'bid_comparison', targetRecordId: bid.id
      });
    });
  }

  if (supplier) {
    state.stockNeeds.filter(need => need.status === 'Published').forEach(need => {
      const alreadyBid = Boolean(supplierId) && state.bids.some(bid => bid.needId === need.id && bid.supplierId === supplierId);
      const deadline = getDeadline(need.id);
      const remaining = deadline ? Date.parse(deadline.closesAt) - Date.now() : NaN;
      // Show deadline-specific alerts only when the verified cloud deadline is available.
      if (!alreadyBid && deadline && !deadline.manuallyClosed && Number.isFinite(remaining) && remaining > 0 && remaining <= 48 * 60 * 60 * 1000) {
        add({ id: `bid-deadline:${need.id}:${deadline.closesAt}`, title: 'Bid deadline approaching',
          description: `${asString(need.title)} · Closes ${new Date(deadline.closesAt).toLocaleString('en-PH')}.`,
          createdAt: asString(need.createdAt), kind: 'warning', targetTab: 'bidding', targetRecordId: need.id });
      }
      if (!alreadyBid && (!deadline || (!deadline.manuallyClosed && remaining > 0))) add({
        id: `need-published:${need.id}`,
        title: 'New bidding opportunity',
        description: `${asString(need.title)} · Bids are open.`,
        createdAt: asString(need.createdAt), kind: 'action', targetTab: 'bidding', targetRecordId: need.id
      });
    });
    state.proposalMeetings.filter(meeting => Boolean(supplierId) && meeting.supplierId === supplierId && meeting.status === 'Pending Response').forEach(meeting => {
      add({
        id: `meeting-invitation:${meeting.id}:${meeting.rescheduleCount || 0}`,
        title: meeting.rescheduleCount ? 'Updated meeting invitation' : 'Proposal meeting invitation',
        description: `Respond to meeting ${meeting.id} with procurement · ${asString(meeting.date)} at ${asString(meeting.time)}.`,
        createdAt: asString(meeting.rescheduledAt || meeting.createdAt || meeting.date), kind: 'action', targetTab: 'proposal_meetings', targetRecordId: meeting.id
      });
    });
    state.proposalMeetings.filter(m => Boolean(supplierId) && m.supplierId === supplierId &&
      ['Approved', 'Rejected'].includes(asString(m.rescheduleRequest?.status))).forEach(m => {
      add({
        id: `supplier-reschedule-decision:${m.id}:${asString(m.rescheduleRequest.requestedAt)}:${asString(m.rescheduleRequest.status)}`,
        title: m.rescheduleRequest.status === 'Approved' ? 'Your new meeting time was approved' : 'Your schedule request was declined',
        description: `${m.id} · ${m.rescheduleRequest.status === 'Approved' ? 'Confirm the revised invitation.' : 'The original meeting schedule remains unchanged.'}`,
        createdAt: asString(m.rescheduleRequest.reviewedAt),
        kind: m.rescheduleRequest.status === 'Approved' ? 'action' : 'warning',
        targetTab: 'proposal_meetings', targetRecordId: m.id
      });
    });
    state.orders.filter(order => Boolean(supplierId) && order.supplierId === supplierId).forEach(order => {
      add({
        id: `supplier-order:${order.id}:${order.status}`,
        title: 'Purchase order assigned',
        description: `${order.id} · ${asString(order.itemTitle) || 'New order'} (${asString(order.status)}).`,
        createdAt: asString(order.poDate), kind: 'info', targetTab: 'orders', targetRecordId: order.id
      });
    });
    state.payments.filter(payment => {
      const po = state.orders.find(order => order.id === payment.poId);
      return Boolean(supplierId) && po?.supplierId === supplierId && payment.status === 'Paid';
    }).forEach(payment => {
      add({
        id: `supplier-payment:${payment.id}:paid`,
        title: 'Payment confirmed',
        description: `${payment.poId} · Payment has been marked paid.`,
        createdAt: asString(payment.paymentDate), kind: 'success', targetTab: 'payments', targetRecordId: payment.id
      });
    });
  }

  // D1 contract expiry notifications use the configured notice period;
  // stable IDs reset unread when a contract is renewed with a different expiration.
  getCloudContractAlerts(user).forEach(contract=>{
    add({id:`contract-expiry:${contract.id}:${contract.endsOn}`,
      title:contract.status==='Expired'?'Contract expired':'Contract renewal approaching',
      description:`${contract.reference} · ${contract.supplierName} · ${contract.status==='Expired'?'Expired':'Expires'} ${contract.endsOn}.`,
      createdAt:contract.updatedAt,kind:'warning',targetTab:'contracts',targetRecordId:contract.id});
  });

  // Admin reviews primary approvers' leave/delegation requests. The same cloud
  // register also tells the primary and substitute about completed decisions.
  getCloudDelegationAlerts(user).forEach(d=>{
    if(user.role==='Admin' && d.review_status==='Pending' && !d.revoked_at){
      add({id:`delegation-pending:${d.id}`,title:'Delegation request needs review',
        description:`${d.primary_name} · ${d.step_role} · ${d.starts_on} to ${d.ends_on}.`,
        createdAt:d.created_at,kind:'action',targetTab:'approval_delegation',targetRecordId:d.id});
    }
    if(user.id===d.primary_user_id && ['Approved','Rejected'].includes(d.review_status)){
      add({id:`delegation-reviewed:${d.id}:${d.review_status}`,title:`Delegation request ${d.review_status.toLowerCase()}`,
        description:`${d.step_role} · ${d.starts_on} to ${d.ends_on}${d.review_note?` · ${d.review_note}`:''}`,
        createdAt:d.reviewed_at||d.created_at,kind:d.review_status==='Rejected'?'warning':'success',
        targetTab:'approval_delegation',targetRecordId:d.id});
    }
    if(user.id===d.delegate_user_id && d.review_status==='Approved' && !d.revoked_at){
      const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      const active=d.starts_on<=today&&d.ends_on>=today;
      add({id:`delegation-assigned:${d.id}`,title:active?'Temporary approval duty is active':'Temporary approval duty assigned',
        description:`${d.step_role} · ${d.starts_on} to ${d.ends_on}${active?' · Coverage is active.':''}.`,
        createdAt:d.reviewed_at||d.created_at,kind:'info',targetTab:'approval_delegation',targetRecordId:d.id});
    }
  });

  // Confirm when temporary coverage starts or expires; do not revive ancient delegations.
  const localToday=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  getCloudDelegationAlerts(user).forEach(d=>{
    if(d.review_status!=='Approved'||d.revoked_at || (user.id!==d.primary_user_id && user.id!==d.delegate_user_id))return;
    const related=user.id===d.primary_user_id?'Your substitute':'Your temporary approval authority';
    if(d.starts_on===localToday){
      add({id:`delegation-start:${d.id}:${d.starts_on}`,title:'Delegation coverage starts today',
        description:`${related} · ${d.step_role}${d.department?` (${d.department})`:''} · ${d.starts_on}–${d.ends_on}.`,
        createdAt:d.reviewed_at||d.created_at,kind:'info',targetTab:'approval_delegation',targetRecordId:d.id});
    }
    const sinceEnd=Date.parse(localToday+'T00:00:00Z')-Date.parse(d.ends_on+'T00:00:00Z');
    if(sinceEnd>0 && sinceEnd<=7*86400000){
      add({id:`delegation-ended:${d.id}:${d.ends_on}`,title:'Temporary delegation has ended',
        description:`${d.step_role}${d.department?` (${d.department})`:''} coverage ended ${d.ends_on}. Original assignments apply again.`,
        createdAt:d.ends_on+'T23:59:59',kind:'info',targetTab:'approval_delegation',targetRecordId:d.id});
    }
  });

  // Private one-to-one messages: only the recipient's authenticated D1 inbox
  // provides these alerts. Never expose private message bodies in the bell or
  // notification center; opening the alert navigates directly to the sender.
  getCloudDirectMessageAlerts(user).forEach(message => {
    add({
      id: `direct-message:${message.id}`,
      title: 'New private message',
      description: `${message.senderName} sent you a private message.`,
      createdAt: message.createdAt,
      kind: 'action',
      targetTab: 'people_messages',
      targetRecordId: message.senderId,
    });
  });

  // Cloudflare messages become ordinary read/unread alerts. The Worker has
  // already checked account access and removed messages sent by this user.
  getCloudMessageAlerts(user).forEach(message => {
    if (!['BID', 'MEETING', 'PO', 'DELIVERY', 'ISSUE'].includes(message.entityType)) return;
    add({
      id: `message:${message.id}`,
      title: 'New supplier message',
      description: `${message.senderName} sent a message about ${message.entityType} ${message.entityId}.`,
      createdAt: message.createdAt,
      kind: 'action',
      targetTab: 'supplier_messages',
      targetRecordId: message.entityId,
      messageContext: `${message.entityType}|${message.entityId}`,
    });
  });

  if (procurement) {
    state.deliveries.filter(delivery => delivery.complianceStatus === 'Pending Inspection').forEach(delivery => {
      add({
        id: `delivery-inspection:${delivery.id}`,
        title: 'Delivery awaiting inspection',
        description: `${delivery.id} · ${asString(delivery.itemTitle)} requires inspection.`,
        createdAt: asString(delivery.updatedAt || delivery.actualDate),
        kind: 'action', targetTab: 'delivery', targetRecordId: delivery.id
      });
    });
    state.amendments.filter(amendment => ['Pending', 'Pending Approval'].includes(asString(amendment.status))).forEach(amendment => {
      add({
        id: `amendment-review:${amendment.id}`,
        title: 'Amendment needs review',
        description: `${amendment.id} is awaiting an approval decision.`,
        createdAt: asString(amendment.createdAt),
        kind: 'warning', targetTab: 'amendments', targetRecordId: amendment.id
      });
    });
  }
  return sorted([...result, ...historyFromAudit(state, user)]);
}
