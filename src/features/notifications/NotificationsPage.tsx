import { useState, useSyncExternalStore } from 'react';
import { subscribeCloudNotifications, getNotificationRevision, getNotificationSyncStatus, getNotificationSyncError, refreshNotificationsNow } from './cloudNotificationSync';
import { navigateTo } from '../../core/renderBridge';
import { canAccessTab } from '../../domain/permissions';
import { DB, ui } from '../../store/state';
import { getNotifications, getUnreadCount, isNotificationRead, markAllNotificationsRead, markNotificationRead } from './notificationService';
import type { ProcurementNotification } from './notificationService';

export default function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread' | 'history'>('all');
  const [, forceUpdate] = useState(0);
  useSyncExternalStore(subscribeCloudNotifications, getNotificationRevision, getNotificationRevision);
  const notifications = getNotifications(DB);
  const unread = getUnreadCount(notifications);
  const historicalCount = notifications.filter(item => item.historical).length;
  const shown = notifications.filter(item => filter === 'all' || (filter === 'history' ? item.historical : !isNotificationRead(item)));

  const openNotification = (item: ProcurementNotification) => {
    markNotificationRead(item.id);
    forceUpdate(value => value + 1);
    if (!canAccessTab(item.targetTab)) return;
    if (item.targetTab === 'tracking' && item.targetRecordId) ui.trackingRecordId = item.targetRecordId;
    if (item.targetTab === 'people_messages' && item.targetRecordId) ui.directMessagePeerId = item.targetRecordId;
    if (item.targetTab === 'supplier_messages' && item.messageContext) ui.messageSelection = item.messageContext;
    navigateTo(item.targetTab);
  };

  return <section className="space-y-5 max-w-5xl mx-auto">
    <div className="bg-white border border-slate-200 rounded-md p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
      <div><h2 className="text-xl font-bold text-slate-900">Notification Center</h2><p className="text-sm text-slate-500 mt-1">Current alerts and past procurement activity · {unread} unread</p></div>
      <button type="button" disabled={!unread} onClick={() => { markAllNotificationsRead(notifications); forceUpdate(n => n + 1); }}
        className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-md hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed">
        <i className="fa-solid fa-check-double mr-2" />Mark all as read</button>
    </div>
    <div className="flex gap-2">
      {(['all', 'unread', 'history'] as const).map(value => <button key={value} type="button" onClick={() => setFilter(value)}
        className={`px-4 py-2 rounded-md text-sm font-semibold border ${filter === value ? 'bg-[#252d28] border-[#252d28] text-white' : 'bg-white border-slate-200 text-slate-600'}`}>
        {value === 'all' ? `All (${notifications.length})` : value === 'history' ? `History (${historicalCount})` : `Unread (${unread})`}
      </button>)}
    </div>
    <div className="bg-white border border-slate-200 rounded-md divide-y divide-slate-100 overflow-hidden">
      {shown.length === 0 ? <div className="p-12 text-center text-slate-500"><i className="fa-regular fa-bell-slash text-3xl mb-3"/><p>{filter === 'history' ? 'No saved activity history is available.' : filter === 'unread' ? 'No unread notifications.' : 'Nothing here yet.'}</p></div> : shown.map(item => {
        const isRead = isNotificationRead(item);
        return <button type="button" key={item.id} onClick={() => openNotification(item)} className="w-full text-left flex items-start gap-4 p-4 hover:bg-[#f7f3ec] transition-colors">
          <span className="w-10 h-10 rounded-md bg-[#eee7d9] text-[#a64f32] flex items-center justify-center shrink-0"><i className={`fa-solid ${item.kind === 'warning' ? 'fa-triangle-exclamation' : item.kind === 'success' ? 'fa-circle-check' : item.kind === 'action' ? 'fa-circle-exclamation' : 'fa-circle-info'}`}/></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-900">{item.title}{item.historical && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">History</span>}</span>
            <span className="block text-sm text-slate-600 mt-1">{item.description}</span>
            <span className="block text-xs text-slate-400 mt-1">{item.createdAt || 'No event date recorded'}</span>
          </span>
          <span className="flex items-center gap-3 shrink-0">{!isRead && <span className="w-2 h-2 rounded-full bg-[#a64f32]" aria-label="Unread"/>}<i className="fa-solid fa-chevron-right text-xs text-slate-400"/></span>
        </button>;
      })}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
      <p>{getNotificationSyncStatus() === 'synced' ? 'Cloud connected · Current alerts and saved activity history sync across devices.'
        : getNotificationSyncStatus() === 'offline' ? `Cloud unavailable — using local data. ${getNotificationSyncError() || ''}`
        : getNotificationSyncStatus() === 'connecting' ? 'Connecting to Cloudflare…'
        : 'Local demo mode · Notifications stay on this device.'}</p>
      <button type="button" className="rounded-md border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100" onClick={() => { void refreshNotificationsNow(); }}>Refresh cloud alerts</button>
    </div>
  </section>;
}
