import { useCallback, useEffect, useState } from 'react';
import { confirmAction, requestInput } from '../services/actionDialogs';
import type { FormEvent } from 'react';
import { DB } from '../store/state';
import { financeAPI } from '../services/finance';
import type { FinanceSettings } from '../services/finance';
import { invalidateStaffAssignments, isFinanceDepartment } from '../domain/staffPositions';
import { cloudRequest, mapCloudUser } from '../services/cloud';

type Person = { id:string; name:string; username:string; app_role:string; department:string };
type Duty = 'Department Head' | 'Operations Head' | 'Human Resources Head' | 'Finance Head' | 'Finance Officer';
type SavedDuty = 'Department Head' | 'Finance Officer';
const same=(a:string,b:string)=>a.trim().toLowerCase()===b.trim().toLowerCase();
const reserved=new Set(['procurement','finance & accounting','finance and accounting','finance','executive']);
const headAssignableDepartment=(name:string)=>!same(name,'Executive');

function savedDuty(duty:Duty, department:string):{role:SavedDuty;department:string} {
  if(duty==='Operations Head')return {role:'Department Head',department:'Operations'};
  if(duty==='Human Resources Head')return {role:'Department Head',department:'Human Resources'};
  if(duty==='Finance Officer')return {role:'Finance Officer',department:'*'};
  if(duty==='Finance Head')return {role:'Department Head',department:'Finance & Accounting'};
  return {role:'Department Head',department};
}
function displayDuty(role:string, department:string){
  if(role==='Department Head'&&same(department,'Procurement'))return 'Procurement Head';
  if(role==='Department Head'&&same(department,'Operations'))return 'Operations Head';
  if(role==='Department Head'&&same(department,'Human Resources'))return 'Human Resources Head';
  if(role==='Department Head'&&isFinanceDepartment(department))return 'Finance Head';
  return role;
}

export default function StaffAssignmentsPage(){
  const admin=DB.currentUser?.role==='Admin';
  const [settings,setSettings]=useState<FinanceSettings|null>(null);
  const [people,setPeople]=useState<Person[]>([]);
  const [departments,setDepartments]=useState<string[]>([]);
  const [duty,setDuty]=useState<Duty>('Department Head');
  const [department,setDepartment]=useState('');
  const [userId,setUserId]=useState('');
  const [newDepartment,setNewDepartment]=useState('');
  const [officerUserId,setOfficerUserId]=useState('');
  const [operationsOfficerUserId,setOperationsOfficerUserId]=useState('');
  const [transferUser,setTransferUser]=useState('');
  const [transferDepartment,setTransferDepartment]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  const reload=useCallback(async()=>{
    if(!admin)return;
    try{
      const [config,staff,catalog,accounts]=await Promise.all([
        financeAPI.settings(),financeAPI.staff(),financeAPI.departments(),cloudRequest('/users')
      ]);
      setSettings(config);
      setPeople(staff.people);
      setDepartments(catalog.departments);
      // Reflect Procurement Head account-role promotion/demotion and employee
      // transfers on User Verification without needing a new login.
      if(Array.isArray(accounts)) DB.users=accounts.map(u=>mapCloudUser(u,DB.suppliers as never[]));
      setError('');
    }catch(e){setError(e instanceof Error?e.message:String(e));}
  },[admin]);
  useEffect(()=>{void reload()},[reload]);

  if(!admin)return <div className="rounded-lg border bg-white p-5 text-rose-700">Administrator access required.</div>;
  const assignments=settings?.assignments??[];
  const saved=savedDuty(duty,department);
  const headDepartments=departments.filter(headAssignableDepartment);
  const current=assignments.find(a=>a.step_role===saved.role && same(a.department,saved.department));
  const targetDepartment=duty==='Operations Head'?'Operations':duty==='Human Resources Head'?'Human Resources':department;
  const eligible=people.filter(person=>{
    if(duty==='Finance Officer'||duty==='Finance Head'){
      if(!['Employee',duty].includes(person.app_role)||!isFinanceDepartment(person.department))return false;
    }else{
      if(!targetDepartment||!same(person.department,targetDepartment))return false;
      if(person.app_role!=='Employee' &&
        !(same(targetDepartment,'Procurement')&&person.app_role==='Procurement Head'))return false;
    }
    return !assignments.some(a=>a.user_id===person.id&&a.step_role!==saved.role);
  });
  const financeHead=assignments.find(a=>a.step_role==='Department Head'&&isFinanceDepartment(a.department));
  const financeOfficer=assignments.find(a=>a.step_role==='Finance Officer');
  const hasConflict=Boolean(financeHead&&financeOfficer&&financeHead.user_id===financeOfficer.user_id);
  const currentFinanceInvalid=financeOfficer&&!people.some(p=>p.id===financeOfficer.user_id&&['Employee','Finance Officer'].includes(p.app_role)&&isFinanceDepartment(p.department));
  const mismatchedProcurementHeads=people.filter(p=>p.app_role==='Procurement Head'&&!same(p.department,'Procurement'));
  const procurementOfficers=people.filter(p=>p.app_role==='Procurement Officer');
  const eligibleOperationsOfficers=people.filter(p=>p.app_role==='Employee'&&same(p.department,'Operations')&&!assignments.some(a=>a.user_id===p.id));
  const operationsOfficers=people.filter(p=>p.app_role==='Operations Officer'&&same(p.department,'Operations'));
  const eligibleOfficers=people.filter(p=>p.app_role==='Employee'&&same(p.department,'Procurement')&&!assignments.some(a=>a.user_id===p.id));

  async function operate(action:()=>Promise<unknown>,success:string){
    setBusy(true);setError('');setMessage('');
    try{
      await action();
      invalidateStaffAssignments();
      await reload();
      setMessage(success);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  async function assign(event:FormEvent){
    event.preventDefault();
    if(!userId||(duty==='Department Head'&&(!department||!headAssignableDepartment(department))))return;
    if(!eligible.some(p=>p.id===userId)){
      setError('Choose an active employee who belongs to this department.');return;
    }
    if(current&&current.user_id!==userId&&!await confirmAction({
      title:'Replace appointed Head',message:`Replace ${current.name} as ${displayDuty(saved.role,saved.department)}? The previous Head returns to Employee; their account and historical PRs remain.`,tone:'warning',confirmText:'Replace assignment'
    }))return;
    void operate(async()=>{
      await financeAPI.assign(saved.role,saved.department,userId);
      setUserId('');
    },`Saved ${displayDuty(saved.role,saved.department)} to Cloudflare. Only the new appointed Head has this responsibility.`);
  }
  async function remove(role:SavedDuty,dep:string,id:string,name:string){
    if(!await confirmAction({title:'Remove staff assignment',message:`Remove ${name} as ${displayDuty(role,dep)}? Pending approvals may pause until you assign a replacement.`,tone:'warning',confirmText:'Remove assignment'}))return;
    void operate(()=>financeAPI.unassign(role,dep,id),`${name} is no longer ${displayDuty(role,dep)}.`);
  }
  function createDepartment(event:FormEvent){
    event.preventDefault();
    const name=newDepartment.trim();
    if(!name)return;
    void operate(async()=>{await financeAPI.addDepartment(name);setNewDepartment('')},`Created department: ${name}. You can now transfer an employee and appoint its Head.`);
  }
  async function renameDepartment(name:string){
    const renamed=await requestInput({title:'Rename Department',message:`Enter a new name for ${name}.`,label:'New department name',initialValue:name,required:true,confirmText:'Review rename'});
    if(!renamed||renamed===name)return;
    if(!await confirmAction({title:'Confirm department rename',message:`Rename ${name} to ${renamed}? This changes the department for its staff and current assignments. Existing procurement history is protected.`,tone:'warning',confirmText:'Rename department'}))return;
    void operate(()=>financeAPI.renameDepartment(name,renamed),`Department renamed to ${renamed}.`);
  }
  async function deleteDepartment(name:string){
    if(!await confirmAction({title:'Delete unused department',message:`Remove department ${name}? This works only when it has no staff, assigned Head, history or allocated budget.`,tone:'danger',confirmText:'Delete department'}))return;
    void operate(()=>financeAPI.removeDepartment(name),`Removed unused department ${name}.`);
  }
  async function moveEmployee(event:FormEvent){
    event.preventDefault();
    const person=people.find(p=>p.id===transferUser);
    if(!person||!transferDepartment)return;
    if(!await confirmAction({title:'Confirm employee transfer',message:`Move ${person.name} from ${person.department} to ${transferDepartment}? Historical PRs stay in their original department.`,tone:'warning',confirmText:'Transfer employee'}))return;
    void operate(async()=>{
      await financeAPI.moveEmployee(transferUser,transferDepartment);
      setTransferUser('');setTransferDepartment('');
    },`${person.name} is now assigned to ${transferDepartment}.`);
  }
  async function appointProcurementOfficer(event:FormEvent){
    event.preventDefault();
    const person=eligibleOfficers.find(p=>p.id===officerUserId);
    if(!person){setError('Choose an approved, active Employee from Procurement.');return;}
    if(!await confirmAction({
      title:'Appoint Procurement Officer',
      message:`Appoint ${person.name} as Procurement Officer? This is an operational procurement role with access to sourcing, delivery and other staff actions. They may be selected as a substitute for the Procurement Head when a delegation is approved.`,
      tone:'warning',confirmText:'Appoint officer'
    }))return;
    void operate(async()=>{await financeAPI.setProcurementOfficer(person.id,'appoint');setOfficerUserId('');},
      `${person.name} was appointed Procurement Officer. Their new role will appear when they refresh or sign in again.`);
  }
  async function removeProcurementOfficer(person:Person){
    if(!await confirmAction({
      title:'Remove Procurement Officer',
      message:`Return ${person.name} to Employee? Their Procurement Officer permissions and eligibility as a Procurement Head delegate will end. Active delegated approvals may require a new substitute.`,
      tone:'warning',confirmText:'Remove officer role'
    }))return;
    void operate(()=>financeAPI.setProcurementOfficer(person.id,'remove'),`${person.name} is now a regular Procurement Employee.`);
  }

  async function appointOperationsOfficer(event:FormEvent){
    event.preventDefault();
    if(!eligibleOperationsOfficers.some(p=>p.id===operationsOfficerUserId))return;
    void operate(async()=>{await financeAPI.setOperationsOfficer(operationsOfficerUserId,'appoint');setOperationsOfficerUserId('');},
      'Operations Officer appointed. Their role is now eligible for Operations Head delegation.');
  }
  async function removeOperationsOfficer(person:Person){
    if(!await confirmAction({title:'Remove Operations Officer',message:`Return ${person.name} to Employee? Any acting Head permissions will end.`,tone:'warning',confirmText:'Remove officer'}))return;
    void operate(()=>financeAPI.setOperationsOfficer(person.id,'remove'),`${person.name} returned to Employee.`);
  }

  async function correctProcurementHead(person:Person){
    if(!await confirmAction({title:'Correct Procurement department',message:`Correct ${person.name}'s saved department to Procurement? Historical PRs remain unchanged.`,tone:'warning',confirmText:'Correct department'}))return;
    void operate(()=>financeAPI.correctProcurementDepartment(person.id),`${person.name}'s home department is now Procurement.`);
  }

  return <section className="mx-auto max-w-6xl space-y-5">
    {error&&<div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
    {message&&<div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>}
    {hasConflict&&<div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Finance Head and Finance Officer currently point to the same account. Choose two different Finance employees.</div>}
    {currentFinanceInvalid&&<div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">The current Finance Officer is no longer an eligible Finance &amp; Accounting employee. Reassign them.</div>}
    {mismatchedProcurementHeads.length>0&&<div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3">
      <h3 className="font-bold text-amber-900">Procurement Head department corrections</h3>
      {mismatchedProcurementHeads.map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{p.name} has department <strong>{p.department}</strong>.</span><button type="button" disabled={busy} onClick={()=>correctProcurementHead(p)} className="rounded-md bg-[#a64f32] px-3 py-2 text-white disabled:opacity-50">Correct to Procurement</button></div>)}
    </div>}

    <form onSubmit={assign} className="rounded-xl border bg-white p-5 space-y-4">
      <h3 className="font-bold">Assign one Head per department</h3>
      <p className="text-sm text-slate-500">Select any eligible department except Executive, which does not use this Department Head appointment workflow. An appointment replaces the previous Head automatically. Procurement Head receives the existing Procurement Head account role; other Heads are recorded as assignments. Finance Head and Finance Officer must be different Finance &amp; Accounting employees.</p>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm font-semibold">Responsibility
          <select className="mt-1 block w-full rounded-lg border p-2.5 font-normal" value={duty} onChange={e=>{setDuty(e.target.value as Duty);setDepartment('');setUserId('')}}>
            <option value="Department Head">Department Head</option>
            <option value="Operations Head">Operations Head</option>
            <option value="Human Resources Head">Human Resources Head</option>
            <option value="Finance Officer">Finance Officer</option>
            <option value="Finance Head">Finance Head</option>
          </select>
        </label>
        <label className="text-sm font-semibold">Department
          <select className="mt-1 block w-full rounded-lg border p-2.5 font-normal disabled:bg-slate-100" value={duty==='Department Head'?department:duty==='Operations Head'?'Operations':duty==='Human Resources Head'?'Human Resources':'Finance & Accounting'} onChange={e=>{setDepartment(e.target.value);setUserId('')}} disabled={duty!=='Department Head'} required={duty==='Department Head'}>
            {duty==='Department Head'?<><option value="">Choose a department</option>{headDepartments.map(name=><option key={name} value={name}>{name}</option>)}</>:duty==='Operations Head'?<option value="Operations">Operations</option>:duty==='Human Resources Head'?<option value="Human Resources">Human Resources</option>:<option value="Finance & Accounting">Finance &amp; Accounting</option>}
          </select>
          {duty==='Finance Officer'&&<span className="mt-1 block text-xs font-normal text-slate-500">Home department: Finance &amp; Accounting. Approval scope: all departments.</span>}
        </label>
        <label className="text-sm font-semibold">Select employee
          <select className="mt-1 block w-full rounded-lg border p-2.5 font-normal" value={userId} onChange={e=>setUserId(e.target.value)} required>
            <option value="">Choose eligible employee</option>
            {eligible.map(p=><option key={p.id} value={p.id}>{p.name} (@{p.username}) · {p.department}</option>)}
          </select>
        </label>
      </div>
      {eligible.length===0&&<p className="text-sm text-amber-800">{duty==='Department Head'&&!department?'Choose a department first.':'No eligible employee is currently registered under this department. You can transfer an employee below. Heads and Finance Officers must be active and approved.'}</p>}
      {current&&<p className="text-sm text-slate-600">Currently assigned: <strong>{current.name}</strong>. Select a different employee to replace them.</p>}
      <button type="submit" disabled={busy||!userId||(duty==='Department Head'&&(!department||!headAssignableDepartment(department)))} className="rounded-lg bg-[#a64f32] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy?'Saving…':duty==='Finance Officer'?'Save Finance Officer':duty==='Finance Head'?'Save Finance Head':duty==='Human Resources Head'?'Save Human Resources Head':duty==='Operations Head'?'Save Operations Head':'Save Department Head'}</button>
    </form>

    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4" aria-label="Procurement Officer appointments">
      <div>
        <h3 className="font-bold text-slate-900">Procurement Officers</h3>
        <p className="mt-1 text-sm text-slate-500">Appoint approved employees from the Procurement department as Procurement Officers. This is a staff account role, not a Department Head assignment. Officers can be chosen as a Procurement Head substitute when an authorized delegation is active.</p>
      </div>
      <form onSubmit={appointProcurementOfficer} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-sm font-semibold">Eligible Procurement employee
          <select className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5 font-normal" value={officerUserId} onChange={e=>setOfficerUserId(e.target.value)} required>
            <option value="">Choose an approved Procurement employee</option>
            {eligibleOfficers.map(p=><option key={p.id} value={p.id}>{p.name} (@{p.username})</option>)}
          </select>
        </label>
        <button type="submit" disabled={busy||!eligibleOfficers.some(p=>p.id===officerUserId)} className="rounded-lg bg-[#a64f32] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy?'Saving…':'Appoint Procurement Officer'}</button>
      </form>
      {eligibleOfficers.length===0&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">No eligible Procurement Employee is available. In User Verification, approve an Employee account first. If their department is different, use <strong>Transfer an employee to another department</strong> below to move them to Procurement; then return here to appoint them.</p>}
      <div className="border-t border-slate-100 pt-4">
        <h4 className="mb-3 text-sm font-bold text-slate-700">Currently appointed officers ({procurementOfficers.length})</h4>
        {procurementOfficers.length===0?<p className="text-sm text-slate-500">No Procurement Officers have been appointed yet.</p>:
          <div className="grid gap-2 md:grid-cols-2">{procurementOfficers.map(person=><div key={person.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
            <div className="min-w-0"><div className="font-semibold text-slate-900">{person.name}</div><div className="break-all text-xs text-slate-500">@{person.username} · {person.department}</div></div>
            <button type="button" disabled={busy} onClick={()=>void removeProcurementOfficer(person)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Remove officer role</button>
          </div>)}</div>}
      </div>
    </section>

    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <h3 className="font-bold text-slate-900">Operations Officers</h3>
      <p className="text-sm text-slate-500">Appoint an approved Operations Employee as Operations Officer. Operations Head delegation uses this position; it does not confer Admin or Finance permissions.</p>
      <form onSubmit={appointOperationsOfficer} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm font-semibold">Eligible Operations employee
          <select className="mt-1 w-full rounded-lg border p-2.5 font-normal" value={operationsOfficerUserId} onChange={e=>setOperationsOfficerUserId(e.target.value)}>
            <option value="">Choose employee</option>
            {eligibleOperationsOfficers.map(p=><option value={p.id} key={p.id}>{p.name} · {p.department}</option>)}
          </select>
        </label>
        <button disabled={busy||!operationsOfficerUserId} type="submit" className="rounded-lg bg-[#a64f32] px-4 py-2.5 text-white disabled:opacity-50">Appoint Operations Officer</button>
      </form>
      {operationsOfficers.map(person=><div key={person.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{person.name} · Operations Officer</span><button disabled={busy} type="button" className="rounded-lg border border-rose-200 px-3 py-2 text-rose-700" onClick={()=>void removeOperationsOfficer(person)}>Remove officer</button></div>)}
      {!eligibleOperationsOfficers.length&&!operationsOfficers.length&&<p className="text-xs text-amber-700">No eligible approved Operations Employee. Transfer an Employee to Operations first.</p>}
    </section>

    <section className="rounded-xl border bg-white p-5 space-y-4">
      <div><h3 className="font-bold">Manage departments</h3><p className="text-sm text-slate-500 mt-1">Add departments, rename departments not used in procurement history, or remove an unused department. Procurement, Finance &amp; Accounting, and Executive are reserved department names for system workflows.</p></div>
      <form onSubmit={createDepartment} className="flex flex-wrap gap-2">
        <input aria-label="New department name" className="min-w-56 flex-1 rounded-lg border p-2.5 text-sm" value={newDepartment} onChange={e=>setNewDepartment(e.target.value)} maxLength={80} placeholder="New department name, e.g. Marketing" required />
        <button type="submit" disabled={busy||!newDepartment.trim()} className="rounded-lg bg-[#a64f32] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Add department</button>
      </form>
      <div className="grid gap-2 md:grid-cols-2">
        {departments.map(name=><div key={name} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
          <span className="font-semibold">{name}</span>
          <span className="flex shrink-0 gap-2">
            <button type="button" disabled={busy||reserved.has(name.toLowerCase())} onClick={()=>renameDepartment(name)} className="rounded border px-2.5 py-1.5 text-slate-700 disabled:opacity-40" title={reserved.has(name.toLowerCase())?'Required system department':'Rename'}>Edit</button>
            <button type="button" disabled={busy||reserved.has(name.toLowerCase())} onClick={()=>deleteDepartment(name)} className="rounded border border-rose-200 px-2.5 py-1.5 text-rose-700 disabled:opacity-40" title="Remove only if unused">Remove</button>
          </span>
        </div>)}
      </div>
    </section>

    <form onSubmit={moveEmployee} className="rounded-xl border bg-white p-5 space-y-4">
      <div><h3 className="font-bold">Transfer an employee to another department</h3><p className="mt-1 text-sm text-slate-500">For newly created departments, transfer an active regular employee before appointing their Head. Assigned Heads, Finance reviewers and employees with pending approval requests must be reassigned or completed first.</p></div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-semibold">Employee
          <select className="mt-1 block w-full rounded-lg border p-2.5 font-normal" value={transferUser} onChange={e=>setTransferUser(e.target.value)} required>
            <option value="">Choose employee</option>
            {people.map(p=>{const assigned=assignments.some(a=>a.user_id===p.id),ordinary=p.app_role==='Employee';return <option key={p.id} value={p.id} disabled={!ordinary||assigned}>{p.name} · {p.department}{!ordinary?` (${p.app_role} — role reassignment required)`:assigned?' (remove current appointment first)':''}</option>})}
          </select>
          {!people.some(p=>p.app_role==='Employee')&&<span className="mt-1 block text-xs text-amber-700">No approved regular Employees. Approved Heads and Officers are listed but disabled; return them to Employee before transfer.</span>}
        </label>
        <label className="text-sm font-semibold">New department
          <select className="mt-1 block w-full rounded-lg border p-2.5 font-normal" value={transferDepartment} onChange={e=>setTransferDepartment(e.target.value)} required><option value="">Choose department</option>{departments.map(dep=><option value={dep} key={dep}>{dep}</option>)}</select>
        </label>
      </div>
      <button type="submit" disabled={busy||!transferUser||!transferDepartment} className="rounded-lg bg-[#a64f32] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Save employee department</button>
    </form>

    <section className="rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">Current assignments</h3><button type="button" disabled={busy} onClick={()=>{void reload()}} className="rounded-lg border px-3 py-2 text-sm">Refresh</button></div>
      {!settings?<p className="mt-4 text-sm text-slate-500">Loading assignments…</p>:assignments.length===0?<p className="mt-4 text-sm text-slate-500">No assignments yet.</p>:
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-slate-50 text-slate-700"><th className="p-3">Responsibility</th><th className="p-3">Department</th><th className="p-3">Assigned employee</th><th className="p-3">Action</th></tr></thead><tbody>
          {assignments.map(a=><tr key={`${a.step_role}/${a.department}`} className="border-b last:border-0"><td className="p-3 font-semibold">{displayDuty(a.step_role,a.department)}</td><td className="p-3">{a.step_role==='Finance Officer'&&a.department==='*'?<><span>Finance &amp; Accounting</span><span className="block text-xs text-slate-500">Review scope: all departments</span></>:a.department}</td><td className="p-3">{a.name}</td><td className="p-3"><button type="button" disabled={busy} className="rounded border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-50" onClick={()=>remove(a.step_role as SavedDuty,a.department,a.user_id,a.name)}>Remove</button></td></tr>)}
        </tbody></table></div>}
    </section>
  </section>;
}
