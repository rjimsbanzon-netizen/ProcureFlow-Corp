import { CLOUD_API_BASE, CLOUD_TOKEN_KEY, cloudRequest } from './cloud';
export type ApprovalStep = {number:number;role:'Department Head'|'Procurement Head'|'Finance Officer'|'Admin';status:'Pending'|'Approved'|'Rejected';comment:string;decidedAt:string|null;decidedBy:string|null};
export type ApprovalRequest = {prId:string;requestedBy:string;department:string;amount:number;status:'Pending'|'Approved'|'Rejected';currentStep:number;totalSteps:number;createdAt:string;pr:Record<string,any>|null;financeHead:{status:'Pending'|'Approved'|'Rejected';decidedAt:string|null;decidedBy:string|null;comment:string}|null;steps:ApprovalStep[]};
export type BudgetRow = {department:string;allocated:number;committed:number;spent:number;remaining:number;configured:boolean};
export type FinanceSettings = {financeFrom:number;financeHeadFrom:number;adminFrom:number;assignments:{step_role:string;department:string;user_id:string;name:string;app_role:string;user_department?:string}[];invoiceVerification?:{allowed:boolean;acting:boolean;validUntil:string|null;reason?:string}};
export type InvoiceRow = {id:string;poId:string;supplierName:string;invoiceNo:string;amount:number;invoiceDate:string;documentId:string|null;status:'Submitted'|'Matched';submittedAt:string;matchedAt:string|null;reasons:string[]};
export function requireFinanceCloud():void {
  if (!CLOUD_API_BASE) throw new Error('Finance workflows require your connected Cloudflare Worker and D1 database.');
}
async function request<T>(path:string, method='GET', body?:unknown):Promise<T> {
  requireFinanceCloud();
  return cloudRequest(path,{method,...(body!==undefined?{body:JSON.stringify(body)}:{})}) as Promise<T>;
}
export const financeAPI={
  approvals:()=>request<{requests:ApprovalRequest[]}>('/finance/approvals'),
  start:(prId:string)=>request('/finance/approvals','POST',{prId}),
  decide:(prId:string,decision:'approve'|'reject',comment:string)=>request(`/finance/approvals/${encodeURIComponent(prId)}/decision`,'POST',{decision,comment}),
  decideFinanceHead:(prId:string,decision:'approve'|'reject',comment:string)=>request(`/finance/approvals/${encodeURIComponent(prId)}/finance-head`,'POST',{decision,comment}),
  budgets:()=>request<{budgets:BudgetRow[]}>('/finance/summary'),
  saveBudget:(department:string,allocated:number)=>request('/finance/budgets','PUT',{department,allocated}),
  settings:()=>request<FinanceSettings>('/finance/settings'),
  saveSettings:(financeFrom:number,financeHeadFrom:number,adminFrom:number)=>request('/finance/settings','PUT',{financeFrom,financeHeadFrom,adminFrom}),
  staff:()=>request<{people:{id:string;name:string;username:string;app_role:string;department:string}[]}>('/finance/staff'),
  departments:()=>request<{departments:string[]}>('/finance/departments'),
  addDepartment:(name:string)=>request<{ok:boolean;department:string}>('/finance/departments','POST',{name}),
  renameDepartment:(oldName:string,newName:string)=>request<{ok:boolean}>('/finance/departments','PUT',{oldName,newName}),
  removeDepartment:(name:string)=>request<{ok:boolean}>('/finance/departments','DELETE',{name}),
  moveEmployee:(userId:string,department:string)=>request<{ok:boolean}>('/finance/staff/department','PUT',{userId,department}),
  correctProcurementDepartment:(userId:string)=>request<{ok:boolean;userId:string;department:string}>('/finance/staff/procurement-department','PUT',{userId}),
  setOperationsOfficer:(userId:string,action:'appoint'|'remove')=>request<{ok:boolean;userId:string;appRole:string}>('/finance/staff/operations-officer','PUT',{userId,action}),
  setProcurementOfficer:(userId:string,action:'appoint'|'remove')=>request<{ok:boolean;userId:string;appRole:string}>('/finance/staff/procurement-officer','PUT',{userId,action}),
  assign:(role:'Department Head'|'Finance Officer',department:string,userId:string)=>request('/finance/assignments','PUT',{role,department,userId}),
  unassign:(role:'Department Head'|'Finance Officer',department:string,userId:string)=>request('/finance/assignments','DELETE',{role,department,userId}),
  invoices:()=>request<{invoices:InvoiceRow[]}>('/finance/invoices'),
  submitInvoice:(poId:string,invoiceNo:string,amount:number,invoiceDate:string,documentId:string)=>request('/finance/invoices','POST',{poId,invoiceNo,amount,invoiceDate,documentId}),
  matchInvoice:(id:string)=>request(`/finance/invoices/${encodeURIComponent(id)}/match`,'POST'),
  async downloadInvoiceAttachment(id:string, invoiceNumber:string):Promise<void> {
    requireFinanceCloud();
    const token=localStorage.getItem(CLOUD_TOKEN_KEY);
    if(!token)throw new Error('Your login session has expired. Please sign in again.');
    const response=await fetch(`${CLOUD_API_BASE}/finance/invoices/${encodeURIComponent(id)}/attachment`,{
      headers:{Authorization:`Bearer ${token}`},cache:'no-store'
    });
    if(!response.ok){
      const info=await response.json().catch(()=>({})) as {error?:string};
      throw new Error(info.error||`Invoice download failed (${response.status}).`);
    }
    const blob=await response.blob();
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;
    anchor.download=`${invoiceNumber.replace(/[^a-zA-Z0-9._-]/g,'_') || 'invoice'}.${blob.type==='application/pdf'?'pdf':blob.type==='image/png'?'png':blob.type==='image/jpeg'?'jpg':blob.type==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'?'docx':'bin'}`;
    document.body.appendChild(anchor);
    anchor.click();anchor.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),60_000);
  },
  paymentAuthority:(poId:string)=>request<{allowed:boolean;requiredRole:'Finance Officer'|'Finance Head';threshold:number;reason:string}>(`/finance/payment-authority/${encodeURIComponent(poId)}`),
  matchStatus:(poId:string)=>request<{matched:boolean;reasons:string[];invoiceId:string|null}>(`/finance/match-status/${encodeURIComponent(poId)}`),
};
