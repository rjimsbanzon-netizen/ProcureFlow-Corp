import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {DB} from '../store/state';
import {delegationAPI,type DelegationList,type DelegationRole,type RequestKind,type Delegation} from '../services/delegations';
import {confirmAction,requestInput} from '../services/actionDialogs';
import {CLOUD_API_BASE} from '../services/cloud';
import {navigateTo} from '../core/renderBridge';

const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const finance=(s:string)=>['finance & accounting','finance and accounting','finance'].includes(s.toLowerCase().trim());
const hr=(s:string)=>['human resources','human resource','hr'].includes(s.toLowerCase().trim());
const roleLabel=(role:DelegationRole,department:string)=>role==='Operations Head'?'Operations Head → Operations Officer':role==='Department Head'&&hr(department)?'Human Resources Head':role==='Department Head'?`${department} · Department Head`:role;
function description(role:DelegationRole){
 return role==='Operations Head'?'Eligible substitute: appointed Operations Officer. Their coverage is limited to Operations PR submission.':role==='Procurement Head'?'Eligible substitute: active Procurement Officer.':role==='Department Head'?'Eligible substitute: active Employee from the same department (including Human Resources). Their authority covers department PR submission only.':'Eligible substitute: active Finance & Accounting Employee with no conflicting Finance approval assignment.';
}
function labelFor(d:Delegation){
 if(d.revoked_at)return 'Revoked';
 if(d.review_status==='Rejected'||d.review_status==='Cancelled'||d.review_status==='Pending')return d.review_status;
 if(d.ends_on<today())return 'Expired';
 if(d.starts_on>today())return 'Scheduled';
 return 'Active';
}
const cls=(label:string)=>label==='Active'?'bg-emerald-100 text-emerald-800':label==='Pending'?'bg-amber-100 text-amber-800':label==='Rejected'||label==='Revoked'||label==='Cancelled'?'bg-rose-100 text-rose-700':'bg-slate-100 text-slate-600';
export default function ApprovalDelegationPage(){
 const [data,setData]=useState<DelegationList|null>(null);
 const [chosenAssignment,setChosenAssignment]=useState('');
 const [kind,setKind]=useState<RequestKind>('Leave');
 const [delegate,setDelegate]=useState('');
 const [start,setStart]=useState(today()),[end,setEnd]=useState('');
 const [reason,setReason]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const admin=DB.currentUser?.role==='Admin';
 const myId=DB.currentUser?.id;
 const load=async()=>{const response=await delegationAPI.list();setData(response);return response;};
 useEffect(()=>{if(!CLOUD_API_BASE)return;void load().catch(e=>setError(e instanceof Error?e.message:String(e)))},[]);
 // The Operations delegation must never disappear from the Admin selector just
 // because an appointment is vacant or an older Worker omitted the role. Only
 // the Worker can authorize a submitted request; the placeholder has no user.
 const availableAssignments=useMemo(()=>{
  const assignments=(data?.principals||[]).filter(p=>admin||p.user?.id===myId);
  if(!data||!admin)return assignments;
  const withVacancies=[...assignments];
  if(!withVacancies.some(p=>p.role==='Operations Head'))
   withVacancies.push({role:'Operations Head',department:'',user:null,eligibleStaffIds:[]});
  if(!withVacancies.some(p=>p.role==='Department Head'&&hr(p.department)))
   withVacancies.push({role:'Department Head',department:'Human Resources',user:null,eligibleStaffIds:[]});
  return withVacancies;
 },[admin,data,myId]);
 const operationsSupported=Boolean(data?.principals?.some(p=>p.role==='Operations Head'));
 const operationsHeadAppointed=Boolean(data?.principals?.some(p=>p.role==='Operations Head'&&p.user));
 const keyFor=(role:DelegationRole,department:string)=>`${role}::${department}`;
 const chosen=availableAssignments.find(p=>keyFor(p.role,p.department)===chosenAssignment)||availableAssignments[0];
 const selectedRole=chosen?.role;
 const selectedDepartment=chosen?.department||'';
 const primary=chosen?.user;
 const eligible=useMemo(()=>{
  if(!primary||!selectedRole)return [];
  const staff=data?.staff??[];
  // A newer Worker returns the candidates produced by the same eligibility
  // logic used by the secure submission route (including Finance conflicts).
  if(Array.isArray(chosen?.eligibleStaffIds)){
   const allowed=new Set(chosen.eligibleStaffIds);
   return staff.filter(person=>allowed.has(person.id));
  }
  // Retain compatibility while the updated Worker is being deployed.
  return staff.filter(person=>person.id!==primary.id&&(selectedRole==='Operations Head'?person.app_role==='Operations Officer'&&person.department.toLowerCase().trim()==='operations':selectedRole==='Procurement Head'
   ?person.app_role==='Procurement Officer'&&person.department.toLowerCase().trim()==='procurement'
   :selectedRole==='Department Head'?person.app_role==='Employee'&&person.department.trim().toLowerCase()===selectedDepartment.trim().toLowerCase():person.app_role==='Employee'&&finance(person.department)));
 },[data,chosen,selectedRole,selectedDepartment,primary]);
 // A different appointment or a refreshed roster may invalidate a prior choice.
 useEffect(()=>{
  if(delegate&&data&&!eligible.some(person=>person.id===delegate))setDelegate('');
 },[delegate,data,eligible]);
 const noStaffReason=useMemo(()=>{
  if(!data||!selectedRole||eligible.length)return '';
  if(!primary&&selectedRole==='Operations Head')return !operationsSupported
    ?'The connected Worker is not returning Operations Head delegation. Redeploy the updated Cloudflare Worker and confirm migration 0020 is applied.'
    :'No Operations Head is currently appointed. Admin must appoint an approved Operations Employee as Operations Head in Staff Assignments. Operations Officer will then be available as the substitute.';
  if(!primary)return selectedRole==='Department Head'&&hr(selectedDepartment)
    ?'No Human Resources Head is appointed. Admin must appoint an approved Human Resources employee under Staff Assignments first.'
    :'No active primary approver is appointed for this responsibility. Ask Admin to complete Staff Assignments.';
  const staff=data.staff||[];
  const normal=(name:string)=>name.trim().toLowerCase().replace(/\s+/g,' ');
  if(selectedRole==='Operations Head')return 'No eligible Operations Officer is available. Admin can appoint an approved Operations employee as Operations Officer under Staff Assignments, then refresh this page.';
  if(selectedRole==='Procurement Head'){
   const officers=staff.filter(p=>p.app_role==='Procurement Officer'&&p.id!==primary.id);
   if(!officers.length)return 'No active, approved account has the Procurement Officer role. Admin must approve an employee and set their role to Procurement Officer in User Verification.';
   if(!officers.some(p=>normal(p.department)==='procurement'))return 'Procurement Officer accounts exist, but none belongs to the Procurement department. Admin can correct their home department in Staff Assignments.';
   return 'Procurement Officers were found, but they are not currently eligible. Refresh the list and check their account status and assignment.';
  }
  if(selectedRole==='Department Head'){
   const colleagues=staff.filter(p=>p.id!==primary.id&&normal(p.department)===normal(selectedDepartment));
   if(!colleagues.length)return `No other active, approved staff accounts belong to ${selectedDepartment}. Admin can approve or transfer an employee to this department.`;
   if(!colleagues.some(p=>p.app_role==='Employee'))return `The staff in ${selectedDepartment} do not have the regular Employee role. Only an approved Employee in this department can cover Department Head PR submission.`;
   return 'The available employees do not satisfy the current delegation rules. Admin should review their assignments.';
  }
  const financeStaff=staff.filter(p=>p.id!==primary.id&&finance(p.department));
  if(!financeStaff.some(p=>p.app_role==='Employee'))return 'No active, approved regular Employee is available in Finance & Accounting. Admin can approve or transfer an employee.';
  return 'Finance employees were found, but their existing Finance approval assignments or separation-of-duties restrictions make them ineligible.';
 },[data,primary,selectedRole,selectedDepartment,eligible]);
 async function submit(e:FormEvent){
  e.preventDefault();if(!selectedRole||!delegate||!start||!end||!primary)return;
  setBusy(true);setError('');setSuccess('');
  try{
   const result=await delegationAPI.create({stepRole:selectedRole,department:selectedDepartment,delegateUserId:delegate,startsOn:start,endsOn:end,reason,requestKind:kind});
   await load();setDelegate('');setReason('');setEnd('');
   setSuccess(result.status==='Pending'?'Your request has been submitted for Admin review. No temporary authority is granted until approved.':'The delegation has been authorized on the assigned approver’s behalf.');
  }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }
 async function review(d:Delegation,decision:'approve'|'reject'){
  if(!admin)return;
  let note='';
  if(decision==='approve'){
   if(!await confirmAction({title:'Approve delegation request',message:`Authorize ${d.delegate_name} to act for ${d.primary_name} as ${d.step_role}${d.department?' ('+d.department+')':''} from ${d.starts_on} through ${d.ends_on}? This grants only the specified responsibility during these dates.`,confirmText:'Approve request'}))return;
  }else{
   const response=await requestInput({title:'Reject delegation request',message:`Explain why ${d.primary_name}'s request is being rejected.`,label:'Rejection reason',multiline:true,required:true,tone:'warning',confirmText:'Reject request'});
   if(response===null)return;
   note=response;
  }
  setBusy(true);setError('');setSuccess('');
  try{await delegationAPI.decide(d.id,decision,note);await load();setSuccess(decision==='approve'?'Delegation approved; the substitute may act during the approved period.':'Request rejected. The substitute has not been granted approval rights.');}
  catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }
 async function revoke(d:Delegation){
  const pending=d.review_status==='Pending';
  if(!await confirmAction({title:pending?'Cancel delegation request':'Revoke approved delegation',message:pending?`Cancel ${d.primary_name}'s pending request?`:`Immediately revoke ${d.delegate_name}'s substitute approval authority for ${d.step_role}?`,tone:'warning',confirmText:pending?'Cancel request':'Revoke delegation'}))return;
  setBusy(true);setError('');setSuccess('');
  try{await delegationAPI.revoke(d.id);await load();setSuccess(pending?'Delegation request cancelled.':'Delegation revoked. The substitute loses acting-role authority immediately on the server and returns to their original account access.');}
  catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }
 const pending=data?.delegations.filter(d=>d.review_status==='Pending'&&!d.revoked_at)||[];
 return <section className="max-w-6xl mx-auto space-y-5">
  <header className="bg-white rounded-xl border border-slate-200 p-5 flex flex-wrap justify-between gap-3">
   <div><h2 className="text-xl font-bold text-slate-900">Approval Delegation & Leave Requests</h2>
    <p className="text-sm text-slate-500 mt-1">Appointed Heads (including Operations Head and Human Resources Head) can request temporary PR submission coverage for their department. Procurement Head and Finance approvers can request their own substitute. Admin may submit on their behalf. No self-approval is permitted.</p></div>
   <button className="rounded-lg border px-3 py-2 text-sm" onClick={()=>void load().catch(e=>setError(e instanceof Error?e.message:String(e)))}>Refresh</button>
  </header>
  {!CLOUD_API_BASE&&<div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-lg">Cloudflare D1 must be connected to manage delegation.</div>}
  {error&&<p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
  {success&&<p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
  {!admin&&data&&!availableAssignments.length&&<div className="bg-slate-50 border rounded-xl p-5 text-sm text-slate-600">Only currently appointed Operations / Human Resources / other Department Heads, Procurement Head, Finance Officer, or Finance Head may submit leave/delegation requests. You can still view delegations where you are the substitute.</div>}
  {(admin||availableAssignments.length>0)&&<form onSubmit={submit} className="bg-white border rounded-xl p-5 space-y-4">
   <div><h3 className="text-base font-bold">{admin?'Submit on behalf of an assigned approver':'Request leave / temporary approval coverage'}</h3>
    <p className="text-sm text-slate-500">{admin?'Admin-submitted delegations are authorized immediately and recorded with the submitting account.':'Your request goes to Admin for review. Until approved, the substitute has no signing authority.'} Department Head coverage is limited to PR submission; the Admin final approval step cannot be delegated.</p>
    <p className="mt-2 text-xs text-slate-600">For Operations, select <strong>Operations Head → Operations Officer</strong> under Approval responsibility. Operations Officer is the substitute you choose in the Authorized substitute field, not a separate approval step.</p>
    {admin&&data&&!operationsSupported&&<p role="alert" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"><strong>Operations delegation backend update needed:</strong> The current Worker did not return the Operations Head role. The entry is displayed for setup, but delegation cannot be submitted until the updated Worker is deployed and migration 0020 has been applied.</p>}
    {admin&&data&&operationsSupported&&!operationsHeadAppointed&&<p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Operations Head is supported but no approved Head is appointed. Open Staff Assignments to appoint one; then select an Operations Officer as substitute.</p>}</div>
   <div className="grid gap-3 lg:grid-cols-2">
    <label className="text-sm font-semibold">Approval responsibility<select className="block mt-1 w-full p-2.5 rounded-lg border font-normal" value={chosen?keyFor(chosen.role,chosen.department):''} onChange={e=>{setChosenAssignment(e.target.value);setDelegate('')}} required>{!chosen&&<option value="">Select responsibility</option>}{availableAssignments.map(p=><option key={keyFor(p.role,p.department)} value={keyFor(p.role,p.department)}>{roleLabel(p.role,p.department)}</option>)}</select></label>
    <label className="text-sm font-semibold">Assigned primary approver<input className="block mt-1 w-full p-2.5 rounded-lg border bg-slate-50 font-normal" readOnly value={primary?`${primary.name} · ${primary.department}`:'No eligible primary approver assigned'} /></label>
    <label className="text-sm font-semibold">Request type<select className="block mt-1 w-full p-2.5 rounded-lg border font-normal" value={kind} onChange={e=>setKind(e.target.value as RequestKind)}><option value="Leave">Leave / absence coverage</option><option value="Delegation">Temporary delegation</option></select></label>
    <label className="text-sm font-semibold">Authorized substitute<select className="block mt-1 w-full p-2.5 rounded-lg border font-normal" value={delegate} required onChange={e=>setDelegate(e.target.value)}><option value="">{!data?'Loading eligible staff…':eligible.length?'Choose eligible staff':'No eligible staff available'}</option>{eligible.map(p=><option key={p.id} value={p.id}>{p.name} · {p.app_role} · {p.department}</option>)}</select><span className="mt-1 block text-xs text-slate-500 font-normal">{selectedRole?description(selectedRole):''}</span></label>
    {noStaffReason&&<div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 lg:col-span-2">
      <p className="font-semibold">Why no eligible staff are listed</p>
      <p className="mt-1 leading-6">{noStaffReason}</p>
      {admin&&<div className="mt-3 flex flex-wrap gap-2">
       <button type="button" onClick={()=>navigateTo('users')} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100">Review accounts &amp; roles</button>
       <button type="button" onClick={()=>navigateTo('staff_assignments')} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100">Manage staff departments</button>
      </div>}
    </div>}
    <div className="grid grid-cols-2 gap-3 lg:col-span-2"><label className="text-sm font-semibold">Start date<input type="date" className="block mt-1 w-full border rounded-lg p-2.5 font-normal" value={start} min={today()} onChange={e=>setStart(e.target.value)} required /></label><label className="text-sm font-semibold">End date<input type="date" className="block mt-1 w-full border rounded-lg p-2.5 font-normal" value={end} min={start} onChange={e=>setEnd(e.target.value)} required /></label></div>
   </div>
   <label className="text-sm font-semibold block">Reason for leave / delegation<textarea className="block mt-1 border rounded-lg p-2.5 w-full font-normal" value={reason} required minLength={5} maxLength={500} rows={2} onChange={e=>setReason(e.target.value)} placeholder="e.g. Medical leave, Nov 10–15; temporary coverage needed for pending PR approvals" /></label>
   <button disabled={!CLOUD_API_BASE||!primary||!delegate||!end||end<start||busy} className="pf-primary-action bg-[#a64f32] disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-lg">{busy?'Submitting…':admin?'Authorize on behalf of approver':'Submit request for Admin approval'}</button>
  </form>}
  {admin&&pending.length>0&&<section className="bg-white border rounded-xl overflow-hidden">
   <div className="p-5 border-b"><h3 className="font-bold">Requests awaiting Admin review ({pending.length})</h3><p className="text-sm text-slate-500">Check leave dates and the proposed substitute before granting temporary approval rights.</p></div>
   <div className="divide-y">{pending.map(d=><div key={d.id} className="p-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between"><div className="text-sm"><p className="font-semibold text-slate-900">{d.primary_name} · {roleLabel(d.step_role,d.department)}{d.department&&d.step_role!=='Department Head'?' ('+d.department+')':''} · {d.request_kind}</p><p className="text-slate-600">{d.delegate_name} covering {d.starts_on} to {d.ends_on}</p><p className="text-slate-500">{d.reason}</p></div><div className="flex gap-2"><button disabled={busy} onClick={()=>void review(d,'reject')} className="border border-rose-300 text-rose-700 font-semibold rounded-lg px-3 py-2 text-sm">Reject</button><button disabled={busy} onClick={()=>void review(d,'approve')} className="bg-[#a64f32] text-white font-semibold rounded-lg px-3 py-2 text-sm">Approve request</button></div></div>)}</div>
  </section>}
  <section className="bg-white border rounded-xl overflow-hidden"><div className="p-5 border-b"><h3 className="font-bold">Delegation requests & history</h3><p className="text-xs text-slate-500 mt-1">Pending requests never grant approval rights. Only approved delegations within their date range are effective; Department Head substitutes can submit PRs but cannot approve them.</p></div>
   <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-600"><tr>{['Type / responsibility','Assigned approver','Substitute','Dates','Submitted by','Status','Reason / decision','Actions'].map(h=><th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{data?.delegations.map(d=>{const status=labelFor(d);return <tr key={d.id} className="border-t"><td className="p-3"><strong>{roleLabel(d.step_role,d.department)}{d.department&&d.step_role!=='Department Head'?' · '+d.department:''}</strong><div className="text-xs text-slate-500">{d.request_kind||'Delegation'}</div></td><td className="p-3">{d.primary_name}</td><td className="p-3">{d.delegate_name}</td><td className="p-3 whitespace-nowrap">{d.starts_on} – {d.ends_on}</td><td className="p-3">{d.submitted_by_name||'—'}</td><td className="p-3"><span className={'rounded-full px-2.5 py-1 text-xs font-bold '+cls(status)}>{status}</span></td><td className="p-3 max-w-56 break-words">{d.reason}{d.review_note&&<div className="text-xs text-slate-500 mt-1">Admin note: {d.review_note}</div>}</td><td className="p-3">{(admin||d.primary_user_id===myId)&&!d.revoked_at&&(d.review_status==='Pending'||d.review_status==='Approved'&&d.ends_on>=today())&&<button disabled={busy} onClick={()=>void revoke(d)} className="text-rose-700 font-semibold hover:underline">{d.review_status==='Pending'?'Cancel request':'Revoke'}</button>}</td></tr>})}</tbody></table>
    {!data?.delegations.length&&<p className="p-6 text-sm text-slate-500">No delegation requests registered.</p>}</div>
  </section>
 </section>;
}
