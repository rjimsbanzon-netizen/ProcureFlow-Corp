import { useCallback, useEffect, useMemo, useState } from 'react';
import { HtmlView } from '../components/HtmlView';
import { renderAccessControlView } from '../views/accessControl';
import { CLOUD_API_BASE, cloudRequest } from '../services/cloud';
import { DB } from '../store/state';

type EffectiveRole = {
  role:string;
  source:'Account role'|'Staff appointment'|'Active delegation';
  department:string;
  startsOn:string|null;
  endsOn:string|null;
  capability:string;
};
type AccountAccess = {
  id:string;username:string;name:string;department:string;accountRole:string;
  status:string;accessRevoked:boolean;active:boolean;roles:EffectiveRole[];
};
type EffectiveAccessResponse = {asOf:string;accounts:AccountAccess[]};

function RoleTag({role}:{role:EffectiveRole}) {
  const acting=role.source==='Active delegation';
  const appointed=role.source==='Staff appointment';
  return <div className={`rounded-lg border px-3 py-2 ${acting?'border-[#e7cabb] bg-[#fbf3ee]':appointed?'border-sky-200 bg-sky-50':'border-slate-200 bg-white'}`}>
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="font-semibold text-slate-900">{role.role}</span>
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${acting?'bg-[#f0dfd5] text-[#873e27]':appointed?'bg-sky-100 text-sky-800':'bg-slate-100 text-slate-600'}`}>{role.source}</span>
    </div>
    {role.department && role.role==='Department Head' && <div className="mt-1 text-xs text-slate-600">{role.department}</div>}
    {role.startsOn && role.endsOn && <div className="mt-1 text-xs font-medium text-[#873e27]">Valid {role.startsOn} – {role.endsOn} (Philippine dates)</div>}
    {role.capability && <p className="mt-1 text-xs leading-5 text-slate-600">{role.capability}</p>}
  </div>;
}

function EffectiveAccountAccess() {
  const [response,setResponse] = useState<EffectiveAccessResponse|null>(null);
  const [query,setQuery] = useState('');
  const [actingOnly,setActingOnly] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const accountId=DB.currentUser?.id;
  const refresh=useCallback(async()=>{
    if(DB.currentUser?.role!=='Admin'||!CLOUD_API_BASE)return;
    setBusy(true);
    try {
      const result=await cloudRequest('/delegations/effective-access') as EffectiveAccessResponse;
      setResponse(result);
      setError('');
    } catch(e) {setError(e instanceof Error?e.message:String(e));}
    finally {setBusy(false);}
  },[accountId]);
  useEffect(()=>{
    void refresh();
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh();},15_000);
    const onVisible=()=>{if(document.visibilityState==='visible')void refresh();};
    const onDelegationChange=()=>{void refresh();};
    document.addEventListener('visibilitychange',onVisible);
    window.addEventListener('procureflow:delegation-updated',onDelegationChange);
    return ()=>{
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange',onVisible);
      window.removeEventListener('procureflow:delegation-updated',onDelegationChange);
    };
  },[refresh]);
  const items=useMemo(()=>{
    const term=query.trim().toLowerCase();
    return (response?.accounts??[]).filter(account=>(!actingOnly||account.roles.some(role=>role.source==='Active delegation'))&&
      (!term||[account.name,account.username,account.department,account.accountRole,...account.roles.map(role=>role.role)].some(value=>String(value??'').toLowerCase().includes(term))));
  },[response,query,actingOnly]);
  if(DB.currentUser?.role!=='Admin')return null;
  return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Effective access by account">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Effective access by account</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
          Shows permanent roles, formally appointed positions, and active authorized substitutes. Delegation provides only the listed workflow responsibilities; it does not grant every permission in the role's general matrix.
        </p>
        {response&&<p className="mt-1 text-xs text-slate-500">Authority verified against cloud records · {response.asOf} (Asia/Manila)</p>}
      </div>
      <button type="button" onClick={()=>void refresh()} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">{busy?'Refreshing…':'Refresh access'}</button>
    </div>
    {!CLOUD_API_BASE && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Cloudflare connection is required to verify current appointments and delegations.</p>}
    {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">Could not verify access: {error}</p>}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search employee, username, department or role" aria-label="Search accounts" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm"/>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={actingOnly} onChange={e=>setActingOnly(e.target.checked)} className="accent-[#a64f32]"/> Active substitutes only</label>
    </div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map(account=><article key={account.id} className="min-w-0 rounded-xl border border-slate-200 bg-[#fdfcf9] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><h3 className="truncate text-base font-bold text-slate-900">{account.name}</h3><div className="break-all text-xs text-slate-500">@{account.username} · {account.department}</div></div>
          <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${account.active?'bg-emerald-100 text-emerald-800':'bg-slate-200 text-slate-700'}`}>{account.active?'Active':'Inactive'}</span>
        </div>
        <div className="mt-3 space-y-2">
          {account.roles.length ? account.roles.map((role,index)=><RoleTag key={`${account.id}-${role.role}-${role.source}-${index}`} role={role}/>) : <p className="text-xs text-slate-500">No effective permissions. Account is not active.</p>}
        </div>
      </article>)}
    </div>
    {response&&items.length===0&&<p className="rounded-lg border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">No accounts match the selected filters.</p>}
    <p className="text-xs leading-5 text-slate-500">Temporary authority is always revalidated by the Worker at the time an approval, invoice verification or payment is submitted. Expired, revoked or pending delegations do not confer access.</p>
  </section>;
}

/** Matrix settings remain role-based; the second section shows verified account-level coverage. */
export default function AccessControlPage() {
  return <div className="space-y-5">
    <EffectiveAccountAccess />
    <HtmlView html={renderAccessControlView()} />
  </div>;
}
