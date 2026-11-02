import { useCallback,useEffect,useState } from 'react';
import { confirmAction, requestInput } from '../services/actionDialogs';
import {financeAPI,requireFinanceCloud } from '../services/finance';
import { isFinanceDepartment } from '../domain/staffPositions';
import type {ApprovalRequest,FinanceSettings} from '../services/finance';
import {DB} from '../store/state';
import {CLOUD_API_BASE,cloudRequest} from '../services/cloud';
import { Storage } from '../services/storage';
import { RestoreMissingRecord } from '../components/RestoreMissingRecord';
import { delegationAPI, type Delegation, type DelegationRole } from '../services/delegations';
import { EmptyState, LoadingState } from '../components/FeedbackState';

const isExecutiveDepartment=(department:string)=>department.trim().toLowerCase()==='executive';
const money=(value:number)=>`₱${value.toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
function approvalIntegrityMessage(r:ApprovalRequest):string|null {
  if(r.status!=='Pending')return null;
  if(!r.pr)return 'This PR is missing from the shared cloud records. Ask Admin to restore it; do not create a duplicate.';
  if(r.pr.status!=='Pending')return `The PR shows ${r.pr.status}, but the approval workflow is still Pending. An Admin can reconcile this only after checking there is no linked bidding need or PO.`;
  if(!Number.isFinite(Number(r.pr.totalCost))||Math.round(Number(r.pr.totalCost)*100)!==Math.round(r.amount*100))return 'The current PR amount differs from its submitted approval amount. Admin review is required.';
  if(String(r.pr.department??'').trim().toLowerCase()!==r.department.trim().toLowerCase())return 'The department has changed since submission. Admin review is required.';
  return null;
}
export default function ApprovalsPage(){
  const [items,setItems]=useState<ApprovalRequest[]>([]);
  const [delegatedRoles,setDelegatedRoles]=useState<DelegationRole[]>([]);
  const [delegatedDepartments,setDelegatedDepartments]=useState<string[]>([]);
  const [activeCover,setActiveCover]=useState<Delegation[]>([]);
  const [filter,setFilter]=useState<'all'|'mine'|'pending'|'finished'>('all');
  const [settings,setSettings]=useState<FinanceSettings|null>(null);
  const [busy,setBusy]=useState(false); const [loaded,setLoaded]=useState(false); const [error,setError]=useState(''); const [note,setNote]=useState('');
  const me=DB.currentUser;
  const refresh=useCallback(async()=>{
    try {
      requireFinanceCloud();
      const [a,s,latest,delegation]=await Promise.all([
        financeAPI.approvals(), financeAPI.settings(),
        cloudRequest('/enterprise-state') as Promise<{data?:{requisitions?:typeof DB.requisitions}}>,
        delegationAPI.list().catch(()=>({activeRoles:[] as DelegationRole[],activeDepartments:[] as string[],delegations:[] as Delegation[]}))
      ]);
      if(Array.isArray(latest?.data?.requisitions)) DB.requisitions=latest.data.requisitions;
      setItems(a.requests);setSettings(s);setDelegatedRoles(delegation.activeRoles);setDelegatedDepartments(delegation.activeDepartments||[]);
      const today=new Date().toLocaleDateString('en-CA');
      setActiveCover((delegation.delegations||[]).filter(d=>d.review_status==='Approved'&&!d.revoked_at&&d.starts_on<=today&&d.ends_on>=today&&(d.delegate_user_id===DB.currentUser?.id||d.primary_user_id===DB.currentUser?.id)));
      setError('');
    }
    catch(e){setError(e instanceof Error?e.message:String(e));}
    finally {setLoaded(true);}
  },[]);
  useEffect(()=>{void refresh()},[refresh]);
  const existing=new Set(items.map(i=>i.prId));
  const isAssignedDepartmentHead=(department:string)=>settings?.assignments.some(
    a=>a.step_role==='Department Head'&&a.department===department&&a.user_id===me?.id
  )??false;
  const pending=loaded&&settings?DB.requisitions.filter(pr=>
    pr.status==='Pending'&&!existing.has(pr.id)&& (me?.role==='Admin'||(isAssignedDepartmentHead(pr.department)&&me?.department===pr.department)||delegatedDepartments.some(d=>d.trim().toLowerCase()===pr.department.trim().toLowerCase()))
  ):[];
  const canDecide=(r:ApprovalRequest)=>{
    const step=r.steps.find(s=>s.number===r.currentStep);
    if(!step||r.status!=='Pending'||approvalIntegrityMessage(r)||r.requestedBy===me?.id)return false;
    if(step.role==='Department Head')return false; // Request submission is not an approval.
    if(step.role==='Admin')return me?.role==='Admin' && r.financeHead?.status!=='Pending';
    if(step.role==='Procurement Head')return me?.role==='Procurement Head'||delegatedRoles.includes('Procurement Head');
    return delegatedRoles.includes(step.role as DelegationRole)||(settings?.assignments.some(a=>a.step_role===step.role&&a.user_id===me?.id&&(step.role==='Finance Officer'||a.department===r.department))??false);
  };
  const isAssignedFinanceHead = settings?.assignments.some(a =>
    a.step_role==='Department Head' && isFinanceDepartment(a.department) && a.user_id===me?.id
  ) ?? false;
  const canSignFinanceHead=(r:ApprovalRequest)=>
    (isAssignedFinanceHead||delegatedRoles.includes('Finance Head')) && r.status==='Pending' && r.financeHead?.status==='Pending' &&
    r.requestedBy!==me?.id && !approvalIntegrityMessage(r) &&
    r.steps.some(step=>step.role==='Finance Officer'&&step.status==='Approved') &&
    !delegatedRoles.includes('Finance Officer') && !r.steps.some(s=>s.role==='Finance Officer'&&s.decidedBy===me?.id) &&
    !settings?.assignments.some(a=>a.step_role==='Finance Officer'&&a.user_id===me?.id);
  const financeHeadDecision=async(r:ApprovalRequest,decision:'approve'|'reject')=>{
    const comment=await requestInput({
      title:decision==='reject'?'Reject as Finance Head':'Finance Head Authorization',
      message:`${r.prId} · ${r.department} · ${money(r.amount)}.\n${decision==='reject'?'Explain why this requisition cannot proceed.':'Review and record your authorization note before proceeding.'}`,
      label:decision==='reject'?'Rejection reason':'Finance Head approval note',
      multiline:true, required:decision==='reject',tone:decision==='reject'?'danger':'default',
      confirmText:decision==='reject'?'Reject requisition':'Approve as Finance Head'
    });
    if(comment===null)return;
    void run(()=>financeAPI.decideFinanceHead(r.prId,decision,comment),`Finance Head decision recorded for ${r.prId}.`);
  };
  async function run(action:()=>Promise<unknown>,message:string,after?:()=>Promise<void>){
    setBusy(true);setError('');setNote('');
    try{await action();if(after)await after();setNote(message);await refresh();}
    catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }
  const reconcile=async(pr:ApprovalRequest)=>{
    if(me?.role!=='Admin')return;
    if(!await confirmAction({title:'Restore pending approval',message:`Restore ${pr.prId} from Approved to Pending? This is permitted only when its amount matches and no bidding need or PO is linked.`,tone:'warning',confirmText:'Restore pending status'}))return;
    void run(()=>cloudRequest(`/finance/approvals/${encodeURIComponent(pr.prId)}/reconcile`,{method:'POST',body:'{}'}),`${pr.prId} status reconciled. Procurement Head can now resume the pending approval step.`,async()=>{
      const latest=await cloudRequest('/enterprise-state') as {data?:{requisitions?:typeof DB.requisitions}};
      if(Array.isArray(latest?.data?.requisitions))DB.requisitions=latest.data.requisitions;
    });
  };
  const doDecision=async(pr:ApprovalRequest,decision:'approve'|'reject')=>{
    const comment=await requestInput({
      title:decision==='reject'?'Reject Purchase Requisition':'Approve Purchase Requisition',
      message:`${pr.prId} · ${pr.department} · ${money(pr.amount)}.\n${decision==='reject'?'Provide a reason for rejecting this approval step.':'You are approving the currently assigned step in the procurement workflow.'}`,
      label:decision==='reject'?'Rejection reason':'Approval note',
      multiline:true,required:decision==='reject',tone:decision==='reject'?'danger':'default',
      confirmText:decision==='reject'?'Reject requisition':'Approve step'
    });
    if(comment===null)return;
    void run(()=>financeAPI.decide(pr.prId,decision,comment),`Decision recorded for ${pr.prId}.`,async()=>{
      // Refresh the PR status from the authoritative cloud snapshot without saving stale local data.
      const latest = await cloudRequest('/enterprise-state') as { data?: { requisitions?: typeof DB.requisitions; };};
      if(Array.isArray(latest?.data?.requisitions)) {DB.requisitions=latest.data.requisitions}
    });
  };
  const myDecisions=items.filter(r=>canDecide(r)||canSignFinanceHead(r));
  const visible=items.filter(r=>filter==='all'||(filter==='mine'?(canDecide(r)||canSignFinanceHead(r)):filter==='pending'?r.status==='Pending':r.status!=='Pending'));
  return <section className="max-w-6xl mx-auto space-y-5">
    <header className="bg-white rounded-xl border border-slate-200 p-5 flex flex-wrap justify-between gap-3 items-center">
      <div><h2 className="text-xl font-bold text-slate-900">Multi-level PR Approvals</h2><p className="text-sm text-slate-500">Department Head submits (Admin for Executive) → Procurement Head → Finance Officer → Finance Head for high-value PRs → Admin. No requester self-approval.</p></div>
      <button onClick={()=>void refresh()} className="rounded-lg border px-3 py-2 text-sm">Refresh</button>
    </header>
    {activeCover.length>0 && <aside className="rounded-xl border border-[#ead5c9] bg-[#fff8f1] p-4" aria-label="Current approval delegation coverage"><h3 className="font-bold text-[#873e27]">Active approval coverage</h3><div className="mt-2 space-y-1 text-sm text-slate-700">{activeCover.map(d=><p key={d.id}><strong>{d.step_role}{d.department ? ` · ${d.department}` : ''}</strong>: {d.delegate_name} covering {d.primary_name}, until <time dateTime={d.ends_on}>{d.ends_on}</time>.</p>)}</div><p className="mt-2 text-xs text-slate-500">Delegation changes the assigned approval authority only while it is approved and active. Existing separation-of-duties checks still apply.</p></aside>}
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-800">{items.filter(r=>r.status==='Pending').length} pending</span><span className="rounded-full bg-[#f8eee9] px-3 py-1.5 text-[#873e27]">{myDecisions.length} awaiting my decision</span><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-800">{items.filter(r=>r.status==='Approved').length} approved</span></div><label className="text-sm font-semibold text-slate-700">Show <select aria-label="Filter approval requests" className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}><option value="all">All requests</option><option value="mine">Awaiting my decision</option><option value="pending">All pending</option><option value="finished">Completed decisions</option></select></label></div>
    {!CLOUD_API_BASE&&<p className="border border-amber-200 bg-amber-50 rounded-lg p-4 text-sm text-amber-900">Requires Cloudflare D1. Existing local demo PR approvals are unchanged.</p>}
    {error&&<p role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-3 text-sm">{error}</p>}
    {note&&<p role="status" className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-sm">{note}</p>}
    {pending.length>0&&<div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"><h3 className="font-semibold">Pending requisitions awaiting submission</h3>{pending.map(pr=><div key={pr.id} className="flex gap-3 items-center justify-between border rounded-lg p-3"><div className="text-sm"><strong>{pr.id} · {pr.itemTitle}</strong><p className="text-slate-500">{pr.department} · {money(Number(pr.totalCost||0))}</p>{me?.role==='Admin'&&isExecutiveDepartment(pr.department)&&<p className="mt-1 text-xs text-amber-800">Executive has no Department Head appointment. You can submit this PR directly as Admin. A different Admin account is required for any final Admin approval.</p>}</div><button disabled={busy||!CLOUD_API_BASE} onClick={()=>void run(async()=>{await Storage.flush();return financeAPI.start(pr.id)},`${pr.id} submitted to Procurement Head for approval.`)} className="text-sm px-3 py-2 rounded-lg bg-[#a64f32] text-white disabled:opacity-50">{me?.role==='Admin'&&isExecutiveDepartment(pr.department)?'Submit as Admin':'Start approval'}</button></div>)}</div>}
    <div className="space-y-4">{!loaded?<LoadingState title="Loading approval requests" description="Checking the current approval workflow and assigned duties…"/>:visible.length===0?<EmptyState icon="fa-list-check" title={items.length?'No approvals match this filter':'No approval requests yet'} description={items.length?'Choose another status filter to view approval history.':'Requisitions submitted for review will appear here once the approval workflow starts.'} />:visible.map(item=>{
      const current=item.steps.find(s=>s.number===item.currentStep);
      const integrityWarning=approvalIntegrityMessage(item);
      return <div key={item.prId} className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap justify-between gap-3"><div><div className="text-xs font-bold text-[#a64f32]">{item.prId} · {item.department}</div><h3 className="font-semibold text-slate-900 mt-1">{item.pr?.itemTitle||'Purchase Requisition'}</h3><p className="text-sm text-slate-500">Estimated value: {money(item.amount)}</p></div><span className={'rounded-full px-3 py-1 text-xs font-semibold self-start '+(item.status==='Approved'?'bg-emerald-100 text-emerald-800':item.status==='Rejected'?'bg-rose-100 text-rose-800':'bg-amber-100 text-amber-800')}>{item.status}</span></div>
        <div className="flex flex-col md:flex-row gap-2">{item.steps.map(step=><div key={step.number} className={'flex-1 rounded-lg p-3 border text-sm '+(step.status==='Approved'?'border-emerald-200 bg-emerald-50':step.status==='Rejected'?'border-rose-200 bg-rose-50':step.number===item.currentStep?'border-[#a64f32] bg-[#faf4ec]':'border-slate-200 bg-slate-50')}><div className="text-xs font-bold text-slate-600">STEP {step.number}</div><div className="font-semibold mt-1">{step.role==='Department Head'?(isExecutiveDepartment(item.department)?'Executive request submitted':'Request submitted'):step.role}</div><div className="text-xs mt-1 text-slate-500">{step.role==='Department Head'&&step.status==='Approved'?'Submitted':step.status}{step.decidedAt?` · ${step.decidedAt.slice(0,10)}`:''}</div>{step.comment&&<div className="text-xs mt-2">{step.comment}</div>}</div>)}</div>
        {item.financeHead && <div className={'rounded-lg border p-3 text-sm '+(item.financeHead.status==='Approved'?'border-emerald-200 bg-emerald-50':item.financeHead.status==='Rejected'?'border-rose-200 bg-rose-50':'border-amber-200 bg-amber-50')}>
          <strong>Higher-level Finance Head authorization: {item.financeHead.status}</strong>
          <span className="ml-2 text-slate-600">After Finance Officer review; required before Admin final approval.</span>
          {item.financeHead.comment&&<p className="mt-2 text-xs">{item.financeHead.comment}</p>}
          {canSignFinanceHead(item)&&<div className="mt-3 flex justify-end gap-2"><button disabled={busy} onClick={()=>financeHeadDecision(item,'reject')} className="rounded border border-rose-300 px-3 py-2 font-semibold text-rose-700">Reject</button><button disabled={busy} onClick={()=>financeHeadDecision(item,'approve')} className="rounded bg-[#a64f32] px-3 py-2 font-semibold text-white">Approve as Finance Head</button></div>}
        </div>}
        {integrityWarning&&<div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 space-y-2"><p><strong>Approval paused:</strong> {integrityWarning}</p>{me?.role==='Admin'&&!item.pr&&<RestoreMissingRecord kind='PR' recordId={item.prId} onRestored={refresh}/>} {me?.role==='Admin'&&item.pr?.status==='Approved'&&<button disabled={busy} onClick={()=>reconcile(item)} className="border border-amber-500 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50">Review and restore Pending status</button>}</div>}
        {canDecide(item)&&<div className="flex flex-wrap gap-2 border-t pt-3"><p className="text-sm text-slate-600 flex-1">Assigned step: <strong>{current?.role}</strong></p><button disabled={busy} onClick={()=>doDecision(item,'reject')} className="rounded-lg border border-rose-300 text-rose-700 px-4 py-2 text-sm disabled:opacity-50">Reject</button><button disabled={busy} onClick={()=>doDecision(item,'approve')} className="rounded-lg bg-[#a64f32] text-white px-4 py-2 text-sm disabled:opacity-50">Approve step</button></div>}
      </div>})}</div>
  </section>;
}
