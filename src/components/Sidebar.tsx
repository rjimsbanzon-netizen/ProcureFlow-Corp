import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DB, ui } from '../store/state';
import { canAccessTab } from '../domain/permissions';
import { navigateTo } from '../core/renderBridge';
import { CLOUD_API_BASE } from '../services/cloud';
import { accountAPI } from '../services/account';
import { getNotifications, getUnreadCount } from '../features/notifications/notificationService';
import procureflowMark from '../procureflow-mark.png';

// Remember sidebar position per account even across sign-in transitions.
// Page refreshes no longer unmount this sidebar.
const savedSidebarScroll = new Map<string, number>();
const savedCollapsedGroups = new Map<string, string[]>();

/** Sidebar navigation grouping only; never changes authorization. */
function getCollapsedGroups(accountId: string): string[] {
  if (savedCollapsedGroups.has(accountId)) return savedCollapsedGroups.get(accountId)!;
  try {
    const stored = JSON.parse(localStorage.getItem(`pf-sidebar-collapsed:${accountId}`) || '[]');
    const groups = Array.isArray(stored) ? stored.filter((name): name is string => typeof name === 'string') : [];
    savedCollapsedGroups.set(accountId, groups);
    return groups;
  } catch {
    return [];
  }
}


type NavItem = [string, string, string];
type NavSection = { title: string; items: NavItem[] };

const employeeSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      ['dashboard', 'Dashboard', 'fa-house'],
      ['global_search', 'Global Search & Filters', 'fa-magnifying-glass'],
      ['tracking', 'Procurement Tracking', 'fa-route'],
      ['notifications', 'Notifications', 'fa-bell']
    ]
  },
  {
    title: 'Requisition & Approval',
    items: [
      ['requisitions', 'Purchase Requisitions', 'fa-file-signature'],
      ['approvals', 'Approval Workflow', 'fa-list-check'],
      ['approval_delegation', 'Approval Delegation', 'fa-user-clock'],
      ['budgets', 'Department Budgets', 'fa-wallet']
    ]
  },
  {
    title: 'Sourcing',
    items: [
      ['bidding', 'Procurement Needs & Bidding', 'fa-box-open'],
      ['bidding_deadlines', 'Bidding Deadlines', 'fa-hourglass-half'],
      ['bid_comparison', 'Submitted Vendor Bids & Comparison', 'fa-scale-balanced'],
      ['bid_evaluation', 'Supplier Bid Evaluation', 'fa-clipboard-check'],
      ['proposal_meetings', 'Proposal Meetings', 'fa-calendar-days'],
      ['contracts', 'Contract Management', 'fa-file-contract'],
      ['supply_planning', 'Recurring Supply & Backup Suppliers', 'fa-arrows-rotate'],
      ['supplier_inventory', 'Supplier Stock Directory', 'fa-boxes-stacked'],
      ['suppliers', 'Suppliers Directory', 'fa-building'],
      ['supplier_messages', 'Supplier Messaging', 'fa-comments'],
      ['accreditation', 'Supplier Accreditation', 'fa-id-card']
    ]
  },
  {
    title: 'Orders & Fulfillment',
    items: [
      ['orders', 'Purchase & Job Orders', 'fa-file-invoice-dollar'],
      ['delivery', 'Delivery Monitoring', 'fa-truck-ramp-box'],
      ['amendments', 'Issues & Amendments', 'fa-triangle-exclamation'],
      ['delivery_discrepancies', 'Delivery Discrepancies', 'fa-clipboard-list'],
      ['inventory', 'Inventory Integration', 'fa-boxes-stacked']
    ]
  },
  {
    title: 'Finance',
    items: [
      ['invoice_matching', 'Invoice & PO Matching', 'fa-file-circle-check'],
      ['payments', 'Payment Management', 'fa-credit-card'],
      ['reports', 'Advanced Reports', 'fa-chart-column'],
      ['supplier_analytics', 'Supplier Performance Analytics', 'fa-chart-line']
    ]
  },
  {
    title: 'Documents',
    items: [
      ['documents', 'Document Management', 'fa-folder-open'],
      ['pdf_generator', 'PDF Generator', 'fa-file-pdf']
    ]
  },
  {
    title: 'Account & Community',
    items: [
      ['my_profile', 'My Account', 'fa-circle-user'],
      ['people_directory', 'Employee Profiles', 'fa-address-card'],
      ['people_messages', 'People & Messages', 'fa-comment-dots']
    ]
  },
  {
    title: 'Administration',
    items: [
      ['audit', 'Audit Logs', 'fa-clock-rotate-left'],
      ['staff_assignments', 'Staff Assignments', 'fa-user-gear'],
      ['operations_materials', 'Company & Material Setup', 'fa-industry'],
      ['users', 'User Verification', 'fa-users-gear'],
      ['access_control', 'Access Control Matrix', 'fa-shield-halved']
    ]
  }
];

const supplierSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      ['dashboard', 'Supplier Portal', 'fa-house'],
      ['tracking', 'Order Tracking', 'fa-route'],
      ['notifications', 'Notifications', 'fa-bell']
    ]
  },
  {
    title: 'Sourcing',
    items: [
      ['bidding', 'Procurement Needs & Bidding', 'fa-gavel'],
      ['proposal_meetings', 'Proposal Meetings', 'fa-calendar-days'],
      ['supplier_messages', 'Supplier Messaging', 'fa-comments'],
      ['accreditation', 'My Accreditation', 'fa-id-card'],
      ['contracts', 'My Contracts', 'fa-file-contract'],
      ['supplier_inventory', 'My Company Inventory', 'fa-boxes-stacked'],
      ['supplier_analytics', 'My Performance', 'fa-chart-line'],
      ['documents', 'My Documents', 'fa-folder-open']
    ]
  },
  {
    title: 'Account & Community',
    items: [
      ['my_profile', 'My Account', 'fa-circle-user'],
      ['people_directory', 'Employee Profiles', 'fa-address-card'],
      ['people_messages', 'People & Messages', 'fa-comment-dots']
    ]
  },
  {
    title: 'Orders & Fulfillment',
    items: [
      ['orders', 'Assigned Purchase Orders', 'fa-file-invoice-dollar'],
      ['delivery', 'Deliveries & Shipments', 'fa-truck-ramp-box'],
      ['amendments', 'Order Amendments', 'fa-triangle-exclamation'],
      ['delivery_discrepancies', 'Delivery Discrepancies', 'fa-clipboard-list']
    ]
  },
  {
    title: 'Finance',
    items: [
      ['invoice_matching', 'Supplier Invoices', 'fa-file-circle-check'],
      ['payments', 'Payment Status', 'fa-credit-card']
    ]
  },
  {
    title: 'Documents',
    items: [
      ['pdf_generator', 'Generate PDFs', 'fa-file-pdf']
    ]
  }
];

function NavButton({ id, label, icon, badge, onNavigate }: { id: string; label: string; icon: string; badge?: number | null; onNavigate: () => void }) {
  const active = ui.currentTab === id;
  return (
    <button
      key={id}
      onClick={() => { onNavigate(); navigateTo(id); }}
      type="button"
      className={
        'sidebar-nav-button w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ' +
        (active
          ? 'pf-sidebar-active text-white'
          : 'text-slate-300 hover:bg-[#1c2420] hover:text-white')
      }
    >
      <i className={'fa-solid ' + icon + ' w-5 text-center sidebar-nav-icon'} />
      <span className="sidebar-nav-label">{label}</span>
      {badge && badge > 0 ? (
        <span className="sidebar-notification-badge">{badge > 99 ? '99+' : badge}</span>
      ) : null}
    </button>
  );
}

export function Sidebar({ isMobileOpen, onClose }: { isMobileOpen: boolean; onClose: () => void }) {
  const user = DB.currentUser;
  const navRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const scrollKey = String(user?.id ?? user?.username ?? 'anonymous');
  const [collapsed, setCollapsed] = useState<string[]>(() => getCollapsedGroups(scrollKey));
  const [moduleQuery,setModuleQuery] = useState('');
  const [dmUnread,setDmUnread] = useState(0);
  useEffect(() => {
    if (!CLOUD_API_BASE || !user?.id) { setDmUnread(0); return; }
    let active=true;
    const refresh=()=>{void accountAPI.conversations().then(items=>{if(active)setDmUnread(items.reduce((sum,item)=>sum+item.unread,0));}).catch(()=>{if(active)setDmUnread(0);});};
    refresh();const timer=window.setInterval(refresh,20000);
    return ()=>{active=false;window.clearInterval(timer);};
  },[user?.id]);
  useEffect(() => { setCollapsed(getCollapsedGroups(scrollKey)); }, [scrollKey]);
  const toggleSection = (title: string) => {
    setCollapsed(current => {
      const updated = current.includes(title) ? current.filter(item => item !== title) : [...current, title];
      savedCollapsedGroups.set(scrollKey, updated);
      try { localStorage.setItem(`pf-sidebar-collapsed:${scrollKey}`, JSON.stringify(updated)); } catch { /* Storage disabled */ }
      return updated;
    });
  };

  // Restore before paint when a different signed-in account mounts.
  useLayoutEffect(() => {
    if (navRef.current) {
      navRef.current.scrollTop = savedSidebarScroll.get(scrollKey) ?? 0;
    }
  }, [scrollKey]);
  useEffect(() => {
    if (!isMobileOpen || window.innerWidth >= 1024) return;
    closeButtonRef.current?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const drawer = document.getElementById('procureflow-sidebar');
      if (!drawer) return;
      const controls = Array.from(drawer.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href]'));
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', trapFocus);
    return () => document.removeEventListener('keydown', trapFocus);
  }, [isMobileOpen]);
  const notifications = getNotifications();
  const unread = getUnreadCount(notifications, user);
  const sections = (user?.role === 'Supplier' ? supplierSections : employeeSections)
    .map(section => ({
      ...section,
      items: section.items.filter(([id,label]) => canAccessTab(id) && (!moduleQuery.trim() || label.toLowerCase().includes(moduleQuery.trim().toLowerCase()) || section.title.toLowerCase().includes(moduleQuery.trim().toLowerCase())))
    }))
    .filter(section => section.items.length > 0);

  return (
    <aside id="procureflow-sidebar" aria-label="Main navigation" role={isMobileOpen ? 'dialog' : undefined} aria-modal={isMobileOpen ? true : undefined} className={'enterprise-sidebar pf-nav-drawer w-[17rem] h-full min-h-0 bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0 overflow-hidden shadow-xl' + (isMobileOpen ? ' pf-nav-open' : '')}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="sidebar-brand px-5 py-5 flex items-center gap-3 border-b border-slate-800">
          <div className="sidebar-mark">
            <img src={procureflowMark} alt="ProcureFlow" className="w-10 h-10 object-contain rounded-md" />
          </div>
          <div className="sidebar-brand-copy min-w-0">
            <div className="font-bold text-white text-[1.55rem] leading-none">ProcureFlow</div>
            <div className="text-sm text-slate-300 leading-tight mt-1">Enterprise</div>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="pf-drawer-close" aria-label="Close navigation menu"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
        </div>

        <div className="px-3 pt-4">
          <label htmlFor="pf-sidebar-module-search" className="sr-only">Search sidebar modules</label>
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-3.5 text-xs text-slate-400" aria-hidden="true" />
            <input id="pf-sidebar-module-search" type="search" value={moduleQuery} onChange={event=>setModuleQuery(event.target.value)} placeholder="Find a module…"
              className="w-full rounded-xl border border-slate-600 bg-[#1b2721] py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-slate-400 outline-none focus:border-[#c67b5e]" />
          </div>
        </div>
        <nav
          ref={navRef}
          onScroll={(event) => savedSidebarScroll.set(scrollKey, event.currentTarget.scrollTop)}
          className="min-h-0 flex-1 overflow-y-auto custom-scrollbar px-3 py-4"
        >
          {sections.length === 0 && <p role="status" className="px-3 py-6 text-sm text-slate-400">No matching modules. Try another term.</p>}
          {sections.map(section => (
            <div key={section.title} className="sidebar-section mb-5">
              <button type="button" className="sidebar-section-label pf-sidebar-group-toggle" aria-expanded={Boolean(moduleQuery.trim()) || !collapsed.includes(section.title)} aria-controls={`pf-nav-group-${section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} onClick={() => toggleSection(section.title)}>
                <span>{section.title}</span>
                <i className={`fa-solid fa-chevron-down pf-sidebar-group-chevron ${collapsed.includes(section.title) ? 'pf-sidebar-group-collapsed' : ''}`} aria-hidden="true" />
              </button>
              <div id={`pf-nav-group-${section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="mt-2 flex flex-col gap-1.5" hidden={!moduleQuery.trim() && collapsed.includes(section.title)}>
                {section.items.map(([id, label, icon]) => (
                  <NavButton key={id} id={id} label={label} icon={icon} badge={id === 'notifications' ? unread : id === 'people_messages' ? dmUnread : null} onNavigate={onClose} />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="sidebar-foot shrink-0 p-4 border-t border-slate-800 text-xs text-slate-500">
        <div className="flex justify-between items-center mb-2"><span className="sidebar-foot-copy">Storage Sync</span><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" /></div>
        {user?.role === 'Admin' && (
          <button id="reset-db-btn" type="button" className="w-full text-left text-slate-400 hover:text-rose-400 transition-colors flex items-center space-x-1.5" title="Admin only: clears procurement records, not user accounts or uploaded documents"><i className="fa-solid fa-arrow-rotate-left text-xs"/><span className="sidebar-foot-copy">Reset System Database</span></button>
        )}
      </div>
    </aside>
  );
}
