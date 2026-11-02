import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { confirmAction } from '../services/actionDialogs';
import { companyMaterialConfigAPI, type ActiveCompanySetup } from '../services/companyMaterialConfig';
import { CLOUD_API_BASE, cloudRequest } from '../services/cloud';
import {DEMO_PRESETS,type DemoIndustry} from '../data/demoPresets';
import {DemoCompanyRecords} from '../components/DemoCompanyRecords';
import { DB } from '../store/state';
import {
  COMPANY_SETUP_TEMPLATES,
  allocateSetupBudget,
  companySetupProfile,
  type CompanySetupApprovalThresholds,
  type CompanySetupDepartment,
  type CompanySetupTemplate
} from '../domain/companySetup';
import {
  DEFAULT_COMPANY_MATERIAL_CONFIG,
  type CompanyMaterialConfig
} from '../domain/companyMaterialConfig';
import { fieldClass, mainButton, secondaryButton } from '../components/CoreScreenUI';

const formatPeso = (amount: number) => `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const defaultBudgetPHP = 100_000_000;

export default function OperationsMaterialConfigPage() {
  const isAdmin = DB.currentUser?.role === 'Admin';
  const isManager = isAdmin || DB.currentUser?.role === 'Operations Officer';
  const [config, setConfig] = useState<CompanyMaterialConfig>(DEFAULT_COMPANY_MATERIAL_CONFIG);
  const [activeSetup, setActiveSetup] = useState<ActiveCompanySetup | null>(null);
  const [selectedSetupId, setSelectedSetupId] = useState('');
  const [departments, setDepartments] = useState<CompanySetupDepartment[]>([]);
  const [approvals, setApprovals] = useState<CompanySetupApprovalThresholds>({
    financeFrom: 100_000,
    financeHeadFrom: 1_000_000,
    adminFrom: 5_000_000
  });
  const [annualBudgetPHP, setAnnualBudgetPHP] = useState(defaultBudgetPHP);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [demoEnabled,setDemoEnabled]=useState(false);
  const [demoActive,setDemoActive]=useState<string|null>(null);
  const [demoRevision,setDemoRevision]=useState(0);

  useEffect(() => {
    if(CLOUD_API_BASE)void cloudRequest('/demo/status').then((value)=>{const r=value as {enabled:boolean;active:string|null};setDemoEnabled(r.enabled);setDemoActive(r.active)}).catch(()=>{});
    let active = true;
    Promise.all([companyMaterialConfigAPI.get(), companyMaterialConfigAPI.activeSetup()])
      .then(([savedConfig, currentSetup]) => {
        if (!active) return;
        setConfig(savedConfig);
        setActiveSetup(currentSetup);
        if (currentSetup && COMPANY_SETUP_TEMPLATES.some(template => template.id === currentSetup.setupId)) {
          setSelectedSetupId(currentSetup.setupId);
          setAnnualBudgetPHP(currentSetup.annualBudget);
          if (currentSetup.setupConfig) {
            setDepartments(currentSetup.setupConfig.departments.map(item => ({ ...item })));
            setApprovals({ ...currentSetup.setupConfig.approvals });
          }
        }
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const selectedSetup = COMPANY_SETUP_TEMPLATES.find(template => template.id === selectedSetupId) ?? null;
  const budgetSplit = useMemo(() => {
    if (!selectedSetup) return [];
    try {
      return allocateSetupBudget(departments, annualBudgetPHP);
    } catch {
      return [];
    }
  }, [departments, annualBudgetPHP, selectedSetup]);
  const percentageTotal = departments.reduce((total, department) => total + Number(department.budgetPercent || 0), 0);

  function chooseSetup(template: CompanySetupTemplate) {
    setSelectedSetupId(template.id);
    setConfig(companySetupProfile(template));
    setDepartments(template.departments.map(item => ({ ...item })));
    setApprovals({ ...template.approvals });
    setAnnualBudgetPHP(activeSetup?.annualBudget ?? defaultBudgetPHP);
    setSaved('');
    setError('');
  }

  function editPriority(index: number, field: 'name' | 'description', value: string) {
    setConfig(current => ({
      ...current,
      activeSetupId: null,
      priorities: current.priorities.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item)
    }));
    setSaved('');
  }

  function editDepartmentBudget(index: number, value: string) {
    setDepartments(current => current.map((department, itemIndex) => {
      if (itemIndex !== index) return department;
      return { ...department, budgetPercent: Number(value) };
    }));
    setSaved('');
  }

  async function saveMaterialPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isManager || busy) return;
    setError('');
    setSaved('');
    setBusy(true);
    try {
      await companyMaterialConfigAPI.save(config);
      setActiveSetup(await companyMaterialConfigAPI.activeSetup());
      setSaved('Operations material policy saved. Department budgets and approval rules were not changed.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function applyCompanySetup() {
    if (!isAdmin || !selectedSetup || busy) return;
    const companyName = config.companyName.trim();
    if (companyName.length < 2) {
      setError('Enter a company name with at least two characters.');
      return;
    }
    if (!budgetSplit.length) {
      setError('Department budget percentages must total 100%, and the annual procurement budget must be positive.');
      return;
    }
    if (approvals.financeHeadFrom < approvals.financeFrom) {
      setError('The Finance Head threshold cannot be below the Finance Officer threshold.');
      return;
    }
    const budgetDetails = budgetSplit.map(row => `${row.department}: ${formatPeso(row.allocated)}`).join('\n');
    const confirmed = await confirmAction({
      title: `Apply ${selectedSetup.label} setup?`,
      message: `This will configure ${companyName}, Operations A/B/C priorities, department directory entries, the following budget allocations, and approval thresholds.\n\n${budgetDetails}\n\nExisting budgets for these same departments will be replaced by the displayed allocations. Other departments and budgets will remain. Existing users, staff assignments, requisitions, purchase orders, and history will not be changed. Department heads still need to be appointed separately.`,
      confirmText: 'Apply complete setup',
      tone: 'warning'
    });
    if (!confirmed) return;
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const result = await companyMaterialConfigAPI.applySetup({
        setupId: selectedSetup.id,
        industry: selectedSetup.id,
        companyName,
        priorities: config.priorities,
        departments,
        annualBudgetPHP,
        approvals
      });
      setConfig({ ...config, activeSetupId: selectedSetup.id });
      setActiveSetup(result.activeSetup);
      const extraBudgetCount = result.untouchedBudgets?.length ?? 0;
      setSaved(`Complete setup applied. ${departments.length} departments and budget allocations are configured; existing staff and transactions were preserved.${extraBudgetCount ? ` ${extraBudgetCount} unrelated department budget(s) were left unchanged.` : ''}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }


  async function activateSampleRecords(){
    if (!isAdmin||!selectedSetup||busy) return;
    if(!demoEnabled){setError('Company record loading is disabled on this Worker. A separate training database is required.');return;}
    const accepted=await confirmAction({
      title:`Load ${selectedSetup.companyName} company records?`,
      message:'TRAINING WORKSPACE ONLY: This replaces the current company records, accounts, stock catalog, supplier documents, department budgets, and supplier inventories. Existing company transactions and generated-account sessions will be replaced. Other user accounts and business workspaces are protected by the server. Placeholder legal documents are NOT valid registrations or permits. Initial staff and supplier password: password123. Keep this workspace separate from live company operations.',
      confirmText:'Replace company records',tone:'danger'
    });
    if(!accepted)return;
    setBusy(true);setSaved('');setError('');
    try{
      const result=await cloudRequest('/demo/activate',{method:'POST',body:JSON.stringify({scenarioId:selectedSetup.id,confirmation:`ACTIVATE ${selectedSetup.id.toUpperCase()}`})}) as {company:string;accounts:number;materials:number};
      setDemoActive(selectedSetup.id);
      setDemoRevision(v=>v+1);
      setSaved(`${result.company} is ready with ${result.accounts} employee/supplier accounts, ${result.materials} company materials, and supplier records. Reload to see the company data throughout ProcureFlow.`);
      window.location.reload();
    }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
  }

  const inputClass = `${fieldClass} mt-1`;

  return <section className="mx-auto max-w-6xl space-y-4 pb-8">
    <header className="rounded-xl border bg-white p-5">
      <h2 className="text-xl font-bold text-slate-900">Company & Material Setup</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">Choose a complete industry blueprint: company profile, departments, procurement-budget split, financial approval thresholds, material priorities, and the responsibility handoffs. Previewing a setup does not change the live workspace.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-slate-700">Live company setup:</span>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${activeSetup && activeSetup.setupId !== 'custom' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
          {activeSetup && activeSetup.setupId !== 'custom'
            ? `${COMPANY_SETUP_TEMPLATES.find(item => item.id === activeSetup.setupId)?.label ?? activeSetup.setupId} · ${formatPeso(activeSetup.annualBudget)} example annual pool`
            : activeSetup?.setupId === 'custom' ? 'Customized company profile' : 'No complete preset applied'}
        </span>
      </div>
    </header>

    {!CLOUD_API_BASE && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Local preview: you can review presets, but applying company departments, budgets, or approval settings requires the Cloudflare company workspace.</p>}
    {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {saved && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{saved}</p>}
    {loading ? <p className="rounded-xl border bg-white p-5 text-sm text-slate-600">Loading company configuration…</p> : <>
      <section className="rounded-xl border bg-white p-5">
        <div>
          <h3 className="font-bold text-slate-900">Choose from six premade companies</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">Each is a worked example, not a universal organization chart. Select one to review and edit its departments, budget percentages, thresholds, and Operations priorities before applying it.</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {COMPANY_SETUP_TEMPLATES.map(template => {
            const active = activeSetup?.setupId === template.id;
            const selected = selectedSetupId === template.id;
            return <article key={template.id} className={`rounded-lg border p-4 ${selected ? 'border-[#a64f32] ring-2 ring-[#a64f32]/15' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-semibold text-slate-900">{template.label}</h4>
                {active && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">LIVE</span>}
              </div>
              <p className="mt-1 text-xs text-slate-500">{template.companyName}</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">{template.summary}</p>
              <p className="mt-2 text-xs leading-5 text-slate-600"><strong>{template.departments.length} departments</strong> · editable percentage allocation · approval thresholds</p>
              <button type="button" className={selected ? `${mainButton} mt-3` : `${secondaryButton} mt-3`} onClick={() => chooseSetup(template)}>
                {selected ? 'Previewing setup' : 'Preview this setup'}
              </button>
            </article>;
          })}
        </div>
      </section>

      {selectedSetup && <form onSubmit={event => void saveMaterialPolicy(event)} className="space-y-4">
        <section className="space-y-4 rounded-xl border bg-white p-5">
          <div>
            <h3 className="font-bold text-slate-900">1. Company and operating model</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">{selectedSetup.workflow}</p>
          </div>
          <label className="block text-sm font-semibold text-slate-700">Company name
            <input className={inputClass} value={config.companyName} onChange={event => { setConfig(current => ({ ...current, companyName: event.target.value, activeSetupId: null })); setSaved(''); }} maxLength={100} minLength={2} required disabled={!isManager}/>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-lg border bg-slate-50 p-3 text-xs leading-5 text-slate-700"><strong>Requesting department</strong><br/>Defines the business need, quantity, required date, delivery location, and specifications; the department head submits the requisition.</article>
            <article className="rounded-lg border bg-slate-50 p-3 text-xs leading-5 text-slate-700"><strong>Operations</strong><br/>Validates operational need, production/service timing, stock readiness, and company-specific A/B/C criticality.</article>
            <article className="rounded-lg border bg-slate-50 p-3 text-xs leading-5 text-slate-700"><strong>Procurement</strong><br/>Checks the sourcing route, competition, supplier, commercial terms, purchase order, and supplier follow-up.</article>
            <article className="rounded-lg border bg-slate-50 p-3 text-xs leading-5 text-slate-700"><strong>Finance & Accounting</strong><br/>Controls budgets and financial approvals, matches invoices to approved orders and verified receipts, and processes payment.</article>
          </div>
          <div className="overflow-x-auto">
            <h4 className="mb-2 text-sm font-semibold text-slate-800">Example purchase categories and request owners</h4>
            <table className="w-full min-w-[620px] border-collapse text-left text-xs">
              <thead><tr className="border-b text-slate-500"><th className="px-2 py-2">Purchase category</th><th className="px-2 py-2">Typical requesting department</th><th className="px-2 py-2">Examples</th></tr></thead>
              <tbody>{selectedSetup.purchaseCategories.map(item => <tr key={item.category} className="border-b last:border-0">
                <td className="px-2 py-2 font-semibold text-slate-800">{item.category}</td>
                <td className="px-2 py-2 text-slate-700">{item.requestingDepartment}</td>
                <td className="px-2 py-2 text-slate-600">{item.examples}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <p className="text-xs leading-5 text-slate-500">Applying a company blueprint alone does not appoint staff. The separate, explicitly enabled TRAINING data action below creates fictional Head, Officer and supplier logins with actual D1 assignments. In a real workspace, appoint verified personnel through Staff Assignments.</p>
        </section>

        <section className="space-y-4 rounded-xl border bg-white p-5">
          <div>
            <h3 className="font-bold text-slate-900">2. Department plan and budget allocation</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">The example percentages allocate the full annual procurement budget pool across departments. They represent purchasing allocations, not payroll or total company operating expenses.</p>
          </div>
          <label className="block max-w-md text-sm font-semibold text-slate-700">Example annual procurement budget pool (PHP)
            <input className={inputClass} type="number" min="0.01" step="0.01" value={annualBudgetPHP} onChange={event => { setAnnualBudgetPHP(Number(event.target.value)); setSaved(''); }} required disabled={!isAdmin}/>
          </label>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left text-xs">
              <thead><tr className="border-b text-slate-500"><th className="px-2 py-2">Department</th><th className="px-2 py-2">Responsibility</th><th className="px-2 py-2 text-right">Pool %</th><th className="px-2 py-2 text-right">Example allocation</th></tr></thead>
              <tbody>{departments.map((department, index) => {
                const allocation = budgetSplit.find(row => row.department === department.name)?.allocated;
                return <tr key={`${department.name}-${index}`} className="border-b last:border-0">
                  <td className="px-2 py-2 font-semibold text-slate-800">{department.name}</td>
                  <td className="max-w-sm px-2 py-2 text-slate-600">{department.purpose}</td>
                  <td className="w-28 px-2 py-2"><label className="sr-only">{department.name} budget percentage</label><input className="w-24 rounded border border-slate-300 px-2 py-1 text-right" type="number" min="0" max="100" step="0.1" value={department.budgetPercent} onChange={event => editDepartmentBudget(index, event.target.value)} disabled={!isAdmin} /></td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-medium">{allocation === undefined ? '—' : formatPeso(allocation)}</td>
                </tr>;
              })}</tbody>
              <tfoot><tr className="font-bold"><td className="px-2 py-3" colSpan={2}>Total</td><td className={`px-2 py-3 text-right ${Math.abs(percentageTotal - 100) < 0.01 ? 'text-emerald-700' : 'text-rose-700'}`}>{percentageTotal.toFixed(1)}%</td><td className="px-2 py-3 text-right">{formatPeso(annualBudgetPHP || 0)}</td></tr></tfoot>
            </table>
          </div>
          <p className="text-xs leading-5 text-amber-800">The Budget module currently tracks allocated, committed, and spent amounts but does not yet enforce a fiscal-year period. These example annual values become the current department allocations when applied.</p>
        </section>

        <section className="space-y-4 rounded-xl border bg-white p-5">
          <div>
            <h3 className="font-bold text-slate-900">3. Operations material priorities</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">A/B/C here means operational urgency and production/service impact. It is not financial inventory ABC (which ranks stock by annual consumption value). Requesters classify; Operations defines the rules; Procurement checks the sourcing response. A/B/C never bypasses budget or approval controls.</p>
          </div>
          {config.priorities.map((item, index) => <fieldset key={item.code} className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-[5rem_minmax(0,1fr)]">
            <legend className="sr-only">Priority {item.code}</legend>
            <div className="flex items-center"><span className="rounded-lg bg-[#f8eee9] px-4 py-2 text-lg font-bold text-[#873e27]">Priority {item.code}</span></div>
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700">Material group<input className={inputClass} value={item.name} onChange={event => editPriority(index, 'name', event.target.value)} maxLength={80} minLength={2} required disabled={!isManager}/></label>
              <label className="block text-sm font-semibold text-slate-700">What belongs here and why<textarea className={inputClass} rows={2} value={item.description} onChange={event => editPriority(index, 'description', event.target.value)} maxLength={300} minLength={3} required disabled={!isManager}/></label>
            </div>
          </fieldset>)}
        </section>

        <section className="space-y-4 rounded-xl border bg-white p-5">
          <div>
            <h3 className="font-bold text-slate-900">4. Example financial approval thresholds</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Illustrative PHP policy values only. Tune them to company policy before applying. Finance Head approval must not start below Finance Officer approval.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {([
              ['financeFrom', 'Finance Officer review from'],
              ['financeHeadFrom', 'Finance Head review from'],
              ['adminFrom', 'Admin approval from']
            ] as const).map(([field, label]) => <label key={field} className="block text-sm font-semibold text-slate-700">{label} (PHP)
              <input className={inputClass} type="number" min="0" step="0.01" value={approvals[field]} onChange={event => { setApprovals(current => ({ ...current, [field]: Number(event.target.value) })); setSaved(''); }} required disabled={!isAdmin}/>
            </label>)}
          </div>
        </section>

        <div className="flex flex-wrap justify-end gap-3">
          {isManager && <button type="submit" className={secondaryButton} disabled={busy || loading}>{busy ? 'Saving…' : 'Save material policy only'}</button>}
          {isAdmin && <button type="button" className={mainButton} disabled={busy || loading || !CLOUD_API_BASE} onClick={() => void applyCompanySetup()}>{busy ? 'Applying…' : 'Apply complete company setup'}</button>}
        </div>
        {!isManager && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">You can review the company setup. Only an Admin or Operations Officer can edit the material policy; only an Admin can apply departments, budgets, and financial approval rules.</p>}
      </form>}
    </>}

    {selectedSetup&&selectedSetup.id in DEMO_PRESETS&&<section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-bold">Premade company records and account provisioning</h3>
        <p className="mt-1 text-sm text-slate-600">Review stock priorities, supplier inventory prices, and supplier business terms. On the separate training workspace, an Admin can load the company's complete records, supplier accreditation cases, and named department Head/Officer accounts.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {isAdmin&&<button type="button" className={mainButton} disabled={busy||!demoEnabled} onClick={()=>void activateSampleRecords()}>{busy?'Loading…':'Load company records + accounts'}</button>}
          <span className="text-xs text-slate-500">{demoActive===selectedSetup.id?'Active company records':!CLOUD_API_BASE?'Connect a training API to load records':demoEnabled?'Company setup enabled on training workspace':'Company setup disabled: preview only'}</span>
        </div>
      </div>
      <DemoCompanyRecords selectedId={selectedSetup.id as DemoIndustry} refreshKey={demoRevision}/>
    </section>}
  </section>;
}
