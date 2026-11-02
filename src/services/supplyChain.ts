import {CLOUD_API_BASE,cloudRequest} from './cloud';
export type InventoryItem={id:string;supplier_id:string;supplier_name:string;sku:string;item_name:string;specifications:string;unit:string;on_hand:number;reserved:number;unit_price_cents:number;lead_time_days:number;updated_at:string};
export type SupplyPlan={id:string;item_name:string;sku:string;unit:string;category:string;priority:'A'|'B'|'C';primary_supplier_id:string;backup_supplier_id:string|null;primary_supplier_name:string;backup_supplier_name:string;primary_contract_id:string;backup_contract_id:string|null;primary_contract_reference:string;quantity_per_cycle:number;frequency:string;next_release_date:string;safety_stock:number;status:'Active'|'Paused'};
export type Shortage={id:string;plan_id:string;item_name:string;sku:string;unit:string;priority:string;required_qty:number;primary_confirmed_qty:number;shortage_qty:number;backup_available_at_report:number;backup_available_now:number;status:'Open'|'Recommended'|'Reviewed'|'Closed';category:string;backup_confirmed_qty:number|null;confirmation_reference:string|null;notes:string;created_at:string;review_notes:string;primary_supplier_name:string;backup_supplier_name:string};
export type NamedSupplier={id:string;name:string;status?:string};
function request<T>(path:string,method='GET',data?:unknown):Promise<T>{
 if(!CLOUD_API_BASE)throw new Error('This feature requires the deployed Cloudflare Worker and D1 migration 0021.');
 return cloudRequest(path,{method,...(data!==undefined?{body:JSON.stringify(data)}:{})}) as Promise<T>;
}
export const supplyChainAPI={
 inventory:()=>request<{inventory:InventoryItem[]}>('/supply-chain/inventory'),
 saveInventory:(body:unknown)=>request<{ok:boolean}>('/supply-chain/inventory','POST',body),
 plans:()=>request<{plans:SupplyPlan[];suppliers:NamedSupplier[]}>('/supply-chain/plans'),
 createPlan:(body:unknown)=>request<{ok:boolean}>('/supply-chain/plans','POST',body),
 changeStatus:(id:string,status:'Active'|'Paused')=>request(`/supply-chain/plans/${encodeURIComponent(id)}/status`,'PUT',{status}),
 shortages:()=>request<{shortages:Shortage[]}>('/supply-chain/shortages'),
 reportShortage:(body:unknown)=>request<{ok:boolean;shortageQty:number;backupAvailable:number}>('/supply-chain/shortages','POST',body),
 reviewShortage:(id:string,status:'Recommended'|'Closed',notes:string,backupConfirmedQty?:number,confirmationReference?:string)=>request(`/supply-chain/shortages/${encodeURIComponent(id)}/review`,'POST',{status,notes,...(backupConfirmedQty!==undefined?{backupConfirmedQty}:{}),...(confirmationReference?{confirmationReference}:{})})
};
