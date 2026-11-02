import { CLOUD_API_BASE, CLOUD_TOKEN_KEY, cloudRequest } from './cloud';

export type Deadline = { needId: string; closesAt: string; manuallyClosed: boolean; open: boolean };
export type Message = { id: string; entityType: string; entityId: string; senderUserId: string; senderName: string; senderRole: string; body: string; createdAt: string };
export type AccreditationDocument = { id: string; category: string; fileName: string; size: number; validUntil: string; uploadedAt: string };
export type AccreditationCase = { supplierUserId: string; name: string; status: string; reviewNote: string; reviewedAt: string | null; missing: string[]; documents: AccreditationDocument[] };

let deadlineCache = new Map<string, Deadline>();
let loaded = false;
export const getDeadline = (needId: string) => deadlineCache.get(needId) ?? null;
export const deadlinesLoaded = () => loaded;
export const deadlineIsOpen = (needId: string) => {
  const row = getDeadline(needId);
  return Boolean(row && !row.manuallyClosed && Date.parse(row.closesAt) > Date.now());
};
export function assertSourcingCloud() {
  if (!CLOUD_API_BASE) throw new Error('This feature requires the connected Cloudflare Worker.');
}

export async function loadDeadlines() {
  assertSourcingCloud();
  const result = await cloudRequest('/sourcing/deadlines') as {deadlines: Deadline[]};
  deadlineCache = new Map(result.deadlines.map(row => [row.needId, row]));
  loaded = true;
  return result.deadlines;
}
export async function updateDeadline(needId:string, closesAt:string, manuallyClosed:boolean) {
  assertSourcingCloud();
  const result = await cloudRequest(`/sourcing/deadlines/${encodeURIComponent(needId)}`, {
    method:'PUT',body:JSON.stringify({closesAt,manuallyClosed})
  });
  await loadDeadlines();
  return result;
}
export const submitSecureBid = (bid: Record<string, unknown>) => {
  assertSourcingCloud();
  return cloudRequest('/sourcing/bids',{method:'POST',body:JSON.stringify(bid)}) as Promise<{bid:Record<string,any>}>;
};
export const getMessages = (entityType:string,entityId:string) => {
  assertSourcingCloud();
  return cloudRequest(`/sourcing/messages?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`) as Promise<{messages:Message[]}>;
};
export const postMessage = (entityType:string,entityId:string,message:string) => {
  assertSourcingCloud();
  return cloudRequest('/sourcing/messages',{method:'POST',body:JSON.stringify({entityType,entityId,message})});
};
export const listAccreditation = () => {
  assertSourcingCloud();
  return cloudRequest('/sourcing/accreditation') as Promise<{cases:AccreditationCase[]}>;
};
export const reviewAccreditation = (supplierId:string,status:'Approved'|'Rejected',note:string) => {
  assertSourcingCloud();
  return cloudRequest(`/sourcing/accreditation/review/${encodeURIComponent(supplierId)}`,{
    method:'POST',body:JSON.stringify({status,note})
  });
};
async function attachmentRequest(path:string,init:RequestInit={}) {
  assertSourcingCloud();
  const token=localStorage.getItem(CLOUD_TOKEN_KEY);
  if (!token) throw new Error('Your login session has expired. Sign in again.');
  const response=await fetch(`${CLOUD_API_BASE}${path}`,{...init,headers:{Authorization:`Bearer ${token}`,...(init.headers||{})}});
  if (!response.ok) {
    const body=await response.json().catch(()=>({})) as {error?:string};
    throw new Error(body.error || `File operation failed (${response.status}).`);
  }
  return response;
}
export async function uploadAccreditation(category:string, validUntil:string, file:File) {
  const form=new FormData();form.set('category',category);form.set('validUntil',validUntil);form.set('file',file,file.name);
  return (await attachmentRequest('/sourcing/accreditation/files',{method:'POST',body:form})).json();
}
export async function downloadAccreditation(doc:AccreditationDocument) {
  const result=await attachmentRequest(`/sourcing/accreditation/files/${encodeURIComponent(doc.id)}`);
  const blob=await result.blob(),url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download=doc.fileName;document.body.appendChild(anchor);anchor.click();anchor.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export async function deleteAccreditation(docId:string) {
  return (await attachmentRequest(`/sourcing/accreditation/files/${encodeURIComponent(docId)}`,{method:'DELETE'})).json();
}
