/** Company-scoped supplier inventory, contracted recurring supply plans, shortage review.
 * Inventory numbers are supplier-reported; recommendations NEVER issue POs, reserve stock,
 * bypass accreditation, or change existing approval/finance workflows.
 */
import type {D1Database} from '@cloudflare/workers-types';
type Env={DB:D1Database};
type User={id:string;name:string;role:string;app_role:string;company_name:string};
type R=Record<string,any>;
const json=(v:unknown,code=200,cors:HeadersInit={})=>new Response(JSON.stringify(v),{status:code,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors}});
const text=(v:unknown,max:number)=>typeof v==='string' && v.trim().length<=max ? v.trim() : null;
const positive=(v:unknown,max=1e9)=>typeof v==='number' && Number.isFinite(v) && v>0 && v<=max;
const nonnegative=(v:unknown,max=1e9)=>typeof v==='number' && Number.isFinite(v) && v>=0 && v<=max;
const same=(a:unknown,b:unknown)=>String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();
const date=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const isSupplier=(u:User)=>u.role==='guest'&&u.app_role==='Supplier';
const isHead=(u:User)=>u.role==='admin'||u.app_role==='Procurement Head';
const isStaff=(u:User)=>isHead(u)||(u.role==='employee'&&u.app_role==='Procurement Officer');
const categories=['Goods & Materials','Equipment & Capital Assets','General Services','Professional & Consulting Services','Construction & Works','Software & Digital Services','Rental & Leasing','Utilities & Subscriptions'];
const frequencies=['Weekly','Monthly','Quarterly','Annually'];
async function state(env:Env):Promise<R>{const x=await env.DB.prepare('SELECT data FROM enterprise_state WHERE id=1').first<{data:string}>();try{return x?.data?JSON.parse(x.data) as R:{}}catch{return {}}}
function suppliers(s:R):R[]{return Array.isArray(s.suppliers)?s.suppliers:[]}
function supplierForUser(s:R,u:User):R|null{
  if(!isSupplier(u)||!u.company_name?.trim())return null;
  return suppliers(s).find(x=>same(x.name,u.company_name))||null;
}
function supplierById(s:R,id:string):R|null{return suppliers(s).find(x=>x.id===id)||null}
async function accredited(env:Env,supplierName:string):Promise<boolean>{
  const a=await env.DB.prepare(`SELECT 1 AS ok FROM users u INNER JOIN supplier_accreditations ac ON ac.supplier_user_id=u.id
    WHERE u.role='guest' AND u.app_role='Supplier' AND u.status='approved' AND u.access_revoked=0
    AND LOWER(TRIM(u.company_name))=LOWER(TRIM(?)) AND ac.status='Approved' LIMIT 1`).bind(supplierName).first<{ok:number}>();
  return Boolean(a);
}
async function activeContract(env:Env,id:string,supplierId:string):Promise<R|null>{
  return env.DB.prepare(`SELECT * FROM procurement_contracts WHERE id=? AND supplier_id=? AND lifecycle_status='Published'
    AND terminated_at IS NULL AND date(starts_on)<=date('now','+8 hours') AND date(ends_on)>=date('now','+8 hours')`)
    .bind(id,supplierId).first<R>();
}
async function backupAvailable(env:Env,plan:R):Promise<number>{
  if(!plan.backup_supplier_id)return 0;
  const inv=await env.DB.prepare('SELECT on_hand,reserved,unit FROM supplier_company_inventory WHERE supplier_id=? AND LOWER(sku)=LOWER(?)')
    .bind(plan.backup_supplier_id,plan.sku).first<R>();
  return inv && same(inv.unit,plan.unit) ? Math.max(0,Number(inv.on_hand)-Number(inv.reserved)):0;
}
async function log(env:Env,user:User,action:string,description:string){
  // Independent audit: update-only administrative actions are recorded by D1.
  await env.DB.prepare('INSERT INTO supply_chain_audit(id,action,description,user_id,created_at) VALUES(?,?,?,?,?)')
    .bind(crypto.randomUUID(),action,description,user.id,new Date().toISOString()).run();
}
export async function handleSupplyChainRoutes(request:Request,env:Env,user:User,cors:HeadersInit):Promise<Response|null>{
  const path=new URL(request.url).pathname;
  if(!path.startsWith('/supply-chain'))return null;
  if(!isSupplier(user)&&!isStaff(user))return json({error:'Supplier inventory and supply planning are limited to authorized accounts.'},403,cors);
  const s=await state(env);
  const own=supplierForUser(s,user);
  if(isSupplier(user)&&!own)return json({error:'Your registered company must be linked to the verified supplier directory before its inventory can be managed.'},403,cors);
  const supplierId=isSupplier(user)?String(own?.id||''):'';
  const now=new Date().toISOString();
  if(path==='/supply-chain/inventory'&&request.method==='GET'){
    const result=isSupplier(user)
      ?await env.DB.prepare('SELECT * FROM supplier_company_inventory WHERE supplier_id=? ORDER BY item_name,sku').bind(supplierId).all<R>()
      :await env.DB.prepare('SELECT * FROM supplier_company_inventory ORDER BY supplier_name,item_name,sku').all<R>();
    return json({inventory:result.results},200,cors);
  }
  if(path==='/supply-chain/inventory'&&request.method==='POST'){
    if(!isSupplier(user))return json({error:'Only the supplier company can update its own inventory.'},403,cors);
    // An approved, non-revoked supplier user must also have approved accreditation.
    const approval=await env.DB.prepare("SELECT status FROM supplier_accreditations WHERE supplier_user_id=?").bind(user.id).first<{status:string}>();
    if(approval?.status!=='Approved')return json({error:'Supplier accreditation must be approved before publishing stock.'},403,cors);
    const b=await request.json() as R;
    const sku=text(b.sku,60),name=text(b.itemName,180),unit=text(b.unit,30),spec=text(b.specifications??'',1200);
    if(!sku||!name||!unit||spec===null||!nonnegative(b.onHand)||!nonnegative(b.reserved)||b.reserved>b.onHand||
      !nonnegative(b.unitPrice,1e8)||!Number.isInteger(b.leadTimeDays)||b.leadTimeDays<0||b.leadTimeDays>365)
      return json({error:'Supply SKU, product name, unit, valid stock/reservations, price and lead time.'},400,cors);
    const prev=await env.DB.prepare('SELECT * FROM supplier_company_inventory WHERE supplier_id=? AND LOWER(sku)=LOWER(?)')
      .bind(supplierId,sku).first<R>();
    const id=String(prev?.id||crypto.randomUUID());
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO supplier_company_inventory(id,supplier_id,supplier_name,sku,item_name,specifications,unit,on_hand,reserved,unit_price_cents,lead_time_days,updated_by,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(supplier_id,sku) DO UPDATE SET item_name=excluded.item_name,specifications=excluded.specifications,
        unit=excluded.unit,on_hand=excluded.on_hand,reserved=excluded.reserved,unit_price_cents=excluded.unit_price_cents,
        lead_time_days=excluded.lead_time_days,updated_by=excluded.updated_by,updated_at=excluded.updated_at`)
        .bind(id,supplierId,String(own?.name),sku,name,spec,unit,b.onHand,b.reserved,Math.round(b.unitPrice*100),b.leadTimeDays,user.id,now),
      env.DB.prepare('INSERT INTO supplier_stock_audit(id,inventory_id,supplier_id,old_on_hand,new_on_hand,old_reserved,new_reserved,changed_by,changed_at) VALUES(?,?,?,?,?,?,?,?,?)')
        .bind(crypto.randomUUID(),id,supplierId,prev?.on_hand??null,b.onHand,prev?.reserved??null,b.reserved,user.id,now)
    ]);
    return json({ok:true,id},200,cors);
  }
  if(path==='/supply-chain/plans'&&request.method==='GET'){
    if(!isStaff(user))return json({error:'Supply plans are internal procurement records.'},403,cors);
    const plans=(await env.DB.prepare(`SELECT p.*,s1.name AS primary_supplier_name,s2.name AS backup_supplier_name,c.reference AS primary_contract_reference
       FROM recurring_supply_plans p LEFT JOIN (SELECT id,name FROM suppliers) s1 ON s1.id=p.primary_supplier_id
       LEFT JOIN (SELECT id,name FROM suppliers) s2 ON s2.id=p.backup_supplier_id
       LEFT JOIN procurement_contracts c ON c.id=p.primary_contract_id ORDER BY p.next_release_date`).all<R>()).results;
    // supplier directory for this app is in enterprise_state, not necessarily the legacy suppliers table.
    return json({plans:plans.map(p=>({...p,primary_supplier_name:supplierById(s,p.primary_supplier_id)?.name||p.primary_supplier_name||'',backup_supplier_name:supplierById(s,p.backup_supplier_id)?.name||p.backup_supplier_name||''})),
      suppliers:suppliers(s).map(x=>({id:x.id,name:x.name,status:x.status}))},200,cors);
  }
  if(path==='/supply-chain/plans'&&request.method==='POST'){
    if(!isHead(user))return json({error:'Only Procurement Head or Admin may create contractual supply plans.'},403,cors);
    const b=await request.json() as R;
    const name=text(b.itemName,180),sku=text(b.sku,60),unit=text(b.unit,30),category=text(b.category,70),freq=text(b.frequency,30);
    const primary=text(b.primarySupplierId,120),backup=text(b.backupSupplierId??'',120),contract=text(b.primaryContractId,120),backupContract=text(b.backupContractId??'',120);
    if(!name||!sku||!unit||!primary||!contract||!categories.includes(category||'')||!frequencies.includes(freq||'')||!['A','B','C'].includes(b.priority)||
      !positive(b.quantityPerCycle)||!nonnegative(b.safetyStock)||!date(b.nextReleaseDate)||!['Active','Paused'].includes(b.status)||
      backup===null||backupContract===null||(backup&&backup===primary)||(backupContract&&!backup))
      return json({error:'Provide an item, operational priority, category, recurrence, quantity, and distinct supplier assignments.'},400,cors);
    const primarySupplier=supplierById(s,primary),backupSupplier=backup?supplierById(s,backup):null;
    if(!primarySupplier||(backup&&!backupSupplier))return json({error:'Choose companies from the registered supplier directory.'},400,cors);
    if(!await accredited(env,primarySupplier.name))return json({error:'Primary supplier must have current approved accreditation.'},409,cors);
    if(backupSupplier&&!await accredited(env,backupSupplier.name))return json({error:'Backup supplier must have current approved accreditation.'},409,cors);
    if(!await activeContract(env,contract,primary))return json({error:'Primary supplier needs an active matching contract.'},409,cors);
    if(backupContract&&!await activeContract(env,backupContract,backup!))return json({error:'Backup contract must be active and belong to the backup supplier.'},409,cors);
    const id=crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO recurring_supply_plans(id,item_name,sku,unit,category,priority,primary_supplier_id,backup_supplier_id,
      primary_contract_id,backup_contract_id,quantity_per_cycle,frequency,next_release_date,safety_stock,status,created_by,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,name,sku,unit,category,b.priority,primary,backup||null,contract,backupContract||null,
        b.quantityPerCycle,freq,b.nextReleaseDate,b.safetyStock,b.status,user.id,now,now).run();
    await log(env,user,'Plan created',`Created recurring supply plan ${id} for ${sku}.`);
    return json({ok:true,id},201,cors);
  }
  const toggle=path.match(/^\/supply-chain\/plans\/([^/]+)\/status$/);
  if(toggle&&request.method==='PUT'){
    if(!isHead(user))return json({error:'Procurement Head or Admin required.'},403,cors);
    const b=await request.json() as R;
    if(!['Active','Paused'].includes(b.status))return json({error:'Invalid plan status.'},400,cors);
    const result=await env.DB.prepare('UPDATE recurring_supply_plans SET status=?,updated_at=? WHERE id=?')
      .bind(b.status,now,decodeURIComponent(toggle[1])).run();
    if(result.meta.changes!==1)return json({error:'Plan not found.'},404,cors);
    await log(env,user,'Plan status',`Changed plan ${toggle[1]} to ${b.status}.`);
    return json({ok:true},200,cors);
  }
  if(path==='/supply-chain/shortages'&&request.method==='GET'){
    if(!isStaff(user))return json({error:'Internal procurement access required.'},403,cors);
    const rows=(await env.DB.prepare(`SELECT sh.*,p.item_name,p.sku,p.unit,p.priority,p.category,p.primary_supplier_id,p.backup_supplier_id,p.backup_contract_id
      FROM supply_shortage_cases sh JOIN recurring_supply_plans p ON p.id=sh.plan_id ORDER BY sh.created_at DESC`).all<R>()).results;
    const withStock=await Promise.all(rows.map(async sh=>({...sh,backup_available_now:await backupAvailable(env,sh),
      primary_supplier_name:supplierById(s,sh.primary_supplier_id)?.name||'',backup_supplier_name:supplierById(s,sh.backup_supplier_id)?.name||''})));
    return json({shortages:withStock},200,cors);
  }
  if(path==='/supply-chain/shortages'&&request.method==='POST'){
    if(!isStaff(user))return json({error:'Procurement personnel required.'},403,cors);
    const b=await request.json() as R;
    const planId=text(b.planId,120),notes=text(b.notes??'',1000);
    if(!planId||notes===null||!positive(b.requiredQty)||!nonnegative(b.primaryConfirmedQty)||b.primaryConfirmedQty>=b.requiredQty)
      return json({error:'Provide a valid supply plan and a genuine quantity shortage.'},400,cors);
    const plan=await env.DB.prepare("SELECT * FROM recurring_supply_plans WHERE id=? AND status='Active'").bind(planId).first<R>();
    if(!plan)return json({error:'Only active recurring plans can be reported.'},409,cors);
    const gap=Math.round((b.requiredQty-b.primaryConfirmedQty)*1e6)/1e6;
    const available=await backupAvailable(env,plan);
    const id=crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO supply_shortage_cases(id,plan_id,required_qty,primary_confirmed_qty,shortage_qty,backup_available_at_report,status,notes,created_by,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(id,planId,b.requiredQty,b.primaryConfirmedQty,gap,available,'Open',notes,user.id,now).run();
    await log(env,user,'Shortage opened',`Reported ${gap} ${plan.unit} shortage for plan ${planId}.`);
    return json({ok:true,id,shortageQty:gap,backupAvailable:available},201,cors);
  }
  const review=path.match(/^\/supply-chain\/shortages\/([^/]+)\/review$/);
  if(review&&request.method==='POST'){
    if(!isHead(user))return json({error:'Only Procurement Head or Admin may review backup sourcing.'},403,cors);
    const b=await request.json() as R;
    if(!['Recommended','Closed'].includes(b.status)||text(b.notes??'',1000)===null)return json({error:'Choose Recommend or Close and provide valid notes.'},400,cors);
    const sh=await env.DB.prepare(`SELECT sh.*,p.status AS plan_status,p.sku,p.unit,p.category,p.backup_supplier_id,p.backup_contract_id
      FROM supply_shortage_cases sh JOIN recurring_supply_plans p ON p.id=sh.plan_id WHERE sh.id=?`).bind(decodeURIComponent(review[1])).first<R>();
    if(!sh)return json({error:'Shortage case not found.'},404,cors);
    if(sh.status!=='Open' && !(sh.status==='Recommended'&&b.status==='Closed'))return json({error:'Only open shortages can be reviewed or recommended shortages closed.'},409,cors);
    if(b.status==='Closed'&&String(b.notes??'').trim().length<5)return json({error:'Provide a closure reason with at least 5 characters.'},400,cors);
    if(b.status==='Recommended'){
      if(sh.plan_status!=='Active'||!sh.backup_supplier_id||!sh.backup_contract_id || !await activeContract(env,sh.backup_contract_id,sh.backup_supplier_id))
        return json({error:'An active backup contract and supplier are required before recommending the alternate.'},409,cors);
      const backupSupplier=supplierById(s,sh.backup_supplier_id);
      if(!backupSupplier||!await accredited(env,backupSupplier.name))return json({error:'Backup supplier accreditation must be approved.'},409,cors);
      const physical=['Goods & Materials','Equipment & Capital Assets'].includes(sh.category);
      const available=await backupAvailable(env,sh);
      if(physical&&available<=0)return json({error:'Backup supplier has no currently reported available stock for this SKU and unit.'},409,cors);
      if(!physical&&(!positive(b.backupConfirmedQty)||b.backupConfirmedQty>sh.shortage_qty||!text(b.confirmationReference,180)||String(b.confirmationReference).trim().length<5))
        return json({error:'For services/works, record a confirmed backup capacity and a supplier confirmation reference (at least 5 characters).'},400,cors);
      if(physical&&b.backupConfirmedQty!==undefined&&(!nonnegative(b.backupConfirmedQty)||b.backupConfirmedQty>available))
        return json({error:'Confirmed backup stock cannot exceed reported available quantity.'},400,cors);
      // A recommendation is NOT a reservation, order, invoice or budget approval.
    }
    const confirmed=b.status==='Recommended' ? (['Goods & Materials','Equipment & Capital Assets'].includes(sh.category)
      ? Math.min(sh.shortage_qty,await backupAvailable(env,sh)) : Number(b.backupConfirmedQty)) : null;
    const reference=b.status==='Recommended' && !['Goods & Materials','Equipment & Capital Assets'].includes(sh.category)
      ? text(b.confirmationReference,180) : null;
    const result=await env.DB.prepare(`UPDATE supply_shortage_cases SET status=?,reviewed_by=?,reviewed_at=?,review_notes=?,backup_confirmed_qty=?,confirmation_reference=? WHERE id=? AND status=?`)
      .bind(b.status,user.id,now,text(b.notes??'',1000),confirmed??sh.backup_confirmed_qty??null,reference??sh.confirmation_reference??null,sh.id,sh.status).run();
    if(result.meta.changes!==1)return json({error:'Case was changed. Refresh and retry.'},409,cors);
    await log(env,user,'Shortage reviewed',`Marked shortage ${sh.id} as ${b.status}; PO approval still required.`);
    return json({ok:true},200,cors);
  }
  return json({error:'Unsupported supply-chain operation.'},404,cors);
}
