import { EmptyState, LoadingState } from '../components/FeedbackState';
import { useEffect, useState, type FormEvent } from 'react';
import { confirmAction } from '../services/actionDialogs';
import { DB } from '../store/state';
import { cloudRequest } from '../services/cloud';
import { showToast } from '../services/toast';
import { deleteAccreditation, downloadAccreditation, listAccreditation, reviewAccreditation, uploadAccreditation, type AccreditationCase, type AccreditationDocument } from '../services/sourcing';

const categories=['Business Registration','Tax Certificate','Business Permit','Other'];
const today=new Date().toISOString().slice(0,10);
export default function SupplierAccreditationPage() {
  const isSupplier=DB.currentUser?.role==='Supplier';
  const reviewer=['Admin','Procurement Head'].includes(DB.currentUser?.role||'');
  const [cases,setCases]=useState<AccreditationCase[]>([]);
  const [category,setCategory]=useState(categories[0]);
  const [validUntil,setValidUntil]=useState('');
  const [file,setFile]=useState<File|null>(null);
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [reviewErrors,setReviewErrors]=useState<Record<string,string>>({});
  const [reviewSuccess,setReviewSuccess]=useState<Record<string,string>>({});
  async function reload(){try{const result=await listAccreditation();setCases(result.cases);setError('');}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
  useEffect(()=>{void reload();const timer=window.setInterval(()=>void reload(),60000);return ()=>window.clearInterval(timer);},[]);
  async function execute(task:()=>Promise<unknown>){setBusy(true);setError('');try{await task();await reload();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function submitReview(row:AccreditationCase, decision:'Approved'|'Rejected') {
    const id=row.supplierUserId;
    const note=(notes[id]||'').trim();
    setBusy(true);
    setReviewErrors(previous=>({...previous,[id]:''}));
    setReviewSuccess(previous=>({...previous,[id]:''}));
    try {
      // The visible account label is local state; the server authorizes the D1 session.
      // Check the authenticated session so permission failures are actionable.
      const response=await cloudRequest('/auth/me') as {
        user?: {role?:string;app_role?:string;username?:string};
      };
      const account=response.user;
      const permitted=account?.role==='admin' ||
        (account?.role==='employee' && account?.app_role==='Procurement Head');
      if(!permitted) {
        throw new Error('Your Cloudflare login session is not an Admin or Procurement Head session. Sign out, sign in to the authorized account, then retry. The accreditation was not changed.');
      }
      await reviewAccreditation(id,decision,note);
      await reload();
      setReviewSuccess(previous=>({...previous,[id]:`Accreditation ${decision.toLowerCase()} and saved in Cloudflare.`}));
      showToast(`Accreditation ${decision.toLowerCase()} successfully.`,'success');
    } catch(e) {
      const raw=e instanceof Error?e.message:'Accreditation review failed.';
      const message=raw.includes('Only Admin or Procurement Head may review accreditation')
        ? `${raw} The Worker does not recognize this session as an authorized reviewer. Sign out and back in as Admin or Procurement Head. If it persists, inspect /auth/me and the review request in the Network tab.`
        : raw.includes('Origin not allowed')
        ? `${raw} Check that ALLOWED_ORIGIN in your Worker includes the exact GitHub Pages origin.`
        : raw;
      setReviewErrors(previous=>({...previous,[id]:message}));
      showToast(message,'error');
    } finally {
      setBusy(false);
    }
  }
  function upload(e:FormEvent){e.preventDefault();if (!file)return;void execute(async()=>{await uploadAccreditation(category,validUntil,file);setFile(null);const elem=document.querySelector<HTMLInputElement>('#accreditation-file');if(elem)elem.value='';});}
  function documentList(row:AccreditationCase) {
    return <div className="mt-3 space-y-2">{row.documents.map((doc:AccreditationDocument)=><div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="min-w-0"><p className="break-words text-sm font-medium">{doc.category}: {doc.fileName}</p><p className={'text-xs '+(doc.validUntil<today?'text-rose-700':'text-slate-500')}>Valid until {doc.validUntil} · {(doc.size/1024).toFixed(0)} KB {doc.validUntil<today?'· Expired':''}</p></div>
      <div className="flex gap-2"><button onClick={()=>void execute(()=>downloadAccreditation(doc))} className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold">Download</button>
      {isSupplier && <button disabled={busy} onClick={async()=>{if(await confirmAction({title:'Delete accreditation document',message:`Delete ${doc.fileName}? The accreditation will require re-review.`,tone:'danger',confirmText:'Delete document'}))void execute(()=>deleteAccreditation(doc.id));}} className="rounded border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700">Delete</button>}</div>
    </div>)}</div>;
  }
  return <div className="space-y-5">
    <header className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-xl font-bold">Supplier Accreditation</h2>
      <p className="mt-1 text-sm text-slate-500">Suppliers upload registration, tax and permit documents; procurement management reviews compliance and expiration dates. Approval is required before submitting new bids.</p>
    </header>
    {error && <div role="alert" className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    {isSupplier && <form onSubmit={upload} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
      <h3 className="sm:col-span-2 font-bold">Upload accreditation evidence</h3>
      <label className="text-xs font-semibold">Document type<select value={category} onChange={e=>setCategory(e.target.value)} className="mt-1 block w-full rounded border border-slate-300 p-3 text-sm">{categories.map(c=><option key={c}>{c}</option>)}</select></label>
      <label className="text-xs font-semibold">Expiration date<input type="date" value={validUntil} min={today} required onChange={e=>setValidUntil(e.target.value)} className="mt-1 block w-full rounded border border-slate-300 p-3 text-sm" /></label>
      <label className="text-xs font-semibold sm:col-span-2">PDF / PNG / JPG / DOCX, max 5 MB<input id="accreditation-file" type="file" required accept=".pdf,.png,.jpg,.jpeg,.docx" onChange={e=>setFile(e.target.files?.[0]||null)} className="mt-1 block w-full rounded border border-slate-300 p-3 text-sm" /></label>
      <div className="sm:col-span-2"><button disabled={busy||!file||!validUntil} className="rounded bg-[#a64f32] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy?'Uploading…':'Upload document for review'}</button></div>
    </form>}
    <section className="space-y-4">{loading?<LoadingState title="Loading accreditation records" description="Checking submitted supplier documents and review statuses…" />:cases.length?cases.map(row=><article key={row.supplierUserId} className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-bold text-slate-900">{row.name}</h3><p className="text-xs text-slate-500">{row.documents.length} document(s) · {row.reviewedAt?'Last review '+new Date(row.reviewedAt).toLocaleString():'Not yet reviewed'}</p></div>
      <span className={'rounded-full px-3 py-1 text-xs font-bold '+(row.status==='Approved'?'bg-emerald-100 text-emerald-800':row.status==='Expired'||row.status==='Rejected'?'bg-rose-100 text-rose-800':'bg-amber-100 text-amber-800')}>{row.status}</span></div>
      {row.missing.length>0 && <p className="mt-2 text-xs text-amber-800">Missing or expired required files: {row.missing.join(', ')}</p>}
      {row.reviewNote && <p className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-600"><b>Review note:</b> {row.reviewNote}</p>}
      {documentList(row)}
      {reviewer && <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row">
        <input aria-label={`Review note for ${row.name}`} maxLength={1000} placeholder="Review note / rejection reason" value={notes[row.supplierUserId]||''} onChange={e=>setNotes(old=>({...old,[row.supplierUserId]:e.target.value}))} className="min-w-0 flex-1 rounded border border-slate-300 p-2 text-sm" />
        <button disabled={busy||row.missing.length>0} onClick={()=>void submitReview(row,'Approved')} className="rounded bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Approve accreditation</button>
        <button disabled={busy||!(notes[row.supplierUserId]||'').trim()} onClick={()=>void submitReview(row,'Rejected')} className="rounded bg-rose-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Reject / Request changes</button>
      </div>}
      {reviewErrors[row.supplierUserId] && <div role="alert" aria-live="assertive" className="mt-3 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
        <b>Review was not saved.</b> {reviewErrors[row.supplierUserId]}
      </div>}
      {reviewSuccess[row.supplierUserId] && <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{reviewSuccess[row.supplierUserId]}</p>}
    </article>):<EmptyState icon="fa-id-card" title="No accreditation records yet" description="Supplier submissions will appear here once required registration and permit documents are uploaded." />}</section>
  </div>;
}
