import { useEffect, useState } from 'react';
import procureflowMark from '../procureflow-mark.png';
import { NotificationBell } from '../features/notifications/NotificationBell';
import {PwaSupport} from './PwaSupport';
import { loadStaffAssignments, getEffectivePosition } from '../domain/staffPositions';
import type { StaffAssignment } from '../domain/staffPositions';
import { DB, ui } from '../store/state';
import { getCurrentPermissionRole } from '../domain/permissions';
import { activeActingResponsibilities } from '../domain/effectiveDelegation';
import { CLOUD_API_BASE, cloudRequest, mapCloudUser, refreshActiveDelegationAccess } from '../services/cloud';
import { accountAPI } from '../services/account';
import { showToast } from '../services/toast';
import { navigateTo, renderApp } from '../core/renderBridge';
const MODULE_TITLES: Record<string, string> = {
  bidding: 'Stock Needs & Bidding',
  bidding_deadlines: 'Bidding Deadlines',
  bid_comparison: 'Submitted Vendor Bids & Comparison',
  bid_evaluation: 'Supplier Bid Evaluation',
  proposal_meetings: 'Proposal Meetings',
  global_search: 'Global Search & Filters',
  approval_delegation: 'Approval Delegation',
  contracts: 'Contract Management',
  supplier_analytics: 'Supplier Performance Analytics',
  my_profile: 'My Profile',
  people_messages: 'People & Messages',
};

export function Header({ onOpenMenu, isMenuOpen }: { onOpenMenu: () => void; isMenuOpen: boolean }) {
  const user = DB.currentUser;
  const [assignments,setAssignments]=useState<StaffAssignment[]>([]);
  const [avatar,setAvatar]=useState('');
  const accountId=user?.id??'';
  useEffect(()=>{
    let active=true;setAvatar('');
    if(CLOUD_API_BASE && accountId){void accountAPI.profile().then(profile=>{if(active)setAvatar(profile.avatar||'');}).catch(()=>{});}
    const updated=(event:Event)=>{const detail=(event as CustomEvent<string>).detail;if(active)setAvatar(typeof detail==='string'?detail:'');};
    window.addEventListener('procureflow:avatar-updated',updated);
    return ()=>{active=false;window.removeEventListener('procureflow:avatar-updated',updated);};
  },[accountId]);
  const accountRole=user?.role??'';
  useEffect(()=>{
    if (!accountId || accountRole==='Supplier') return;
    let alive=true;
    let refreshing=false;
    const refresh=async()=>{
      if(!alive || refreshing || document.visibilityState==='hidden') return;
      refreshing=true;
      const before=activeActingResponsibilities();
      try {
        // Every refresh is based on fresh D1 approval/delegation records.
        // Revoked and expired responsibilities disappear from local UI hints.
        const changed=await refreshActiveDelegationAccess();
        if(!alive)return;
        if(changed){
          const after=activeActingResponsibilities();
          if(before.length>0 && after.length===0){
            // The original account role and appointed staff positions remain.
            // Only temporary delegated authority is removed.
            window.dispatchEvent(new Event('procureflow:acting-access-ended'));
            showToast('Temporary delegation is no longer active. Your usual account permissions apply.', 'info');
          }
          renderApp();
        }
        // D1 is authoritative for permanent roles too. Refreshing assignments alone
        // would leave the upper-right badge stuck on the old app_role.
        if(CLOUD_API_BASE){
          const session=await cloudRequest('/auth/me') as {user?:Record<string,any>};
          const stored=session.user;
          if(stored&&DB.currentUser?.id===accountId){
            const fresh=mapCloudUser(stored,DB.suppliers as never[]);
            if(fresh.role!==DB.currentUser.role||fresh.department!==DB.currentUser.department||fresh.name!==DB.currentUser.name){
              DB.currentUser={...DB.currentUser,...fresh};
              renderApp();
            }
          }
        }
        const previous=getCurrentPermissionRole();
        const data=await loadStaffAssignments(accountId);
        if(!alive)return;
        setAssignments(data);
        if(getCurrentPermissionRole()!==previous)renderApp();
      } catch {
        // Do not infer approval authority when the Worker is unreachable.
        // Other screens separately recheck protected actions with the Worker.
      } finally { refreshing=false; }
    };
    const onVisible=()=>{if(document.visibilityState==='visible')void refresh();};
    const onFocus=()=>{void refresh();};
    const onUpdated=()=>{void refresh();};
    void refresh();
    const timer=window.setInterval(()=>{void refresh();},5_000);
    document.addEventListener('visibilitychange',onVisible);
    window.addEventListener('focus',onFocus);
    window.addEventListener('procureflow:delegation-updated',onUpdated);
    return ()=>{
      alive=false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange',onVisible);
      window.removeEventListener('focus',onFocus);
      window.removeEventListener('procureflow:delegation-updated',onUpdated);
    };
  },[accountId,accountRole]);
  const position = user ? getEffectivePosition(user, assignments) : null;
  const acting=activeActingResponsibilities();
  const priority=['Finance Officer','Finance Head','Procurement Head','Operations Head','Department Head'];
  const actingRole=acting.slice().sort((a,b)=>priority.indexOf(a.role)-priority.indexOf(b.role))[0];
  const positionLabel = actingRole
    ? `Acting ${actingRole.role==='Department Head'&&actingRole.department.toLowerCase()==='human resources'?'Human Resources Head':actingRole.role}${actingRole.department&&actingRole.department.toLowerCase()!=='human resources' ? ` • ${actingRole.department}` : ''} (until ${actingRole.endsOn})`
    : user?.role==='Admin' ? 'Executive' : position ? (['Head','Finance Head','Finance Officer'].includes(position.name) ? `${position.name} • ${position.department}` : position.label) : '';
  return <header className="enterprise-header pf-app-header bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm z-10">
    <div className="pf-header-leading flex min-w-0 items-center gap-3">
      <button type="button" className="pf-menu-toggle" onClick={onOpenMenu} aria-label="Open navigation menu" aria-controls="procureflow-sidebar" aria-expanded={isMenuOpen} aria-haspopup="dialog">
        <i className="fa-solid fa-bars" aria-hidden="true" />
      </button>
      <img src={procureflowMark} alt="" aria-hidden="true" className="pf-header-mark" />
      <div className="pf-header-module min-w-0"><span className="pf-module-label text-sm font-semibold text-slate-500 uppercase tracking-wider">Module:</span>
        <h1 className="pf-module-title text-lg font-bold text-slate-800 capitalize">{MODULE_TITLES[ui.currentTab] || ui.currentTab.replace(/_/g, ' ')}</h1>
      </div>
    </div>
    <div className="pf-header-tools flex items-center gap-3">
      <PwaSupport />
      <NotificationBell />
      <button type="button" onClick={() => navigateTo('my_profile')} className="flex items-center gap-2 rounded-xl px-2 py-1 text-right transition hover:bg-slate-100" title="Edit my profile" aria-label="Open my profile"><span className="hidden sm:block"><span className="block text-sm font-bold text-slate-800">{user?.role==='Admin'?'Admin':user?.name}</span><span className="block text-xs font-semibold text-[#a64f32]">{positionLabel || user?.role}</span></span>{avatar?<img src={avatar} alt="" className="h-9 w-9 rounded-full border border-slate-200 object-cover"/>:<i className="fa-solid fa-circle-user text-xl text-[#a64f32]" aria-hidden="true" />}</button>
      <button id="logout-btn" title="Sign Out" type="button" className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors">
        <i className="fa-solid fa-right-from-bracket text-lg" /></button>
    </div>
  </header>;
}
