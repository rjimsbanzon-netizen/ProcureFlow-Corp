import { useEffect, useMemo, useState } from 'react';
import { accountAPI, type AccountPerson } from '../services/account';
import { CLOUD_API_BASE } from '../services/cloud';
import { navigateTo } from '../core/renderBridge';
import { ui } from '../store/state';
import { EmployeeProfileModal } from '../components/EmployeeProfileModal';

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(x => x[0]?.toUpperCase() ?? '').join('') || 'PF';
}

export default function PeopleDirectoryPage() {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'all'|'staff'|'supplier'>('staff');
  const [people, setPeople] = useState<AccountPerson[]>([]);
  const [selected, setSelected] = useState<AccountPerson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!CLOUD_API_BASE) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void accountAPI.directory(query).then(rows => {
        if (!active) return;
        setPeople(rows);
        setError('');
      }).catch(e => {
        if (active) setError(e instanceof Error ? e.message : 'Unable to search accounts.');
      }).finally(() => { if (active) setLoading(false); });
    }, query ? 250 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);

  const visible = useMemo(() => people.filter(person => {
    const supplier = person.memberType === 'Supplier' || person.role === 'Supplier';
    return kind === 'all' || (kind === 'supplier' ? supplier : !supplier);
  }), [people, kind]);
  function message(person: AccountPerson) {
    ui.directMessagePeerId = person.id;
    setSelected(null);
    navigateTo('people_messages');
  }

  if (!CLOUD_API_BASE) return <section className="rounded-2xl border bg-white p-6 text-sm text-slate-600">The employee directory requires signing in to the connected ProcureFlow service.</section>;
  return <section className="mx-auto max-w-[1400px] space-y-5 pb-8">
    <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex items-start gap-4">
        <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f7ede7] text-[#a64f32] sm:flex"><i className="fa-solid fa-address-book text-xl" /></div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">People Directory</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">Find approved coworkers and supplier accounts, view their shared work profile, or send them a private message.</p>
        </div>
      </div>
    </header>

    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <label htmlFor="pf-employee-directory-search" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Search accounts</label>
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-4 top-4 text-sm text-slate-400" />
            <input id="pf-employee-directory-search" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Name, username, department, position, company…"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-800 outline-none focus:border-[#a64f32]" />
          </div>
        </div>
        <div>
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Account type</span>
          <div className="flex flex-wrap gap-2">
            {([['staff','Employees'],['all','All'],['supplier','Suppliers']] as const).map(([value,label]) =>
              <button key={value} type="button" onClick={() => setKind(value)} aria-pressed={kind===value}
                className={'min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition '+(kind===value?'border-[#a64f32] bg-[#f7ede7] text-[#a64f32]':'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>{label}</button>
            )}
          </div>
        </div>
      </div>
    </div>

    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
    {loading ? <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Searching the approved account directory…</div> :
      visible.length ? <>
        <p className="text-xs font-medium text-slate-500">Showing {visible.length} matching public profiles (up to 60 accounts).</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map(person => <article key={person.id} className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#26342d] text-sm font-bold text-white">{initials(person.name)}</span>
              <div className="min-w-0">
                <h3 className="truncate font-bold text-slate-900">{person.name}</h3>
                <p className="truncate text-sm text-[#a64f32]">@{person.username}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex gap-3"><span className="w-24 shrink-0 text-slate-500">Position</span><span className="min-w-0 break-words font-semibold text-slate-800">{person.displayPosition || person.role}</span></div>
              <div className="flex gap-3"><span className="w-24 shrink-0 text-slate-500">{person.memberType==='Supplier'?'Company':'Department'}</span><span className="min-w-0 break-words text-slate-700">{person.memberType==='Supplier' ? person.companyName || 'Not specified' : person.department || 'Not assigned'}</span></div>
            </div>
            {person.bio && <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">{person.bio}</p>}
            <div className="mt-auto flex flex-wrap gap-2 pt-5">
              <button type="button" onClick={() => setSelected(person)} className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50">View profile</button>
              <button type="button" onClick={() => message(person)} className="flex-1 rounded-xl bg-[#a64f32] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#873e27]">Message</button>
            </div>
          </article>)}
        </div>
      </> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No matching public profiles. Try another name, department, or position. Accounts hidden from search will not appear.</div>}

    <p className="text-xs leading-5 text-slate-500">Only approved accounts that allow directory discovery appear here. Work positions are derived from formal staff appointments; personal email addresses and private personnel records are not included.</p>
    <EmployeeProfileModal person={selected} onClose={() => setSelected(null)} onMessage={message} />
  </section>;
}
