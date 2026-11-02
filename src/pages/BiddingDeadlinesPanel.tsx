import { useEffect, useState } from 'react';
import { DB } from '../store/state';
import { canManageBidding } from '../domain/permissions';
import { CLOUD_API_BASE } from '../services/cloud';
import { deadlineIsOpen, getDeadline, loadDeadlines, updateDeadline } from '../services/sourcing';

function statusFor(needId:string) {
  const d=getDeadline(needId);
  if (!d) return 'Deadline not configured — bidding closed';
  if (d.manuallyClosed) return 'Manually closed';
  return deadlineIsOpen(needId) ? `Open until ${new Date(d.closesAt).toLocaleString()}` : `Closed since ${new Date(d.closesAt).toLocaleString()}`;
}

export default function BiddingDeadlinesPanel({onUpdated}:{onUpdated?:()=>void}) {
  const [version,refresh]=useState(0);
  const [error,setError]=useState('');
  const [saving,setSaving]=useState('');
  const [localDates,setLocalDates]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(true);
  const management=canManageBidding();
  useEffect(()=>{
    if (!CLOUD_API_BASE) {setLoading(false);return;}
    let active=true;
    const fetchRows=async()=>{try {await loadDeadlines();if(active){refresh(x=>x+1);onUpdated?.();}}catch(e){if(active)setError((e as Error).message);}finally{if(active)setLoading(false);}};
    void fetchRows();
    const timer=window.setInterval(()=>{void fetchRows();},30000);
    return ()=>{active=false;window.clearInterval(timer);};
  },[]);
  async function save(needId:string,closed:boolean) {
    const existing=getDeadline(needId);
    const input=localDates[needId];
    const closesAt=input ? new Date(input).toISOString() : existing?.closesAt;
    if (!closesAt) {setError('Choose a deadline first.');return;}
    setSaving(needId);setError('');
    try {await updateDeadline(needId,closesAt,closed);refresh(x=>x+1);onUpdated?.();}
    catch(e){setError((e as Error).message);}finally{setSaving('');}
  }
  const needs=DB.stockNeeds.filter(n=>n.status==='Published');
  if (!CLOUD_API_BASE) return <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Cloudflare is required for enforceable bid deadlines and supplier accreditation.</div>;
  if (!needs.length) return null;
  return <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="font-bold text-slate-800">Bidding Deadlines</h3><p className="text-xs text-slate-500">Closed automatically at the server deadline. All times below display in your device's timezone.</p></div>
      <span className="text-xs text-slate-500">{loading ? 'Loading deadlines…' : `Synced · ${needs.length} published need(s)`}</span>
    </div>
    {error && <p role="alert" className="mb-3 rounded bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
    <div className="space-y-2" key={version}>
      {needs.map(need=><div key={need.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:flex-row md:items-center md:justify-between">
        <div><p className="text-sm font-semibold">{need.id} · {need.title}</p>
          <p className={'mt-1 text-xs '+(deadlineIsOpen(need.id)?'text-emerald-700':'text-amber-700')}>{statusFor(need.id)}</p>
        </div>
        {management && <div className="flex flex-wrap items-center gap-2">
          <input type="datetime-local" aria-label={`Deadline for ${need.id}`} value={localDates[need.id]||''} onChange={e=>setLocalDates(old=>({...old,[need.id]:e.target.value}))} className="rounded border border-slate-300 bg-white px-2 py-2 text-xs" />
          <button disabled={saving===need.id} onClick={()=>void save(need.id,false)} className="rounded bg-sky-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{saving===need.id?'Saving…':'Set / Reopen'}</button>
          {getDeadline(need.id) && <button disabled={saving===need.id} onClick={()=>void save(need.id,true)} className="rounded border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">Close now</button>}
        </div>}
      </div>)}
    </div>
  </section>;
}
