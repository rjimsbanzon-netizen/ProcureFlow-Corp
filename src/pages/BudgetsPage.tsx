import {useCallback,useEffect,useState} from 'react';
import { confirmAction, requestInput } from '../services/actionDialogs';
import {financeAPI} from '../services/finance';
import type {BudgetRow} from '../services/finance';
import {DB} from '../store/state';
import {navigateTo} from '../core/renderBridge';

const peso=(n:number)=>`₱${n.toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const reservedDepartments=new Set(['procurement','finance & accounting','finance and accounting','finance','executive']);
const isReserved=(department:string)=>reservedDepartments.has(department.trim().toLowerCase());

export default function BudgetsPage(){
  const [rows,setRows]=useState<BudgetRow[]>([]);
  const [departmentOptions,setDepartmentOptions]=useState<string[]>([]);
  const [department,setDepartment]=useState(''),[allocation,setAllocation]=useState('');
  const [financeFrom,setFinanceFrom]=useState('0'),[financeHeadFrom,setFinanceHeadFrom]=useState('1000000'),[adminFrom,setAdminFrom]=useState('0');
  const [error,setError]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(false);
  const admin=DB.currentUser?.role==='Admin';

  const refresh=useCallback(async()=>{
    try {
      const [budget,config,catalog]=await Promise.all([
        financeAPI.budgets(),
        financeAPI.settings(),
        admin?financeAPI.departments().catch(()=>({departments:[]})):Promise.resolve({departments:[]})
      ]);
      setRows(budget.budgets);
      setDepartmentOptions(catalog.departments);
      setFinanceFrom(String(config.financeFrom));
      setFinanceHeadFrom(String(config.financeHeadFrom));
      setAdminFrom(String(config.adminFrom));
      setError('');
    }catch(e){setError(e instanceof Error?e.message:String(e))}
  },[admin]);
  useEffect(()=>{void refresh()},[refresh]);

  // Choose registered departments plus any existing legacy budget departments.
  const departments=[...new Set([...departmentOptions,...rows.map(b=>b.department)].filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  function selectDepartment(name:string){
    setDepartment(name);
    const existing=rows.find(row=>row.department===name);
    setAllocation(existing?String(existing.allocated):'');
  }

  async function save(work:()=>Promise<unknown>,message:string){
    setBusy(true);setError('');setNote('');
    try{await work();await refresh();setNote(message)}
    catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }

  function editAllocation(row:BudgetRow){
    setDepartment(row.department);
    setAllocation(String(row.allocated));
    document.getElementById('budget-allocation-form')?.scrollIntoView({behavior:'smooth',block:'center'});
  }

  async function renameDepartment(oldName:string){
    if(busy||isReserved(oldName))return;
    const newName=await requestInput({title:'Rename Department',message:`Enter a new name for ${oldName}.`,label:'New department name',initialValue:oldName,required:true,confirmText:'Review rename'});
    if(!newName||newName===oldName)return;
    if(!await confirmAction({title:'Confirm department rename',message:`Rename "${oldName}" to "${newName}"? Staff, department budget and Head assignments will be updated. Departments with existing procurement history cannot be renamed.`,tone:'warning',confirmText:'Rename department'}))return;
    void save(async()=>{
      await financeAPI.renameDepartment(oldName,newName);
      setDepartment(previous=>previous===oldName?newName:previous);
    },`Department renamed from ${oldName} to ${newName}.`);
  }

  async function deleteDepartment(row:BudgetRow){
    if(busy||isReserved(row.department))return;
    const name=row.department;
    if(!await confirmAction({title:'Delete unused department',message:`Delete department "${name}"?\n\nThis is only possible if there are no associated staff members, assigned Department Head or procurement records, and its budget allocation is zero.\n\nThis cannot be undone.`,tone:'danger',confirmText:'Delete department'}))return;
    void save(async()=>{
      await financeAPI.removeDepartment(name);
      setDepartment(previous=>previous===name?'':previous);
      setAllocation(previous=>department===name?'':previous);
    },`Department ${name} deleted.`);
  }

  return <section className="max-w-6xl mx-auto space-y-5">
    <div className="rounded-xl bg-white border p-5 flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="font-bold text-xl">{admin?'Department Budget Management':'Department Budget Overview'}</h2><p className="text-sm text-slate-500 mt-1">{admin?'All departments · allocation management.':'Read-only financial overview for your authorized department.'} Committed: approved requisitions or unpaid orders. Spent: paid orders. Remaining: allocation minus both.</p></div>
      {admin&&<button type="button" onClick={()=>navigateTo('staff_assignments')} className="rounded-lg border px-4 py-2 text-sm font-semibold text-[#a64f32]">Manage staff assignments</button>}
    </div>
    {error&&<p role="alert" className="p-3 border border-rose-200 bg-rose-50 rounded-lg text-rose-700 text-sm">{error}</p>}
    {note&&<p role="status" className="p-3 border border-emerald-200 bg-emerald-50 rounded-lg text-emerald-700 text-sm">{note}</p>}

    {!admin&&rows.length===0&&!error&&<p className="bg-white border rounded-xl p-5 text-sm text-slate-600">No budget is available for your account. Ask Admin to confirm your Department Head assignment and department allocation.</p>}
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {rows.map(b=><article key={b.department} className="bg-white border rounded-xl p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-semibold text-slate-900">{b.department}</h3>
          {admin&&<div className="flex flex-wrap gap-1.5">
            <button type="button" disabled={busy} onClick={()=>editAllocation(b)} className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-[#a64f32] disabled:opacity-40">Edit allocation</button>
            <button type="button" disabled={busy||isReserved(b.department)} onClick={()=>renameDepartment(b.department)} title={isReserved(b.department)?'Required system department: name cannot be changed':'Edit department name'} className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-[#a64f32] disabled:opacity-40">Edit name</button>
            <button type="button" disabled={busy||isReserved(b.department)} onClick={()=>deleteDepartment(b)} title={isReserved(b.department)?'Required system department: cannot be deleted':'Delete unused department'} className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-40">Delete</button>
          </div>}
        </div>
        {!b.configured&&<p className="text-xs text-amber-700">No allocation configured</p>}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-slate-500 text-xs">Allocated</p><strong>{peso(b.allocated)}</strong></div>
          <div><p className="text-slate-500 text-xs">Committed</p><strong>{peso(b.committed)}</strong></div>
          <div><p className="text-slate-500 text-xs">Spent</p><strong>{peso(b.spent)}</strong></div>
          <div><p className="text-slate-500 text-xs">Remaining</p><strong className={b.remaining<0?'text-rose-700':'text-emerald-700'}>{peso(b.remaining)}</strong></div>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-[#a64f32]" style={{width:`${b.allocated?Math.min(100,(b.spent+b.committed)/b.allocated*100):0}%`}}/></div>
      </article>)}
    </div>

    {admin&&<div className="grid lg:grid-cols-2 gap-5">
      <form id="budget-allocation-form" onSubmit={e=>{e.preventDefault();if(!departments.includes(department))return;void save(()=>financeAPI.saveBudget(department,Number(allocation)),`Budget updated for ${department}.`)}} className="bg-white border rounded-xl p-5 space-y-3">
        <h3 className="font-bold">Set department allocation</h3>
        <label className="block text-sm">Department
          <select value={departments.includes(department)?department:''} onChange={e=>selectDepartment(e.target.value)} required className="mt-1 w-full border rounded-lg p-2 bg-white">
            <option value="" disabled>Select a department</option>
            {departments.map(d=><option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className="block text-sm">Allocated amount (PHP)<input type="number" min="0" step="0.01" required value={allocation} onChange={e=>setAllocation(e.target.value)} className="mt-1 w-full border rounded-lg p-2"/></label>
        <button disabled={busy||!departments.includes(department)||!allocation} className="bg-[#a64f32] text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50">Save allocation</button>
      </form>
      <form onSubmit={e=>{e.preventDefault();void save(()=>financeAPI.saveSettings(Number(financeFrom),Number(financeHeadFrom),Number(adminFrom)),'Approval thresholds saved.')}} className="bg-white border rounded-xl p-5 space-y-3">
        <h3 className="font-bold">Approval rules</h3>
        <p className="text-xs text-slate-500">Department Head submits; Procurement Head approves. Finance Officer reviews amounts above the Finance threshold. An independent Finance Head must then authorize high-value PRs before Admin. Enter 0 to always require the relevant approval; a Finance Head threshold must be at least the Finance Officer threshold.</p>
        <label className="block text-sm">Require Finance approval from (PHP)<input type="number" min="0" step="0.01" value={financeFrom} onChange={e=>setFinanceFrom(e.target.value)} className="mt-1 w-full border rounded-lg p-2" required/></label>
        <label className="block text-sm">Require Finance Head approval from (PHP)<input type="number" min="0" step="0.01" value={financeHeadFrom} onChange={e=>setFinanceHeadFrom(e.target.value)} className="mt-1 w-full border rounded-lg p-2" required/></label>
        <label className="block text-sm">Require Admin approval from (PHP)<input type="number" min="0" step="0.01" value={adminFrom} onChange={e=>setAdminFrom(e.target.value)} className="mt-1 w-full border rounded-lg p-2" required/></label>
        <button disabled={busy} className="bg-[#a64f32] text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50">Save rules</button>
      </form>
    </div>}
  </section>;
}
