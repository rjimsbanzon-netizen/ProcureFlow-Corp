/** Secure supplier analytics. This endpoint calculates only from stored transaction records. */
import type { D1Database } from '@cloudflare/workers-types';

type Row = Record<string, any>;
type Env = { DB:D1Database };
type User = {id:string; role:string; app_role:string; company_name:string};
const arr = (v:unknown):Row[] => Array.isArray(v)?v:[];
const same = (a:unknown,b:unknown) => String(a??'').trim().toLowerCase()===String(b??'').trim().toLowerCase();
const num = (v:unknown) => Number.isFinite(Number(v))?Number(v):0;
const money = (v:number) => Math.round(v*100)/100;
const date = (v:unknown) => {
  const text=String(v||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text))return null;
  const stamp=Date.parse(text+'T00:00:00Z');
  return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===text?text:null;
};
const reply = (payload:unknown,status=200,cors:HeadersInit={}) => new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store',...cors}});

export async function handlePerformanceRoutes(req:Request,env:Env,user:User,cors:HeadersInit):Promise<Response|null>{
  const url=new URL(req.url);
  if(url.pathname!=='/analytics/suppliers')return null;
  if(req.method!=='GET')return reply({error:'Method not allowed'},405,cors);
  const supplier=user.role==='guest';
  const canManage=user.role==='admin'||['Procurement Head','Procurement Officer'].includes(user.app_role);
  if(!supplier&&!canManage)return reply({error:'Supplier analytics are restricted to Procurement and the supplier concerned.'},403,cors);
  const existing=await env.DB.prepare('SELECT data FROM enterprise_state WHERE id=1').first<{data:string}>();
  const data:Row=existing?.data?JSON.parse(existing.data):{};
  const orders=arr(data.orders),deliveries=arr(data.deliveries),bids=arr(data.bids),needs=arr(data.stockNeeds),directory=arr(data.suppliers),ratings=arr(data.ratings);
  const supplierName=String(user.company_name||'');
  const keyFor=(record:Row)=>String(record.supplierId||'').trim()||String(record.supplierName||'').trim();
  const keys=new Map<string,{id:string;name:string}>();
  for(const s of directory){const key=String(s.id||s.name||'');if(key)keys.set(key,{id:String(s.id||''),name:String(s.name||key)});}
  for(const row of [...orders,...bids]){const key=keyFor(row);if(key&&!keys.has(key))keys.set(key,{id:String(row.supplierId||''),name:String(row.supplierName||key)});}
  const matchSupplier=(a:Row,b:{id:string;name:string})=>Boolean(b.id&&a.supplierId===b.id)||same(a.supplierName,b.name);
  const allowed=[...keys.values()].filter(v=>!supplier||(Boolean(supplierName)&&same(v.name,supplierName))||v.id===`supplier-${user.id}`);
  const results=allowed.map(s=>{
    const supplierOrders=orders.filter(o=>matchSupplier(o,s));
    const poIds=new Set(supplierOrders.map(o=>String(o.id||'')));
    const inspected=deliveries.filter(d=>poIds.has(String(d.poId||''))&&String(d.complianceStatus||'')!=='Pending Inspection');
    const dated=deliveries.filter(d=>poIds.has(String(d.poId||''))&&date(d.expectedDate)&&date(d.actualDate));
    const onTime=dated.filter(d=>String(date(d.actualDate))<=String(date(d.expectedDate))).length;
    const rejected=inspected.filter(d=>/non-compliant|rejected|damaged|issue flagged/i.test(String(d.complianceStatus||''))).length;
    const verified=inspected.filter(d=>d.complianceStatus==='Completed - Verified').length;
    const matchingRatings=ratings.filter(r=>(s.id&&r.supplierId===s.id)||same(r.supplierName,s.name)).filter(r=>num(r.rating)>=1&&num(r.rating)<=5);
    const prices=supplierOrders.flatMap(po=>{
      const qty=num(po.quantity),cost=num(po.totalCost),at=date(po.poDate);
      return qty>0&&cost>=0&&at?[{id:String(po.id),date:at,item:String(po.itemTitle||'Unspecified item'),price:money(cost/qty),source:'Awarded PO'}]:[];
    });
    const quotes=bids.filter(b=>matchSupplier(b,s)).flatMap(b=>{
      const unit=num(b.unitPrice),at=date(b.submittedAt),need=needs.find(n=>String(n.id)===String(b.needId));
      return unit>=0&&at?[{id:String(b.id),date:at,item:String(need?.title||'Unspecified item'),price:money(unit),source:'Submitted bid'}]:[];
    });
    return {id:s.id||s.name,name:s.name,orderCount:supplierOrders.length,
      inspectedCount:inspected.length,rejectedCount:rejected,verifiedCount:verified,
      datedCount:dated.length,onTimeCount:onTime,
      onTimeRate:dated.length?money(onTime/dated.length*100):null,
      rejectionRate:inspected.length?money(rejected/inspected.length*100):null,
      avgRating:matchingRatings.length?money(matchingRatings.reduce((sum,r)=>sum+num(r.rating),0)/matchingRatings.length):null,
      ratingCount:matchingRatings.length,
      priceHistory:[...prices,...quotes].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).slice(-500)};
  }).filter(r=>supplier||r.orderCount||r.priceHistory.length).sort((a,b)=>b.orderCount-a.orderCount||a.name.localeCompare(b.name));
  return reply({suppliers:results,definitions:{onTime:'Deliveries with actual and expected dates; on time when actual date is on or before expected date.',rejection:'Inspected deliveries with flagged, damaged, rejected, or non-compliant outcomes; excludes inspections still pending.',pricing:'Per-unit PO cost (total divided by quantity) and submitted bid unit quotes; amounts are in PHP and shown separately. Different items should not be compared as the same price series.'}},200,cors);
}
