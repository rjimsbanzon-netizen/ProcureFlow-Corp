import { useCallback, useEffect, useState } from 'react';
import { HtmlView } from '../components/HtmlView';
import { renderUsersView } from '../views/users';
import { DB } from '../store/state';
import { CLOUD_API_BASE } from '../services/cloud';
import { loadStaffAssignments, STAFF_ASSIGNMENTS_UPDATED } from '../domain/staffPositions';
import type { StaffAssignment } from '../domain/staffPositions';

export default function UsersPage() {
  const [assignments,setAssignments] = useState<StaffAssignment[]>([]);
  const [loading,setLoading] = useState(Boolean(CLOUD_API_BASE));
  const [error,setError] = useState('');
  const [search,setSearch]=useState('');
  const accountId=DB.currentUser?.id??'';
  const refresh=useCallback(async(showLoading=false)=>{
    if(!CLOUD_API_BASE){setLoading(false);return;}
    if(showLoading)setLoading(true);
    try {setAssignments(await loadStaffAssignments(accountId,true));setError('');}
    catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setLoading(false);}
  },[accountId]);
  useEffect(()=>{
    void refresh(true);
    const onChanged=()=>{void refresh();};
    window.addEventListener(STAFF_ASSIGNMENTS_UPDATED,onChanged);
    const timer=window.setInterval(onChanged,30_000);
    return ()=>{
      window.removeEventListener(STAFF_ASSIGNMENTS_UPDATED,onChanged);
      window.clearInterval(timer);
    };
  },[refresh]);

  return <div className="space-y-3">
    {error&&<p role="alert" className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">Could not load current staff positions: {error}. Please refresh this page.</p>}
    <div className="rounded-xl border border-slate-200 bg-white p-4"><label htmlFor="user-verification-search" className="block text-sm font-semibold text-slate-700">Search accounts</label><input id="user-verification-search" type="search" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, username, email, department, status, position…" /></div>
    <HtmlView html={renderUsersView(assignments,loading||Boolean(error),search)} />
  </div>;
}
