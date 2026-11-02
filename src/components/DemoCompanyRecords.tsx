import {useEffect,useState} from 'react';
import {DEMO_PRESETS,type DemoIndustry} from '../data/demoPresets';
import {CLOUD_API_BASE,cloudRequest} from '../services/cloud';
import {DB} from '../store/state';
import {priorityClass} from '../domain/procurementClassification';

export type SupplierTerms={payment:string;minimumOrderPHP:number;leadTimeDays:number;warranty:string;delivery:string;returns:string;tax:string};
export type CatalogSupplier={supplierId:string;name:string;category:string;contact:string;terms:SupplierTerms;simulated:true};
export type DemoCatalog={active:string|null;materials:{id:string;sku:string;item_name:string;priority:'A'|'B'|'C';unit:string;on_hand:number;reorder_point:number;target_qty:number;unit_price_cents:number;specifications:string;supplier_id:string}[];suppliers:CatalogSupplier[];accounts:{username:string;name:string;department:string;requested_position:string;app_role:string}[]};
export const formatPHP=(value:number)=>`₱${value.toLocaleString('en-PH',{maximumFractionDigits:2,minimumFractionDigits:2})}`;

export function DemoSupplierTerms({suppliers,showHeading=true}:{suppliers:CatalogSupplier[];showHeading?:boolean}){
 if(!suppliers.length)return null;
 return <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
  {showHeading&&<div><h3 className="font-bold text-slate-900">Supplier business terms</h3><p className="mt-1 text-xs text-slate-600">Supplier quotations and policies. Verify applicable terms in signed agreements before issuing any purchase order.</p></div>}
  <div className="grid gap-3 md:grid-cols-2">{suppliers.map(s=><article key={s.supplierId} className="rounded-lg border border-slate-200 p-4 text-sm">
   <div className="flex flex-wrap justify-between gap-2"><strong className="text-slate-900">{s.name}</strong></div>
   <p className="mb-3 text-xs text-slate-500">{s.category} · {s.contact}</p>
   <dl className="space-y-2 text-xs text-slate-700"><div><dt className="font-semibold">Payment terms</dt><dd>{s.terms.payment}</dd></div>
    <div><dt className="font-semibold">Minimum order</dt><dd>{formatPHP(s.terms.minimumOrderPHP)}</dd></div>
    <div><dt className="font-semibold">Lead time & delivery</dt><dd>{s.terms.leadTimeDays} days · {s.terms.delivery}</dd></div>
    <div><dt className="font-semibold">Warranty / return</dt><dd>{s.terms.warranty}. {s.terms.returns}</dd></div>
    <div><dt className="font-semibold">Tax</dt><dd>{s.terms.tax}</dd></div></dl>
   </article>)}</div>
 </section>
}
export function DemoCompanyRecords({selectedId,refreshKey=0}:{selectedId:DemoIndustry;refreshKey?:number}){
 const preset=DEMO_PRESETS[selectedId];
 const [live,setLive]=useState<DemoCatalog|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
   let alive=true;
   if(!CLOUD_API_BASE)return;
   cloudRequest('/demo/catalog').then((value)=>{const r=value as DemoCatalog;if(alive){setLive(r);setError('')}}).catch((e:Error)=>{if(alive)setError(e.message)});
   return()=>{alive=false};
 },[refreshKey]);
 const viewingLive=live?.active===selectedId;
 const rows=viewingLive?live!.materials.map(r=>({sku:r.sku,name:r.item_name,priority:r.priority,unit:r.unit,onHand:r.on_hand,reorderPoint:r.reorder_point,targetQty:r.target_qty,unitPrice:r.unit_price_cents/100,specs:r.specifications})):preset.materials;
 const supplierCards=viewingLive?live!.suppliers:preset.suppliers.map((s,i)=>({supplierId:`demo-supplier-${selectedId}-${i+1}`,name:s.name,category:s.category,contact:s.contact,terms:s.terms,simulated:true as const}));
 const counts={A:rows.filter(r=>r.priority==='A').length,B:rows.filter(r=>r.priority==='B').length,C:rows.filter(r=>r.priority==='C').length};
 return <section className="space-y-4">
  <header className="rounded-xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-bold text-slate-900">{preset.companyName} · Inventory priority guide</h3><p className="mt-1 text-sm text-slate-600">{preset.summary}</p></div><span className="text-xs font-semibold text-slate-500">{viewingLive?'Active company inventory':'Preset configuration'}</span></div>
   <div className="mt-3 grid gap-2 sm:grid-cols-3">{(['A','B','C'] as const).map(c=><div key={c} className="rounded-lg bg-slate-50 p-3"><span className={`${priorityClass(c)} rounded px-2 py-1 text-xs font-bold`}>Priority {c}</span><p className="mt-2 text-sm font-semibold">{counts[c]} configured items</p><p className="text-xs text-slate-500">{c==='A'?'Critical to current sales, production or repair jobs':c==='B'?'Regular, planned replenishment':'Routine support and non-urgent supplies'}</p></div>)}</div>
  </header>
  {error&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">Live company catalog unavailable: {error}. Showing preset configuration.</p>}
  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b p-4"><h4 className="font-bold">Company stock records & reorder points</h4><p className="text-xs text-slate-500">Operational A/B/C urgency is independent of inventory-value ABC analysis and government approved budgets.</p></div>
   <div className="overflow-x-auto"><table className="min-w-[820px] w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{['Priority','Material / SKU','Stock','Reorder at','Planned purchase','Unit price','Stock status'].map(x=><th className="p-3" key={x}>{x}</th>)}</tr></thead><tbody>{rows.map(item=><tr className="border-t" key={item.sku}><td className="p-3"><span className={`${priorityClass(item.priority)} rounded px-2 py-1 text-xs font-semibold`}>Type {item.priority}</span></td><td className="p-3"><strong>{item.name}</strong><p className="text-xs text-slate-500">{item.sku} · {item.specs}</p></td><td className="p-3">{item.onHand} {item.unit}</td><td className="p-3">{item.reorderPoint} {item.unit}</td><td className="p-3">{item.targetQty} {item.unit}</td><td className="p-3">{formatPHP(item.unitPrice)}</td><td className="p-3"><span className={item.onHand<=item.reorderPoint?'font-bold text-amber-700':'text-emerald-700'}>{item.onHand<=item.reorderPoint?'Reorder needed':'Sufficient'}</span></td></tr>)}</tbody></table></div>
  </div>
  <DemoSupplierTerms suppliers={supplierCards}/>
  {viewingLive&&live?.accounts?.length>0&&DB.currentUser?.role==='Admin'&&<section className="rounded-xl border bg-white p-5 space-y-3">
   <h4 className="font-bold">Premade department and supplier logins</h4><p className="text-xs text-amber-800">TRAINING ONLY: Every account below starts with password <strong>password123</strong>. Change it after first login. Do not load training records into a production system.</p>
   <div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-xs"><thead className="bg-slate-50"><tr>{['Department / Company','Account name','Position','Login username','Initial password'].map(v=><th className="p-2" key={v}>{v}</th>)}</tr></thead><tbody>{live.accounts.map(a=><tr className="border-t" key={a.username}><td className="p-2">{a.department||'Supplier company'}</td><td className="p-2 font-medium">{a.name.replace(/^demo\s+/i,'')}</td><td className="p-2">{a.app_role==='Procurement Head'||a.app_role==='Procurement Officer'?a.app_role:a.requested_position}</td><td className="p-2 font-mono">{a.username}</td><td className="p-2 font-mono">password123</td></tr>)}</tbody></table></div>
  </section>}
  {viewingLive&&<p className="text-xs text-slate-500">Supplier stock is independently visible under Supplier Stock Directory. Supplier Accreditation shows submitted records and their verification status. This company-side stock list is separate from supplier inventory.</p>}
 </section>;
}
