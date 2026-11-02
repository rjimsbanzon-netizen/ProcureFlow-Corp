import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { DB, ui } from '../store/state';
import { markMessageNotificationsRead } from '../features/notifications/notificationService';
import { getMessages, postMessage, type Message } from '../services/sourcing';

const types = { BID: 'Bids & quotations', MEETING: 'Proposal meetings', PO: 'Purchase orders', DELIVERY: 'Deliveries', ISSUE: 'Issues & amendments' } as const;
type ContextType = keyof typeof types;

function bubbleTone(own: boolean) {
  return own
    ? 'ml-auto border-[#d6b09f] bg-[#f8eee9] text-slate-900'
    : 'mr-auto border-slate-200 bg-white text-slate-900';
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('') || 'PF';
}

function formatWhen(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function contextBadge(type: ContextType) {
  switch (type) {
    case 'BID': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'MEETING': return 'bg-sky-100 text-sky-800 border-sky-200';
    case 'PO': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'DELIVERY': return 'bg-violet-100 text-violet-800 border-violet-200';
    case 'ISSUE': return 'bg-rose-100 text-rose-800 border-rose-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function MessageBubble({ msg, own }: { msg: Message; own: boolean }) {
  return (
    <div className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
      <article className={`flex max-w-[92%] items-start gap-3 rounded-2xl border px-3 py-3 shadow-sm sm:max-w-[78%] ${bubbleTone(own)}`}>
        {!own && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
            {initials(msg.senderName)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className={`mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 ${own ? 'justify-end text-right' : 'justify-between'}`}>
            <div className={`min-w-0 ${own ? 'order-2 w-full sm:order-1 sm:w-auto' : ''}`}>
              <div className="truncate text-sm font-bold text-slate-900">{msg.senderName}</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{msg.senderRole}</div>
            </div>
            <time className="text-[11px] text-slate-500">{formatWhen(msg.createdAt)}</time>
          </div>
          <p className={`whitespace-pre-wrap break-words text-sm leading-6 text-slate-800 ${own ? 'text-right' : ''}`}>{msg.body}</p>
        </div>
        {own && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#a64f32] text-xs font-bold text-white">
            {initials(msg.senderName)}
          </div>
        )}
      </article>
    </div>
  );
}

export default function SupplierMessagesPage() {
  const supplier = DB.currentUser?.role === 'Supplier';
  const options = useMemo(() => {
    const own = (s: any) => s.supplierId === DB.currentUser?.supplierId || (s.supplierName && String(s.supplierName).toLowerCase() === String(DB.currentUser?.companyName || '').toLowerCase());
    const rows: { type: ContextType; id: string; label: string }[] = [];
    const add = (records: any[], type: ContextType, title: (r: any) => string) => records.filter(r => !supplier || own(r)).forEach(r => rows.push({ type, id: r.id, label: `${r.id} — ${title(r)}` }));
    add(DB.bids, 'BID', r => r.supplierName);
    add(DB.proposalMeetings, 'MEETING', r => r.supplierName);
    add(DB.orders, 'PO', r => r.supplierName || r.itemTitle);
    add(DB.deliveries, 'DELIVERY', r => r.supplierName || r.itemTitle);
    add(DB.amendments, 'ISSUE', r => r.supplierName || 'Delivery issue');
    return rows;
  }, [supplier]);
  const [selection, setSelection] = useState(() => ui.messageSelection || '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const selected = options.find(x => `${x.type}|${x.id}` === selection);
  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }
    let active = true;
    const load = async () => {
      try {
        const r = await getMessages(selected.type, selected.id);
        if (active) {
          setMessages(r.messages);
          setError('');
          markMessageNotificationsRead(r.messages.filter(m => m.senderUserId !== DB.currentUser?.id).map(m => m.id));
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    };
    setLoading(true);
    void load();
    const timer = window.setInterval(() => { void load(); }, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selection]);
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!selected || !draft.trim() || busy) return;
    setBusy(true);
    try {
      await postMessage(selected.type, selected.id, draft);
      setDraft('');
      setMessages((await getMessages(selected.type, selected.id)).messages);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-600">Select transaction</label>
            <select
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm lg:min-w-[28rem]"
              value={selection}
              onChange={e => { ui.messageSelection = e.target.value; setSelection(e.target.value); }}
            >
              <option value="">Choose a bid, meeting, order or issue</option>
              {Object.entries(types).map(([key, title]) => (
                <optgroup key={key} label={title}>
                  {options.filter(x => x.type === key).map(x => <option value={`${x.type}|${x.id}`} key={`${x.type}|${x.id}`}>{x.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          {selected && (
            <div className="rounded-2xl border border-[#e8d2c8] bg-[#fbf5f1] px-4 py-3 text-sm shadow-sm lg:max-w-md">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${contextBadge(selected.type)}`}>
                  {types[selected.type]}
                </span>
                <span className="text-xs text-slate-500">Conversation reference</span>
              </div>
              <div className="break-all font-semibold text-slate-900">{selected.id}</div>
            </div>
          )}
        </div>

        {!options.length && <p className="mt-3 text-sm text-slate-500">No eligible transactions yet. Discussions become available after a supplier has submitted a bid or received an order.</p>}
        {error && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

        {selected && (
          <>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 shadow-inner">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Conversation thread</h3>
                  <p className="text-xs text-slate-500">Clarifications, supplier responses, and procurement follow-ups refresh automatically.</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                  {messages.length} {messages.length === 1 ? 'message' : 'messages'}
                </span>
              </div>
              <div className="min-h-[22rem] max-h-[52vh] space-y-3 overflow-y-auto p-4 sm:p-5">
                {loading && !messages.length && <p className="text-xs text-slate-500">Loading discussion…</p>}
                {!loading && !messages.length && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">No messages yet. Start the discussion below.</p>}
                {messages.map(msg => <MessageBubble key={msg.id} msg={msg} own={msg.senderUserId === DB.currentUser?.id} />)}
              </div>
            </div>

            <form onSubmit={e => void send(e)} className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor="supplier-message-draft" className="text-sm font-bold text-slate-900">Compose message</label>
                <span className="text-xs text-slate-500">{draft.length}/2000</span>
              </div>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <textarea
                  id="supplier-message-draft"
                  aria-label="New message"
                  required
                  minLength={1}
                  maxLength={2000}
                  rows={4}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder="Type a question, clarification, or delivery update…"
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm leading-6 shadow-sm outline-none transition focus:border-[#a64f32] focus:ring-2 focus:ring-[#a64f32]/15"
                />
                <button disabled={busy || !draft.trim()} className="inline-flex min-h-[52px] items-center justify-center rounded-xl bg-[#a64f32] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#8f442b] disabled:cursor-not-allowed disabled:opacity-60 lg:min-w-[180px]">
                  {busy ? 'Sending…' : 'Send message'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
