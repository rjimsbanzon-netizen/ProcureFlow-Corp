import { useState, useSyncExternalStore } from 'react';
import { subscribeCloudNotifications, getNotificationRevision, getNotificationSyncStatus } from './cloudNotificationSync';
import { navigateTo } from '../../core/renderBridge';
import { canAccessTab } from '../../domain/permissions';
import { DB, ui } from '../../store/state';
import { getNotifications, getUnreadCount, isNotificationRead, markAllNotificationsRead, markNotificationRead } from './notificationService';
import type { ProcurementNotification } from './notificationService';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  useSyncExternalStore(subscribeCloudNotifications, getNotificationRevision, getNotificationRevision);
  const notifications = getNotifications(DB);
  const unread = getUnreadCount(notifications);

  const openNotification = (notification: ProcurementNotification) => {
    markNotificationRead(notification.id);
    if (canAccessTab(notification.targetTab)) {
      if (notification.targetTab === 'tracking' && notification.targetRecordId) {
        ui.trackingRecordId = notification.targetRecordId;
      }
      if (notification.targetTab === 'people_messages' && notification.targetRecordId) {
        ui.directMessagePeerId = notification.targetRecordId;
      }
      if (notification.targetTab === 'supplier_messages' && notification.messageContext) {
        ui.messageSelection = notification.messageContext;
      }
      setOpen(false);
      navigateTo(notification.targetTab);
    } else {
      setRevision(value => value + 1);
    }
  };

  return <div className="relative" data-notification-revision={revision}>
    <button
      type="button" aria-label={`Notifications (${unread} unread)`} aria-expanded={open}
      onClick={() => setOpen(value => !value)}
      className="relative w-10 h-10 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
    >
      <i className="fa-solid fa-bell text-lg" aria-hidden="true" />
      {unread > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[#a64f32] text-white text-[10px] font-bold flex items-center justify-center">
        {unread > 99 ? '99+' : unread}
      </span>}
    </button>
    {open && <div className="pf-notification-popover absolute right-0 mt-3 w-[min(90vw,380px)] bg-white border border-slate-200 rounded-md shadow-xl z-50 overflow-hidden" role="region" aria-label="Recent notifications">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div><h3 className="font-bold text-slate-900 text-sm">Notifications</h3><p className="text-xs text-slate-500">{unread} unread · {getNotificationSyncStatus() === 'synced' ? 'Cloud synced' : getNotificationSyncStatus() === 'offline' ? 'Offline, retrying' : getNotificationSyncStatus() === 'connecting' ? 'Connecting' : 'Local mode'}</p></div>
        {unread > 0 && <button type="button" onClick={() => { markAllNotificationsRead(notifications); setRevision(n => n + 1); }} className="text-xs font-semibold text-[#a64f32] hover:underline">Mark all read</button>}
      </div>
      <div className="max-h-80 overflow-y-auto custom-scrollbar">
        {notifications.length === 0 ? <p className="p-6 text-center text-slate-500 text-sm">No notifications at the moment.</p> : notifications.slice(0, 6).map(item =>
          <button type="button" key={item.id} onClick={() => openNotification(item)}
            className="w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-[#f2efe7] transition-colors flex gap-3">
            <span className="mt-1 shrink-0"><i className={`fa-solid ${item.kind === 'warning' ? 'fa-triangle-exclamation' : item.kind === 'success' ? 'fa-circle-check' : item.kind === 'action' ? 'fa-circle-exclamation' : 'fa-circle-info'} text-[#a64f32]`} /></span>
            <span className="min-w-0 flex-1">
              <span className="flex justify-between gap-2 items-center"><span className="text-sm font-semibold text-slate-800">{item.title}{item.historical && <span className="ml-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">History</span>}</span>
                {!getIsRead(item) && <span className="w-2 h-2 rounded-full bg-[#a64f32] shrink-0" />}</span>
              <span className="block text-xs text-slate-500 mt-1 break-words">{item.description}</span>
              {item.createdAt && <span className="block text-[11px] text-slate-400 mt-1">{item.createdAt}</span>}
            </span>
          </button>
        )}
      </div>
      <button type="button" onClick={() => { setOpen(false); navigateTo('notifications'); }} className="w-full px-4 py-3 text-sm font-bold text-[#a64f32] bg-[#faf8f2] hover:bg-[#f2efe7]">View notification center</button>
    </div>}
  </div>;
}

function getIsRead(item: ProcurementNotification): boolean {
  const user = DB.currentUser;
  if (!user) return true;
  // Delegates to the same storage provider as NotificationCenter.
  return isNotificationRead(item, user);
}

