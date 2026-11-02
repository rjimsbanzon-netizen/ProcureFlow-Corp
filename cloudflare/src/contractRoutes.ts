/** Contract lifecycle, negotiated prices, immutable renewal history and expiry alerts. */
import type {D1Database} from '@cloudflare/workers-types';
import {philippinesToday} from './delegationRoutes';
import {evidenceStatement} from './auditEvidenceRoutes';
type Row=Record<string,any>;
type Env={DB:D1Database};
type User={id:string;name:string;role:string;app_role:string;company_name:string};
const json=(data:unknown,status=200,cors:HeadersInit={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json',...cors}});
const dateValid=(d:unknown)=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(`${d}T00:00:00Z`))&&new Date(`${d}T00:00:00Z`).toISOString().slice(0,10)===d;
const moneyCents=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e10?Math.round(v*100):null;
const clean=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length<=max?v.trim():null;
const isManager=(u:User)=>u.role==='admin'||u.app_role==='Procurement Head';
async function canView(env:Env,user:User):Promise<boolean>{
 if(user.role==='guest'||isManager(user)||user.app_role==='Procurement Officer')return true;
 if(user.role!=='employee'||user.app_role!=='Employee')return false;
 const row=await env.DB.prepare(`SELECT 1 AS permitted FROM finance_approvers a JOIN users u ON u.id=a.user_id
   WHERE a.user_id=? AND u.status='approved' AND u.access_revoked=0
   AND LOWER(TRIM(u.department)) IN ('finance & accounting','finance and accounting','finance')
   AND ((a.step_role='Finance Officer' AND a.department='*') OR
     (a.step_role='Department Head' AND LOWER(TRIM(a.department)) IN ('finance & accounting','finance and accounting','finance'))) LIMIT 1`)
   .bind(user.id).first<Row>();
 return Boolean(row);
}
const same=(a:unknown,b:unknown)=>String(a??'').trim().toLowerCase()===String(b??'').trim().toLowerCase();
function statusOf(row:Row,today:string){
 if(row.terminated_at)return 'Terminated';
 if(row.lifecycle_status==='Draft')return 'Draft';
 if(row.ends_on<today)return 'Expired';
 if(row.starts_on>today)return 'Upcoming';
 return 'Active';
}
const dayDelta=(date:string,today:string)=>Math.round((Date.parse(date+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
async function snapshot(env:Env):Promise<Row>{
 const r=await env.DB.prepare('SELECT data FROM enterprise_state WHERE id=1').first<{data:string}>();
 try{return r?JSON.parse(r.data) as Row:{}}catch{return {}}
}
async function getContracts(env:Env,user:User){
 const records=(await env.DB.prepare('SELECT * FROM procurement_contracts ORDER BY ends_on ASC, created_at DESC').all<Row>()).results;
 const visible=user.role==='guest'?records.filter(r=>r.lifecycle_status!=='Draft' && (same(r.supplier_name,user.company_name) || r.supplier_id===`supplier-${user.id}`)):records;
 const today=philippinesToday();
 return visible.map((row:Row):Row=>({...row,price:Number(row.negotiated_price_cents)/100,status:statusOf(row,today),daysUntilExpiry:dayDelta(row.ends_on,today)}));
}
async function getOne(env:Env,id:string):Promise<Row|null>{return env.DB.prepare('SELECT * FROM procurement_contracts WHERE id=?').bind(id).first<Row>()}
async function supplierFor(env:Env,id:string){
 const data=await snapshot(env);
 return Array.isArray(data.suppliers)?data.suppliers.find((s:Row)=>s.id===id):null;
}
function alertFor(row:Row){return row.status!=='Draft' && !row.terminated_at && row.daysUntilExpiry<=Number(row.renewal_notice_days)}
export async function handleContractRoutes(request:Request,env:Env,user:User,cors:HeadersInit):Promise<Response|null>{
 const path=new URL(request.url).pathname;
 if(!path.startsWith('/contracts'))return null;
 if(!await canView(env,user))return json({error:'Only Procurement and appointed Finance staff may access contracts.'},403,cors);
 if(path==='/contracts'&&request.method==='GET'){
   const contracts=await getContracts(env,user);
   return json({contracts},200,cors);
 }
 if(path==='/contracts/alerts'&&request.method==='GET'){
   const contracts=await getContracts(env,user);
   return json({alerts:contracts.filter(alertFor).map(r=>({id:r.id,reference:r.reference,title:r.title,supplierName:r.supplier_name,endsOn:r.ends_on,daysUntilExpiry:r.daysUntilExpiry,status:r.status,updatedAt:r.updated_at}))},200,cors);
 }
 if(!isManager(user))return json({error:'Only Procurement Head or Admin can manage contracts.'},403,cors);
 if(path==='/contracts'&&request.method==='POST'){
   const b=await request.json() as Row;
   const reference=clean(b.reference,60),title=clean(b.title,180),supplierId=clean(b.supplierId,120);
   const terms=clean(b.pricingTerms,1500),notes=clean(b.notes??'',2000);
   const cents=moneyCents(b.price),days=Number(b.renewalNoticeDays);
   if(!reference||!title||!supplierId||terms===null||notes===null||cents===null||
      !dateValid(b.startsOn)||!dateValid(b.endsOn)||b.startsOn>b.endsOn||!Number.isInteger(days)||days<1||days>365||
      (b.poId!==undefined && (typeof b.poId!=='string'||b.poId.length>100))||
      (b.bidId!==undefined && (typeof b.bidId!=='string'||b.bidId.length>100))||
      (b.saveAsDraft!==undefined && typeof b.saveAsDraft!=='boolean'))
     return json({error:'Complete contract reference, supplier, dates, price and valid renewal notice (1–365 days).'},400,cors);
   const supplier=await supplierFor(env,supplierId);
   if(!supplier)return json({error:'Choose a supplier from the verified supplier directory.'},409,cors);
   const state=await snapshot(env),poId=clean(b.poId??'',100)||null,bidId=clean(b.bidId??'',100)||null;
   const orders=Array.isArray(state.orders)?state.orders:[];
   const bids=Array.isArray(state.bids)?state.bids:[];
   const needs=Array.isArray(state.stockNeeds)?state.stockNeeds:[];
   const order=poId?orders.find((o:Row)=>o.id===poId):null;
   if(poId&&!order)return json({error:'The linked Purchase Order could not be found.'},409,cors);
   if(order && (order.supplierId ? order.supplierId!==supplierId : !same(order.supplierName,supplier.name)))
     return json({error:'The Purchase Order belongs to a different supplier.'},409,cors);
   const bid=bidId?bids.find((row:Row)=>row.id===bidId):null;
   if(bidId&&!bid)return json({error:'The linked supplier bid could not be found.'},409,cors);
   if(bid){
     if(bid.supplierId ? bid.supplierId!==supplierId : !same(bid.supplierName,supplier.name))
       return json({error:'The selected bid belongs to a different supplier.'},409,cors);
     const need=needs.find((row:Row)=>row.id===bid.needId);
     const awarded=bid.status==='Selected' || need?.selectedBidId===bid.id || orders.some((row:Row)=>row.bidId===bid.id && (row.supplierId===supplierId||same(row.supplierName,supplier.name)));
     if(!awarded)return json({error:'Only the winning supplier bid can be linked to a contract.'},409,cors);
     if(order?.bidId && order.bidId!==bid.id)return json({error:'Purchase Order and selected bid do not match.'},409,cors);
   }
   if(order?.bidId && !bidId)return json({error:'Link the selected bid associated with the Purchase Order.'},409,cors);
   const lifecycle=b.saveAsDraft===true?'Draft':'Published';
   const now=new Date().toISOString(),id=crypto.randomUUID();
   try{
     await env.DB.batch([
       env.DB.prepare(`INSERT INTO procurement_contracts
         (id,reference,title,supplier_id,supplier_name,po_id,bid_id,lifecycle_status,starts_on,ends_on,negotiated_price_cents,pricing_terms,renewal_notice_days,notes,created_by,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
         .bind(id,reference,title,supplierId,supplier.name,poId,bidId,lifecycle,b.startsOn,b.endsOn,cents,terms,days,notes,user.id,now,now),
       evidenceStatement(env,user,'contracts',reference,'Created',null,{title,supplier:supplier.name,poId,bidId,lifecycle,startsOn:b.startsOn,endsOn:b.endsOn,price:b.price,days})
     ]);
   }catch(e){if(String(e).includes('UNIQUE'))return json({error:'Contract reference already exists.'},409,cors);throw e;}
   return json({ok:true,id},201,cors);
 }
 const activate=path.match(/^\/contracts\/([^/]+)\/activate$/);
 if(activate&&request.method==='POST'){
   const id=decodeURIComponent(activate[1]),old=await getOne(env,id);
   if(!old)return json({error:'Contract not found.'},404,cors);
   if(old.terminated_at||old.lifecycle_status!=='Draft')return json({error:'Only an unterminated draft contract can be activated.'},409,cors);
   if(old.ends_on<philippinesToday())return json({error:'The contract has already expired; update its validity before activation.'},409,cors);
   const now=new Date().toISOString();
   const result=await env.DB.prepare("UPDATE procurement_contracts SET lifecycle_status='Published',updated_at=? WHERE id=? AND lifecycle_status='Draft' AND terminated_at IS NULL")
     .bind(now,id).run();
   if(result.meta.changes!==1)return json({error:'Contract changed. Refresh and retry.'},409,cors);
   await evidenceStatement(env,user,'contracts',String(old.reference||id),'Activated',{lifecycle_status:'Draft'},{lifecycle_status:'Published'}).run();
   return json({ok:true},200,cors);
 }
 const one=path.match(/^\/contracts\/([^/]+)$/);
 if(one&&request.method==='PUT'){
   const id=decodeURIComponent(one[1]),previous=await getOne(env,id);
   if(!previous)return json({error:'Contract not found.'},404,cors);
   if(previous.terminated_at)return json({error:'Terminated contracts cannot be edited.'},409,cors);
   const b=await request.json() as Row;
   const title=clean(b.title,180),terms=clean(b.pricingTerms,1500),notes=clean(b.notes??'',2000);
   const price=moneyCents(b.price),days=Number(b.renewalNoticeDays);
   if(!title||terms===null||notes===null||price===null||!Number.isInteger(days)||days<1||days>365)
     return json({error:'Provide a valid contract title, pricing terms, price and notice period.'},400,cors);
   // Contract dates and supplier are locked here; renewals must create history through /renew.
   await env.DB.batch([
     env.DB.prepare(`UPDATE procurement_contracts SET title=?,pricing_terms=?,notes=?,negotiated_price_cents=?,renewal_notice_days=?,updated_at=?
       WHERE id=? AND terminated_at IS NULL`)
       .bind(title,terms,notes,price,days,new Date().toISOString(),id),
     evidenceStatement(env,user,'contracts',String(previous.reference||id),'Updated',previous,{...previous,title,pricing_terms:terms,notes,negotiated_price_cents:price,renewal_notice_days:days})
   ]);
   return json({ok:true},200,cors);
 }
 const history=path.match(/^\/contracts\/([^/]+)\/renewals$/);
 if(history&&request.method==='GET'){
   // Only authenticated managers can reach this route (supplier access checked above).
   const id=decodeURIComponent(history[1]);
   const rows=(await env.DB.prepare('SELECT * FROM procurement_contract_renewals WHERE contract_id=? ORDER BY renewed_at DESC').bind(id).all<Row>()).results;
   return json({renewals:rows},200,cors);
 }
 const renew=path.match(/^\/contracts\/([^/]+)\/renew$/);
 if(renew&&request.method==='POST'){
   const id=decodeURIComponent(renew[1]),old=await getOne(env,id);
   if(!old)return json({error:'Contract not found.'},404,cors);
   if(old.terminated_at||old.lifecycle_status==='Draft')return json({error:'Draft or terminated contracts cannot be renewed.'},409,cors);
   const b=await request.json() as Row;
   const reason=clean(b.reason,1000),nextPrice=moneyCents(b.price);
   if(!dateValid(b.newEndsOn)||b.newEndsOn<=old.ends_on||!reason||reason.length<5||nextPrice===null)
     return json({error:'Choose a later expiration date, negotiated price, and renewal reason (at least 5 characters).'},400,cors);
   const now=new Date().toISOString();
   const results=await env.DB.batch([
     env.DB.prepare(`UPDATE procurement_contracts SET ends_on=?,negotiated_price_cents=?,updated_at=?
       WHERE id=? AND ends_on=? AND terminated_at IS NULL`).bind(b.newEndsOn,nextPrice,now,id,old.ends_on),
     env.DB.prepare(`INSERT INTO procurement_contract_renewals
       (id,contract_id,previous_ends_on,new_ends_on,previous_price_cents,new_price_cents,reason,renewed_by,renewed_at)
       SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM procurement_contracts WHERE id=? AND ends_on=? AND updated_at=? AND terminated_at IS NULL)`)
       .bind(crypto.randomUUID(),id,old.ends_on,b.newEndsOn,old.negotiated_price_cents,nextPrice,reason,user.id,now,id,b.newEndsOn,now)
   ]);
   if(results[0].meta.changes!==1)return json({error:'Contract was modified by another account. Refresh.'},409,cors);
   await evidenceStatement(env,user,'contracts',String(old.reference||id),'Renewed',
     {ends_on:old.ends_on,price:Number(old.negotiated_price_cents)/100},
     {ends_on:b.newEndsOn,price:b.price,reason}).run();
   return json({ok:true},200,cors);
 }
 const terminate=path.match(/^\/contracts\/([^/]+)\/terminate$/);
 if(terminate&&request.method==='POST'){
   const id=decodeURIComponent(terminate[1]),b=await request.json() as Row;
   const reason=clean(b.reason,1000);
   if(!reason||reason.length<5)return json({error:'A termination reason of at least 5 characters is required.'},400,cors);
   const previous=await getOne(env,id);
   const now=new Date().toISOString();
   const result=await env.DB.prepare('UPDATE procurement_contracts SET terminated_at=?,termination_reason=?,updated_at=? WHERE id=? AND terminated_at IS NULL')
     .bind(now,reason,now,id).run();
   if(result.meta.changes!==1)return json({error:'Contract not found or already terminated.'},409,cors);
   await evidenceStatement(env,user,'contracts',String(previous?.reference||id),'Terminated',previous,previous?{...previous,terminated_at:now,termination_reason:reason}: {reason,terminatedAt:now}).run();
   return json({ok:true},200,cors);
 }
 return json({error:'Contract action not supported.'},404,cors);
}
