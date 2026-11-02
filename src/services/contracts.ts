import {CLOUD_API_BASE,cloudRequest} from './cloud';
export type ContractStatus='Draft'|'Active'|'Upcoming'|'Expired'|'Terminated';
export interface Contract {
 id:string; reference:string; title:string; supplier_id:string; supplier_name:string;po_id:string|null;bid_id:string|null;lifecycle_status:'Draft'|'Published';
 starts_on:string;ends_on:string;price:number;negotiated_price_cents:number;pricing_terms:string;
 renewal_notice_days:number;notes:string;terminated_at:string|null;termination_reason:string|null;
 created_at:string;updated_at:string;status:ContractStatus;daysUntilExpiry:number;
}
export type ContractAlert={id:string;reference:string;title:string;supplierName:string;endsOn:string;daysUntilExpiry:number;status:ContractStatus;updatedAt:string};
export type Renewal={id:string;contract_id:string;previous_ends_on:string;new_ends_on:string;previous_price_cents:number;new_price_cents:number;reason:string;renewed_at:string};
function connected(){if(!CLOUD_API_BASE)throw new Error('Contract management requires Cloudflare D1.');}
async function send<T>(path:string,method='GET',data?:unknown):Promise<T>{connected();return cloudRequest(path,{method,...(data!==undefined?{body:JSON.stringify(data)}:{})}) as Promise<T>}
export const contractsAPI={
 list:()=>send<{contracts:Contract[]}>('/contracts'),
 alerts:()=>send<{alerts:ContractAlert[]}>('/contracts/alerts'),
 create:(body:unknown)=>send('/contracts','POST',body),
 update:(id:string,body:unknown)=>send(`/contracts/${encodeURIComponent(id)}`,'PUT',body),
 renew:(id:string,body:unknown)=>send(`/contracts/${encodeURIComponent(id)}/renew`,'POST',body),
 activate:(id:string)=>send(`/contracts/${encodeURIComponent(id)}/activate`,'POST',{}),
 renewals:(id:string)=>send<{renewals:Renewal[]}>(`/contracts/${encodeURIComponent(id)}/renewals`),
 terminate:(id:string,reason:string)=>send(`/contracts/${encodeURIComponent(id)}/terminate`,'POST',{reason})
};
