import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {accountAPI,type AccountPerson,type Conversation,type DirectMessage} from '../services/account';
import {CLOUD_API_BASE} from '../services/cloud';
import {DB,ui} from '../store/state';
import {EmployeeProfileModal} from '../components/EmployeeProfileModal';
import {clearReadDirectMessageAlerts} from '../features/notifications/cloudNotificationSync';
function initials(name:string){return name.trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')||'PF';}
const when=(value:string)=>{const date=new Date(value);return Number.isNaN(date.getTime())?value:date.toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});};
export default function DirectMessagesPage(){
  const [query,setQuery]=useState('');
  const [people,setPeople]=useState<AccountPerson[]>([]);
  const [threads,setThreads]=useState<Conversation[]>([]);
  const [selected,setSelected]=useState<AccountPerson|null>(null);
  const [profileFocus,setProfileFocus]=useState<AccountPerson|null>(null);
  const [messages,setMessages]=useState<DirectMessage[]>([]);
  const [draft,setDraft]=useState('');
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[searching,setSearching]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{if(!CLOUD_API_BASE){setLoading(false);return;} let alive=true;
    const refresh=()=>accountAPI.conversations().then(data=>{if(alive){setThreads(data);setLoading(false);}}).catch(e=>{if(alive){setError(e instanceof Error?e.message:'Could not load messages.');setLoading(false);}});
    void refresh();const timer=window.setInterval(()=>{void refresh();},15000);
    return()=>{alive=false;window.clearInterval(timer);};
  },[]);
  useEffect(()=>{
    const peerId=ui.directMessagePeerId;
    if(!peerId || !CLOUD_API_BASE)return;
    ui.directMessagePeerId=null;
    let active=true;
    // A sender may hide their account from directory search yet still have an
    // existing conversation. Load the peer from the private inbox first.
    void accountAPI.conversations().then(async conversations =>
      conversations.find(person => person.id === peerId) ?? await accountAPI.person(peerId)
    ).then(person=>{if(active){setSelected(person);setDraft('');setError('');}})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to open this conversation.');});
    return()=>{active=false;};
  },[]);
  useEffect(()=>{if(!CLOUD_API_BASE)return;let active=true;setSearching(true);
    const timer=window.setTimeout(()=>{void accountAPI.directory(query).then(rows=>{if(active){setPeople(rows);setSearching(false);}}).catch(e=>{if(active){setError(e instanceof Error?e.message:'Search unavailable.');setSearching(false);}});},250);
    return()=>{active=false;window.clearTimeout(timer);};
  },[query]);
  useEffect(()=>{if(!selected)return;let alive=true;
    const refresh=async()=>{try{const result=await accountAPI.messages(selected.id);if(alive){setMessages(result.messages);await accountAPI.markRead(selected.id);
        // Dismiss just those alerts whose messages have actually been loaded.
        clearReadDirectMessageAlerts(result.messages.filter(msg=>msg.recipient_id===DB.currentUser?.id).map(msg=>msg.id));
      }}catch(e){if(alive)setError(e instanceof Error?e.message:'Could not load conversation.');}};
    void refresh();const timer=window.setInterval(()=>{void refresh();},15000);
    return()=>{alive=false;window.clearInterval(timer);};
  },[selected?.id]);
  async function send(e:FormEvent){e.preventDefault();if(!selected||!draft.trim()||busy)return;setBusy(true);setError('');
    try{await accountAPI.sendMessage(selected.id,draft);setDraft('');setMessages((await accountAPI.messages(selected.id)).messages);
      setThreads(await accountAPI.conversations());}catch(e){setError(e instanceof Error?e.message:'Message not sent.');}finally{setBusy(false);}}
  const list=useMemo(()=>query.trim()?people:threads, [query,people,threads]);
  if(!CLOUD_API_BASE)return <div className="rounded-2xl border bg-white p-6 text-slate-700">Direct messages require signing into the Cloudflare-connected system.</div>;
  return <section className="mx-auto max-w-[1480px] space-y-4 pb-6">
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-2xl font-bold text-slate-900">People & Messages</h2><p className="mt-1 text-sm text-slate-500">Find colleagues and approved suppliers, or continue a private one-to-one conversation.</p></div>
    {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <div className="grid min-h-[65vh] gap-4 lg:grid-cols-[minmax(270px,340px)_minmax(0,1fr)]">
      <aside className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4"><label htmlFor="pf-people-search" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Find an account</label><div className="relative"><i className="fa-solid fa-magnifying-glass absolute left-3 top-3.5 text-sm text-slate-400"/><input id="pf-people-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, @username, department" className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-10 pr-3 text-sm outline-none focus:border-[#a64f32]"/></div></div>
        <div className="max-h-[64vh] overflow-y-auto p-2">
          <div className="px-2 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">{query?'People':'Recent conversations'}</div>
          {(loading||searching)&&<div className="p-4 text-sm text-slate-500">Loading…</div>}
          {!loading&&!searching&&!list.length&&<div className="p-4 text-sm leading-6 text-slate-500">{query?'No matching accounts found.':'No messages yet. Search for someone to start a conversation.'}</div>}
          {list.map(person=>{const conv=person as Conversation;const active=selected?.id===person.id;
            return <button key={person.id} type="button" onClick={()=>{setSelected(person);setDraft('');setMessages([]);setError('');}}
              className={'mb-1 flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition '+(active?'bg-[#fbf0e9] ring-1 ring-[#e3bca8]':'hover:bg-slate-50')}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2d3b33] text-xs font-bold text-white">{person.avatar?<img src={person.avatar} alt="" className="h-full w-full rounded-full object-cover"/>:initials(person.name)}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-900">{person.name}</span><span className="block truncate text-xs text-[#a64f32]">@{person.username} · {person.displayPosition || person.role}</span><span className="mt-1 block truncate text-xs text-slate-500">{query?(person.department||person.companyName):(conv.lastBody||'Start a conversation')}</span></span>
              {!query&&Number(conv.unread)>0&&<span className="rounded-full bg-[#a64f32] px-2 py-0.5 text-[11px] font-bold text-white">{conv.unread}</span>}
            </button>;
          })}
        </div>
      </aside>
      <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {selected?<>
          <div className="flex items-center gap-3 border-b border-slate-200 p-4"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2d3b33] text-sm font-bold text-white">{selected.avatar?<img src={selected.avatar} alt="" className="h-full w-full rounded-full object-cover"/>:initials(selected.name)}</span>
            <div className="min-w-0"><h3 className="truncate font-bold text-slate-900">{selected.name}</h3><p className="truncate text-xs text-slate-500">@{selected.username} · {selected.department||selected.companyName||selected.role}</p></div>
            <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
              <button type="button" onClick={()=>setProfileFocus(selected)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#a64f32] hover:bg-[#fbf0e9]">View profile</button>
              <span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 sm:block">Private chat</span>
            </div>
          </div>
          <div className="min-h-[320px] flex-1 space-y-3 overflow-y-auto bg-[#f8f7f3] p-4 sm:p-6 lg:max-h-[58vh]">
            {!messages.length&&<div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">No messages yet. Send a message to {selected.name}.</div>}
            {messages.map(msg=>{const mine=msg.sender_id===DB.currentUser?.id;return <div key={msg.id} className={'flex '+(mine?'justify-end':'justify-start')}><div className={'max-w-[90%] rounded-2xl border px-4 py-3 shadow-sm sm:max-w-[72%] '+(mine?'border-[#dfbdaa] bg-[#f3e1d7]':'border-slate-200 bg-white')}>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-900">{msg.body}</p><p className="mt-1 text-right text-[11px] text-slate-500">{when(msg.created_at)}{mine&&msg.read_at?' · Seen':''}</p>
            </div></div>;})}
          </div>
          <form onSubmit={e=>void send(e)} className="flex flex-col gap-3 border-t border-slate-200 bg-white p-4 sm:flex-row sm:items-end">
            <textarea value={draft} onChange={e=>setDraft(e.target.value)} aria-label="Direct message" placeholder="Write a message…" required maxLength={2000} rows={2} className="min-w-0 flex-1 resize-y rounded-xl border border-slate-300 p-3 text-sm leading-6 outline-none focus:border-[#a64f32]"/>
            <button disabled={!draft.trim()||busy} className="rounded-xl bg-[#a64f32] px-6 py-3 font-bold text-white hover:bg-[#873e27] disabled:opacity-50">{busy?'Sending…':'Send'}</button>
          </form>
        </>:<div className="flex min-h-[420px] flex-1 flex-col items-center justify-center p-8 text-center"><div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f7ede7] text-2xl text-[#a64f32]"><i className="fa-solid fa-comments"/></div><h3 className="text-lg font-bold text-slate-900">Start a conversation</h3><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Select a conversation or search for an approved ProcureFlow account to message them privately.</p></div>}
      </div>
    </div>
    <EmployeeProfileModal person={profileFocus} onClose={()=>setProfileFocus(null)} onMessage={person=>{setSelected(person);setProfileFocus(null);}} />
  </section>;
}
