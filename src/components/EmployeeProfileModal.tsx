import { useEffect, useState } from 'react';
import { accountAPI, type AccountPerson } from '../services/account';

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('') || 'PF';
}

/** Read-only public profile. Sensitive personnel data is deliberately omitted by the API. */
export function EmployeeProfileModal({ person, onClose, onMessage }: {
  person: AccountPerson | null;
  onClose: () => void;
  onMessage: (person: AccountPerson) => void;
}) {
  const [details, setDetails] = useState<AccountPerson | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!person) return;
    let active = true;
    setDetails(null);
    setError('');
    setLoading(true);
    void accountAPI.person(person.id).then(full => {
      if (active) setDetails(full);
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to open this profile.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [person?.id]);

  useEffect(() => {
    if (!person) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [person, onClose]);

  if (!person) return null;
  const info = details ?? person;
  const staff = info.memberType !== 'Supplier' && info.role !== 'Supplier';

  return <div role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
    className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-5">
    <section role="dialog" aria-modal="true" aria-label={`Profile of ${person.name}`}
      className="w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl max-h-[90dvh]">
      <div className="flex items-start justify-between border-b border-slate-100 bg-[#f7f3ef] px-5 py-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#26342d] text-xl font-bold text-white">
            {info.avatar ? <img src={info.avatar} alt="" className="h-full w-full object-cover" /> : initials(info.name)}
          </div>
          <div className="min-w-0">
            <h2 className="break-words text-xl font-bold leading-tight text-slate-900">{info.name}</h2>
            <p className="mt-1 break-all text-sm text-[#a64f32]">@{info.username}</p>
            <span className="mt-2 inline-block rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">
              {staff ? 'Employee information' : 'Supplier profile'}
            </span>
          </div>
        </div>
        <button type="button" aria-label="Close profile" onClick={onClose}
          className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
          <i className="fa-solid fa-xmark" />
        </button>
      </div>
      <div className="space-y-5 px-5 py-5 sm:px-6">
        {loading && <p className="text-sm text-slate-500">Loading public profile details…</p>}
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {!loading && details && <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{staff ? 'Department' : 'Company'}</div>
              <p className="mt-2 break-words text-sm font-semibold text-slate-900">{staff ? info.department || 'Not assigned' : info.companyName || 'Not specified'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{staff ? 'Official position' : 'Account type'}</div>
              <p className="mt-2 break-words text-sm font-semibold text-slate-900">{info.displayPosition || info.positions?.join(', ') || info.role}</p>
            </div>
          </div>
          {staff && info.positions && info.positions.length > 1 && <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Assigned positions</h3>
            <div className="mt-2 flex flex-wrap gap-2">{info.positions.map(position => <span key={position} className="rounded-full border border-[#e9d0c4] bg-[#fbf3ef] px-3 py-1 text-xs font-semibold text-[#a64f32]">{position}</span>)}</div>
          </div>}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">About</h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{info.bio?.trim() || 'No public introduction added.'}</p>
          </div>
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
            Positions are taken from the account’s formal assignments. Private email addresses, leave requests, and access-control settings are not shown.
          </p>
        </>}
      </div>
      <footer className="flex flex-wrap justify-end gap-3 border-t border-slate-100 px-5 py-4 sm:px-6">
        <button type="button" onClick={onClose} className="min-h-10 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Close</button>
        {!loading && details && <button type="button" onClick={() => onMessage(details)} className="min-h-10 rounded-xl bg-[#a64f32] px-5 py-2 text-sm font-semibold text-white hover:bg-[#873e27]">
          <i className="fa-solid fa-comment-dots mr-2" />Message
        </button>}
      </footer>
    </section>
  </div>;
}
