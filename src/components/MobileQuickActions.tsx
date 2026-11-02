import {DB,ui} from '../store/state';
import {canAccessTab} from '../domain/permissions';
import {navigateTo} from '../core/renderBridge';
import {getNotifications, getUnreadCount} from '../features/notifications/notificationService';

const tabs:[string,string,string][]=[
 ['dashboard','Home','fa-house'],['requisitions','Requests','fa-file-signature'],
 ['approvals','Approvals','fa-list-check'],['proposal_meetings','Meetings','fa-calendar-days'],
 ['orders','Orders','fa-box'],['notifications','Alerts','fa-bell']
];
export function MobileQuickActions({ onOpenMenu, isMenuOpen }: { onOpenMenu: () => void; isMenuOpen: boolean }){
 if(!DB.currentUser)return null;
 const primary=(DB.currentUser.role==='Supplier'?['dashboard','proposal_meetings','orders','notifications']:['dashboard','requisitions','approvals','notifications']);
 const shown=primary.map(id=>tabs.find(t=>t[0]===id)).filter((v):v is [string,string,string]=>Boolean(v)&&canAccessTab(v![0]));
 if(shown.length===0)return null;
 const alerts = getNotifications();
 const unread = getUnreadCount(alerts, DB.currentUser);
 // The Approvals badge reflects actionable PR alerts issued to this account,
 // not every pending PR in the company (which would mislead Finance/Employees).
 const approvals = alerts.filter(n => !n.historical && n.kind === 'action' && n.id.startsWith('pr-awaiting-approval:')).length;
 const badgeFor = (id:string) => id === 'notifications' ? unread : id === 'approvals' ? approvals : 0;
 return <nav aria-label="Mobile quick actions" className="pf-mobile-actions md:hidden">{shown.map(([id,label,icon])=><button type="button" key={id} aria-current={ui.currentTab===id?'page':undefined} onClick={()=>navigateTo(id)} className={ui.currentTab===id?'pf-mobile-active':''}><span className="pf-quick-icon"><i className={'fa-solid '+icon} aria-hidden="true"/>{badgeFor(id)>0&&<span className="pf-quick-badge" aria-label={`${badgeFor(id)} ${id==='notifications'?'unread notifications':'pending approvals'}`}>{badgeFor(id)>99?'99+':badgeFor(id)}</span>}</span><span>{label}</span></button>)}<button type="button" aria-label="Open all modules" aria-controls="procureflow-sidebar" aria-expanded={isMenuOpen} className={isMenuOpen ? 'pf-mobile-active' : ''} onClick={onOpenMenu}><i className="fa-solid fa-bars" aria-hidden="true"/><span>Menu</span></button></nav>;
}
