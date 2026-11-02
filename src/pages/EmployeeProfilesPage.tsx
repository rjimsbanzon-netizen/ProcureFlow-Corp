import { useEffect, useMemo, useState } from 'react';
import { accountAPI, type AccountPerson } from '../services/account';
import { CLOUD_API_BASE } from '../services/cloud';
import { navigateTo } from '../core/renderBridge';
import { ui } from '../store/state';
import { EmployeeProfileModal } from '../components/EmployeeProfileModal';

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || 'PF';
}

function EmployeeAvatar({ person, size = 'large' }: { person: AccountPerson; size?: 'large' | 'small' }) {
  return <span className={'flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#26342d] font-bold text-white ' + (size === 'large' ? 'h-16 w-16 text-lg' : 'h-12 w-12 text-sm')}>
    {person.avatar ? <img className="h-full w-full object-cover" src={person.avatar} alt="" /> : initials(person.name)}
  </span>;
}

/** The server filters approval, revocation, visibility AND member type. */
export default function EmployeeProfilesPage() {
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('all');
  const [people, setPeople] = useState<AccountPerson[]>([]);
  const [selected, setSelected] = useState<AccountPerson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!CLOUD_API_BASE) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void accountAPI.directory(query.trim(), 'employees')
        .then(rows => { if (active) { setPeople(rows); setError(''); } })
        .catch(reason => {
          if (active) { setPeople([]); setError(reason instanceof Error ? reason.message : 'Unable to load employee profiles.'); }
        })
        .finally(() => { if (active) setLoading(false); });
    }, query ? 280 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, retry]);

  const departments = useMemo(() => [...new Set(people.map(person => person.department?.trim()).filter((name): name is string => Boolean(name)))].sort((a,b) => a.localeCompare(b)), [people]);
  const visible = useMemo(() => people.filter(person => department === 'all' || person.department === department), [people, department]);

  function openChat(person: AccountPerson) {
    ui.directMessagePeerId = person.id;
    setSelected(null);
    navigateTo('people_messages');
  }

  if (!CLOUD_API_BASE) return <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Employee Profiles requires a signed-in connection to the ProcureFlow service.</section>;

  return <section className="mx-auto max-w-[1400px] space-y-5 pb-8">
    <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-6 sm:px-7">
        <div className="flex min-w-0 items-start gap-4">
          <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f7ede7] text-[#a64f32] sm:flex"><i aria-hidden="true" className="fa-solid fa-address-card text-xl" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Employee Profiles</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Find colleagues across departments, see the information they chose to share, and start a private conversation.</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#f7ede7] px-3 py-1.5 text-xs font-bold text-[#a64f32]"><i aria-hidden="true" className="fa-solid fa-shield-halved" /> Public profiles only</span>
      </div>
    </header>

    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(180px,260px)]">
        <div>
          <label htmlFor="pf-employee-profiles-search" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Find an employee</label>
          <div className="relative">
            <i aria-hidden="true" className="fa-solid fa-magnifying-glass absolute left-4 top-4 text-sm text-slate-400" />
            <input id="pf-employee-profiles-search" autoComplete="off" value={query} onChange={event => { setQuery(event.target.value); setDepartment('all'); }} placeholder="Search name, username, department, or position…"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3.5 pl-11 pr-11 text-sm text-slate-900 outline-none transition focus:border-[#a64f32] focus:ring-2 focus:ring-[#a64f32]/10" />
            {query && <button type="button" aria-label="Clear employee search" onClick={() => { setQuery(''); setDepartment('all'); }} className="absolute right-3 top-2.5 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200"><i aria-hidden="true" className="fa-solid fa-xmark" /></button>}
          </div>
        </div>
        <div>
          <label htmlFor="pf-employee-profiles-department" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Department</label>
          <select id="pf-employee-profiles-department" value={department} onChange={event => setDepartment(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3.5 text-sm text-slate-900 outline-none focus:border-[#a64f32]">
            <option value="all">All departments</option>
            {departments.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
      </div>
    </div>

    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error} <button type="button" className="ml-2 font-bold underline" onClick={() => setRetry(value => value + 1)}>Retry search</button></div>}

    {loading ? <div role="status" className="rounded-2xl border border-slate-200 bg-white p-7 text-sm text-slate-500"><i aria-hidden="true" className="fa-solid fa-circle-notch fa-spin mr-2" /> Searching employee profiles…</div> : <>
      {!error && <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-xs font-semibold text-slate-500">{visible.length} {visible.length === 1 ? 'employee' : 'employees'} found{people.length >= 60 ? ' (showing up to 60; search to narrow results)' : ''}</p>
        <p className="text-xs text-slate-500">Employees control their visibility in My Account</p>
      </div>}
      {visible.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map(person => <article key={person.id} className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex min-w-0 items-center gap-4">
            <EmployeeAvatar person={person} size="large" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-bold text-slate-900" title={person.name}>{person.name}</h2>
              <p className="truncate text-sm font-medium text-[#a64f32]">@{person.username}</p>
              {person.memberType === 'Admin' && <span className="mt-1 inline-block rounded-full bg-[#eaf0e9] px-2 py-0.5 text-[11px] font-semibold text-[#26342d]">Admin</span>}
            </div>
          </div>
          <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-sm">
            <div className="flex gap-3"><i aria-hidden="true" className="fa-solid fa-briefcase mt-1 w-4 text-center text-slate-400" /><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Position</p><p className="mt-0.5 break-words font-semibold text-slate-800">{person.displayPosition || (person.memberType === 'Admin' ? 'Admin' : 'Employee')}</p></div></div>
            <div className="flex gap-3"><i aria-hidden="true" className="fa-solid fa-building mt-1 w-4 text-center text-slate-400" /><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Department</p><p className="mt-0.5 break-words text-slate-700">{person.department || 'Not assigned'}</p></div></div>
          </div>
          <p className="mt-3 min-h-10 line-clamp-2 text-sm leading-5 text-slate-500">{person.bio?.trim() || 'No public introduction added.'}</p>
          <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
            <button type="button" onClick={() => setSelected(person)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><i aria-hidden="true" className="fa-solid fa-user mr-2" />View profile</button>
            <button type="button" onClick={() => openChat(person)} className="min-h-11 rounded-xl bg-[#a64f32] px-3 py-2.5 text-sm font-bold text-white transition hover:bg-[#873e27]"><i aria-hidden="true" className="fa-solid fa-comment-dots mr-2" />Message</button>
          </div>
        </article>)}
      </div> : !error && <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
        <i aria-hidden="true" className="fa-regular fa-address-card mb-3 text-3xl text-slate-300" />
        <h2 className="font-bold text-slate-800">No public employee profiles found</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">Try a different name, department, or position. Private, unapproved, and revoked accounts are not shown.</p>
      </div>}
    </>}

    <p className="text-xs leading-5 text-slate-500">Profile information is visible only when the employee enables “Show my account in People Search.” Email addresses, passwords, internal permissions, and private personnel records are never listed here. You can message a colleague through ProcureFlow without viewing their private information.</p>
    <EmployeeProfileModal person={selected} onClose={() => setSelected(null)} onMessage={openChat} />
  </section>;
}
