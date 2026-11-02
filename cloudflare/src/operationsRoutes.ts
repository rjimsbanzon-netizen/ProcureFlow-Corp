/** ProcureFlow advanced reports, discrepancy tracking, verified inventory.
 * All writes use their own D1 tables; legacy procurement snapshots remain unchanged.
 */
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { evidenceStatement } from './auditEvidenceRoutes';

type Rec = Record<string, any>;
type Data = { requisitions: Rec[]; orders: Rec[]; deliveries: Rec[]; payments: Rec[]; ratings: Rec[]; suppliers: Rec[] };
type User = { id: string; role: string; app_role: string; department: string; company_name: string };
type Env = { DB: D1Database };
const same = (a:unknown,b:unknown) => String(a??'').trim().toLowerCase()===String(b??'').trim().toLowerCase();
const clean = (x:unknown,max=1000) => typeof x==='string'?x.trim().slice(0,max):'';
const n = (x:unknown) => Number.isFinite(Number(x))?Number(x):0;
const json = (payload:unknown,status=200,cors:HeadersInit={}) => new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json',...cors}});
const isManager=(u:User) => u.role==='admin'||['Procurement Head','Procurement Officer'].includes(u.app_role);
const isStaff=(u:User) => u.role==='admin'||u.role==='employee';
const permitted=(u:User,department:unknown) => isManager(u)||same(u.department,department);
const financeDepartment=(s:unknown)=>['finance & accounting','finance and accounting','finance'].includes(String(s??'').trim().toLowerCase());
const canManageMaterialConfig=(u:User)=>u.role==='admin'||u.app_role==='Operations Officer';
const validIndustries=['electronics','bakery','cellphone','construction','garment','restaurant','custom'];
const materialCodes=['A','B','C'];
const companySetupIds=new Set(['electronics','bakery','cellphone','construction','garment','restaurant']);
const cents=(value:unknown)=>{
 const amount=Number(value);
 return Number.isFinite(amount)&&amount>=0?Math.round(amount*100):NaN;
};
function departmentUsage(data:Data,department:string){
 let committedCents=0,spentCents=0;
 for(const pr of data.requisitions){
  if(!same(pr.department,department)||!['Approved','In Process','Completed'].includes(String(pr.status)))continue;
  const po=data.orders.find(order=>order.prId===pr.id);
  if(po){
   const amountCents=cents(po.totalCost??0);
   if(!Number.isSafeInteger(amountCents))continue;
   if(data.payments.some(payment=>payment.poId===po.id&&payment.status==='Paid'))spentCents+=amountCents;
   else committedCents+=amountCents;
  }else if(pr.status==='Approved')committedCents+=cents(pr.totalCost??0)||0;
 }
 return {committedCents,spentCents};
}
async function mayReportAcrossDepartments(env:Env,user:User){
  if(isManager(user))return true;
  if(!financeDepartment(user.department))return false;
  const records=(await env.DB.prepare('SELECT step_role,department FROM finance_approvers WHERE user_id=?').bind(user.id).all<{step_role:string;department:string}>()).results;
  return records.some(r=>(r.step_role==='Finance Officer'&&r.department==='*')||
    (r.step_role==='Department Head'&&financeDepartment(r.department)));
}
const asArray=(x:unknown):Rec[]=>Array.isArray(x)?x:[];
async function state(env:Env):Promise<Data>{
  const row=await env.DB.prepare('SELECT data FROM enterprise_state WHERE id=1').first<{data:string}>();
  const obj:Rec=row?.data?(JSON.parse(row.data) as Rec):{};
  return {requisitions:asArray(obj.requisitions),orders:asArray(obj.orders),deliveries:asArray(obj.deliveries),payments:asArray(obj.payments),ratings:asArray(obj.ratings),suppliers:asArray(obj.suppliers)};
}
const when=(x:unknown)=>{
  const s=clean(x,40);
  if(!/^\d{4}-\d{2}-\d{2}/.test(s))return NaN;
  const t=Date.parse(`${s.slice(0,10)}T00:00:00Z`);
  return Number.isFinite(t)?t:NaN;
};
const daysBetween=(a:unknown,b:unknown)=>{
  const x=when(a),y=when(b);
  return Number.isFinite(x)&&Number.isFinite(y)&&y>=x?Math.round((y-x)/86400000):null;
};
const round2=(v:number)=>Math.round(v*100)/100;
const category=(status:string)=>status.includes('Quantity Shortage')?'Shortage':status.includes('Damaged')?'Damaged':status.includes('Non-Compliant')?'Rejected / Non-Compliant':'Other';
const flagged=(status:string)=>status.includes('Issue Flagged')||status.includes('Non-Compliant');

async function report(env:Env,user:User,data:Data,allDepartments:boolean){
  const orders=data.orders.filter(o=>allDepartments||permitted(user,o.department));
  const poIds=new Set(orders.map(o=>String(o.id)));
  const departments=new Map<string,{department:string,paid:number,paidOrders:number}>();
  const paidOrderIds=new Map<string,Set<string>>();
  for(const pay of data.payments){
    if(pay.status!=='Paid'||!poIds.has(String(pay.poId)))continue;
    const po=orders.find(o=>o.id===pay.poId);
    if(!po)continue;
    const dept=String(po.department||pay.department||'Unassigned');
    const old=departments.get(dept)||{department:dept,paid:0,paidOrders:0};
    old.paid+=n(pay.paymentAmount??pay.totalAmount??po.totalCost);
    const ids=paidOrderIds.get(dept)||new Set<string>();ids.add(String(po.id));paidOrderIds.set(dept,ids);
    old.paidOrders=ids.size;
    departments.set(dept,old);
  }
  const paidByDepartment=[...departments.values()].map(d=>({...d,paid:round2(d.paid)})).sort((a,b)=>b.paid-a.paid);
  const bySupplier=new Map<string,{supplier:string,orders:number,verifiedDeliveries:number,inspectedDeliveries:number,onTime:number,datedDeliveries:number,discrepancies:number,ratingCount:number,ratingSum:number}>();
  for(const po of orders){
    const key=String(po.supplierId||po.supplierName||'Unknown');
    const v=bySupplier.get(key)||{supplier:String(po.supplierName||'Unknown'),orders:0,verifiedDeliveries:0,inspectedDeliveries:0,onTime:0,datedDeliveries:0,discrepancies:0,ratingCount:0,ratingSum:0};
    v.orders++;
    for(const d of data.deliveries.filter(d=>d.poId===po.id)){
      if(d.complianceStatus==='Completed - Verified')v.verifiedDeliveries++;
      if(d.complianceStatus!=='Pending Inspection')v.inspectedDeliveries++;
      if(flagged(String(d.complianceStatus||'')))v.discrepancies++;
      if(Number.isFinite(when(d.expectedDate))&&Number.isFinite(when(d.actualDate))){v.datedDeliveries++;if(when(d.actualDate)<=when(d.expectedDate))v.onTime++;}
    }
    bySupplier.set(key,v);
  }
  for(const rating of data.ratings){
    const key=String(rating.supplierId||'');
    const v=bySupplier.get(key);
    if(v&&n(rating.rating)>=1&&n(rating.rating)<=5){v.ratingCount++;v.ratingSum+=n(rating.rating);}
  }
  const supplierPerformance=[...bySupplier.values()].map(({ratingSum,...v})=>({...v,
    averageRating:v.ratingCount?round2(ratingSum/v.ratingCount):null,
    onTimeRate:v.datedDeliveries?round2(100*v.onTime/v.datedDeliveries):null,
    verificationRate:v.inspectedDeliveries?round2(100*v.verifiedDeliveries/v.inspectedDeliveries):null
  })).sort((a,b)=>b.orders-a.orders);
  const leadTime=orders.map(po=>{
    const pr=data.requisitions.find(pr=>pr.id===po.prId);
    const verified=data.deliveries.filter(d=>d.poId===po.id&&d.complianceStatus==='Completed - Verified');
    const lastVerified=verified.length?verified.map(d=>d.actualDate).filter(x=>Number.isFinite(when(x))).sort().at(-1):null;
    return {poId:String(po.id),prId:String(po.prId||''),department:String(po.department||''),itemTitle:String(po.itemTitle||''),supplier:String(po.supplierName||''),
      prToPoDays:pr?daysBetween(pr.createdAt,po.poDate):null,
      prToVerifiedDays:pr&&lastVerified?daysBetween(pr.createdAt,lastVerified):null};
  });
  const valid=leadTime.map(v=>v.prToPoDays).filter((v):v is number=>v!==null);
  return {paidByDepartment,supplierPerformance,leadTime,
    summary:{totalPaid:round2(paidByDepartment.reduce((s,d)=>s+d.paid,0)),paidOrders:new Set([...paidOrderIds.values()].flatMap(ids=>[...ids])).size,
      supplierCount:supplierPerformance.length,averagePrToPoDays:valid.length?round2(valid.reduce((a,b)=>a+b,0)/valid.length):null}};
}

/** Synchronizes only inspection-derived issues; no change to delivery records. */
async function ensureDiscrepancies(env:Env,data:Data){
  const existing=(await env.DB.prepare('SELECT delivery_id,status FROM delivery_discrepancies').all<{delivery_id:string,status:string}>()).results;
  const seen=new Map(existing.map(x=>[x.delivery_id,x.status]));
  const changes:D1PreparedStatement[]=[];
  for(const d of data.deliveries){
    const id=String(d.id||'');if(!id)continue;
    const status=String(d.complianceStatus||'');
    if(flagged(status)&&!seen.has(id)){
      const po=data.orders.find(p=>p.id===d.poId);
      const affected=category(status)==='Shortage'?Math.max(0,Math.floor(n(d.orderedQty||po?.quantity)-n(d.deliveredQty))):Math.max(0,Math.floor(n(d.deliveredQty)));
      changes.push(env.DB.prepare(`INSERT OR IGNORE INTO delivery_discrepancies
        (delivery_id,po_id,supplier_name,department,item_title,category,affected_qty,reported_at)
        VALUES(?,?,?,?,?,?,?,?)`).bind(id,String(d.poId||''),String(d.supplierName||po?.supplierName||''),String(d.department||po?.department||''),String(d.itemTitle||po?.itemTitle||''),category(status),affected,String(d.updatedAt||new Date().toISOString())));
    } else if(flagged(status)&&seen.get(id)==='Resolved'){
      // Reopening a previously resolved delivery issue requires a new progress review.
      changes.push(env.DB.prepare("UPDATE delivery_discrepancies SET status='Open',updated_at=? WHERE delivery_id=? AND status='Resolved'")
        .bind(new Date().toISOString(),id));
      changes.push(env.DB.prepare('INSERT INTO delivery_discrepancy_events(id,delivery_id,event_type,message,recorded_at) VALUES(?,?,?,?,?)')
        .bind(crypto.randomUUID(),id,'Reopened','Inspection reported another discrepancy after resolution',new Date().toISOString()));
    }
  }
  if(changes.length)await env.DB.batch(changes);
}
function visibleDiscrepancy(u:User,row:Rec){return u.role==='guest'?Boolean(clean(u.company_name))&&same(row.supplier_name,u.company_name):permitted(u,row.department);}

/** Reconciles inventory receipts against authoritative verified delivery state.
 * Unverified deliveries never enter active stock. If reinspection revokes
 * verification, a negative movement is recorded and active stock is reversed.
 */
async function ensureInventory(env:Env,data:Data){
  const receipts=(await env.DB.prepare('SELECT * FROM verified_inventory_receipts').all<Rec>()).results;
  const previous=new Map(receipts.map(r=>[String(r.delivery_id),r]));
  const incoming=new Map(data.deliveries.map(d=>[String(d.id),d]));
  const changes:D1PreparedStatement[]=[];
  const now=new Date().toISOString();
  function movement(dId:string,poId:string,dept:string,item:string,type:'Received'|'Reversed'|'Corrected',qty:number,note:string,key:string){
    // Deterministic event IDs keep parallel reconciliations from duplicating movements.
    changes.push(env.DB.prepare(`INSERT OR IGNORE INTO verified_inventory_movements(id,delivery_id,po_id,department,item_title,movement_type,quantity_delta,notes,recorded_at) VALUES(?,?,?,?,?,?,?,?,?)`)
      .bind(key,dId,poId,dept,item,type,qty,note,now));
  }
  for(const d of data.deliveries){
    const id=String(d.id||'');if(!id)continue;
    const po=data.orders.find(p=>p.id===d.poId);
    // Service, software, leases, works and subscriptions are verified for payment but never physical warehouse stock.
    const physical=!po?.purchaseCategory||['Goods & Materials','Equipment & Capital Assets'].includes(String(po.purchaseCategory));
    const eligible=d.complianceStatus==='Completed - Verified'&&po&&physical&&Number.isInteger(Number(d.deliveredQty))&&n(d.deliveredQty)>0;
    const old=previous.get(id);
    if(!eligible){
      if(old&&Number(old.active)===1){
        changes.push(env.DB.prepare("UPDATE verified_inventory_receipts SET active=0,updated_at=? WHERE delivery_id=? AND active=1").bind(now,id));
        movement(id,String(old.po_id),String(old.department),String(old.item_title),'Reversed',-Number(old.quantity),'Verification removed or receipt became invalid',`${id}:reversed:${old.updated_at}:${old.quantity}`);
      }
      continue;
    }
    const quantity=n(d.deliveredQty),dept=String(d.department||po?.department||''),item=String(d.itemTitle||po?.itemTitle||''),poId=String(d.poId),supplier=String(d.supplierName||po?.supplierName||''),specs=String(d.specs||po?.specs||'');
    if(!old){
      changes.push(env.DB.prepare(`INSERT OR IGNORE INTO verified_inventory_receipts(delivery_id,po_id,department,supplier_name,item_title,specifications,quantity,active,first_received_at,updated_at) VALUES(?,?,?,?,?,?,?,1,?,?)`).bind(id,poId,dept,supplier,item,specs,quantity,String(d.updatedAt||now),now));
      movement(id,poId,dept,item,'Received',quantity,'Verified delivery credited into received stock',`${id}:first-receipt`);
    }else if(Number(old.active)!==1||n(old.quantity)!==quantity||String(old.item_title)!==item||String(old.department)!==dept||String(old.specifications)!==specs){
      const wasActive=Number(old.active)===1;
      const sameBin=String(old.item_title)===item&&String(old.department)===dept&&String(old.specifications)===specs;
      if(wasActive&&!sameBin)movement(id,String(old.po_id),String(old.department),String(old.item_title),'Reversed',-n(old.quantity),'Reclassified after inspection correction',`${id}:reclass-reverse:${old.updated_at}:${old.quantity}`);
      const delta=wasActive&&sameBin?quantity-n(old.quantity):quantity;
      if(delta!==0)movement(id,poId,dept,item,wasActive&&sameBin?'Corrected':'Received',delta,'Receipt restored or quantity corrected',`${id}:adjust:${old.updated_at}:${quantity}:${dept}:${item}:${specs}`);
      changes.push(env.DB.prepare(`UPDATE verified_inventory_receipts SET po_id=?,department=?,supplier_name=?,item_title=?,specifications=?,quantity=?,active=1,updated_at=? WHERE delivery_id=?`)
        .bind(poId,dept,supplier,item,specs,quantity,now,id));
    }
  }
  // Protect against removed deliveries / legacy workspace reset.
  for(const old of receipts){
    const id=String(old.delivery_id);
    if(!incoming.has(id)&&Number(old.active)===1){
      changes.push(env.DB.prepare('UPDATE verified_inventory_receipts SET active=0,updated_at=? WHERE delivery_id=?').bind(now,id));
      movement(id,String(old.po_id),String(old.department),String(old.item_title),'Reversed',-n(old.quantity),'Source delivery no longer present',`${id}:removed:${old.updated_at}:${old.quantity}`);
    }
  }
  // D1 batches execute transactionally; each delivery is credited only once.
  if(changes.length)await env.DB.batch(changes);
}

export async function handleOperationsRoutes(request:Request,env:Env,user:User,cors:HeadersInit):Promise<Response|null>{
  const url=new URL(request.url);const path=url.pathname;
  if(!path.startsWith('/operations/'))return null;
  if(!isStaff(user)&&user.role!=='guest')return json({error:'Not authorized.'},403,cors);
  if(path==='/operations/company-setup'){
    if(request.method==='GET'){
      if(!isStaff(user))return json({error:'Staff access required.'},403,cors);
      const row=await env.DB.prepare('SELECT setup_id,annual_budget_cents,setup_config,updated_at FROM company_setup_state WHERE id=1')
        .first<{setup_id:string;annual_budget_cents:number;setup_config:string;updated_at:string}>();
      return json({activeSetup:row?{
        setupId:row.setup_id,annualBudget:Number(row.annual_budget_cents)/100,
        setupConfig:JSON.parse(row.setup_config),updatedAt:row.updated_at
      }:null},200,cors);
    }
    if(request.method==='PUT'){
      if(user.role!=='admin')return json({error:'Only Admin can apply a complete company setup.'},403,cors);
      const body=await request.json() as Rec;
      const setup=body?.setup as Rec;
      const setupId=clean(setup?.setupId,30);
      const companyName=clean(setup?.companyName,100);
      const industry=clean(setup?.industry,30);
      const annualBudgetPHP=Number(setup?.annualBudgetPHP);
      const annualBudgetCents=cents(annualBudgetPHP);
      const priorities=Array.isArray(setup?.priorities)?setup.priorities as Rec[]:[];
      const departments=Array.isArray(setup?.departments)?setup.departments as Rec[]:[];
      const approvals=setup?.approvals as Rec;
      const financeFrom=cents(approvals?.financeFrom);
      const financeHeadFrom=cents(approvals?.financeHeadFrom);
      const adminFrom=cents(approvals?.adminFrom);
      const invalidPercentages=departments.reduce((total,item)=>total+(Number.isFinite(Number(item?.budgetPercent))?Number(item.budgetPercent):NaN),0);
      const departmentNames=departments.map(item=>clean(item?.name,80).toLowerCase());
      const validDepartment=(item:Rec)=>clean(item?.name,80).length>0&&clean(item?.purpose,300).length>=3&&
        Number.isFinite(Number(item?.budgetPercent))&&Number(item.budgetPercent)>=0&&Number(item.budgetPercent)<=100;
      const requiredDepartments=['operations','procurement','finance & accounting','executive'];
      if(!companySetupIds.has(setupId)||industry!==setupId||companyName.length<2||
        !Number.isSafeInteger(annualBudgetCents)||annualBudgetCents<=0||
        priorities.length!==3||priorities.some((item,index)=>item?.code!==materialCodes[index]||
          clean(item?.name,80).length<2||clean(item?.description,300).length<3)||
        departments.length<requiredDepartments.length||departments.length>30||departments.some(item=>!validDepartment(item))||
        new Set(departmentNames).size!==departmentNames.length||
        requiredDepartments.some(name=>!departmentNames.includes(name))||
        !Number.isFinite(invalidPercentages)||Math.abs(invalidPercentages-100)>0.01||
        ![financeFrom,financeHeadFrom,adminFrom].every(Number.isSafeInteger)||financeHeadFrom<financeFrom){
        return json({error:'The company setup is incomplete. Check the company, A/B/C priorities, unique departments, 100% budget split, annual budget, and approval thresholds.'},400,cors);
      }
      const [directory,budgetRows,previousConfig,previousState,previousRules,data]=await Promise.all([
        env.DB.prepare('SELECT name FROM organization_departments ORDER BY name').all<{name:string}>(),
        env.DB.prepare('SELECT department,allocated_cents FROM department_budgets ORDER BY department').all<{department:string;allocated_cents:number}>(),
        env.DB.prepare('SELECT config FROM operations_material_configuration WHERE id=1').first<{config:string}>(),
        env.DB.prepare('SELECT setup_id,annual_budget_cents,updated_at FROM company_setup_state WHERE id=1').first<{setup_id:string;annual_budget_cents:number;updated_at:string}>(),
        env.DB.prepare('SELECT finance_from_cents,finance_head_from_cents,admin_from_cents FROM finance_rules WHERE id=1').first<Rec>(),
        state(env)
      ]);
      const normalizedDepartments=departments.map(item=>({
        name:clean(item.name,80).replace(/\s+/g,' '),
        purpose:clean(item.purpose,300),
        budgetPercent:Number(item.budgetPercent)
      }));
      let allocationsSoFar=0;
      const allocations=normalizedDepartments.map((department,index,all)=>{
        const existingBudget=budgetRows.results.find(row=>same(row.department,department.name));
        const existingDirectory=directory.results.find(row=>same(row.name,department.name));
        const name=existingBudget?.department??existingDirectory?.name??department.name;
        const allocatedCents=index===all.length-1
          ?annualBudgetCents-allocationsSoFar
          :Math.round(annualBudgetCents*department.budgetPercent/100);
        allocationsSoFar+=allocatedCents;
        return {name,allocatedCents,percent:department.budgetPercent};
      });
      const invalidBudget=allocations.find(allocation=>{
        const {committedCents,spentCents}=departmentUsage(data,allocation.name);
        return allocation.allocatedCents<committedCents+spentCents;
      });
      if(invalidBudget){
        const {committedCents,spentCents}=departmentUsage(data,invalidBudget.name);
        return json({error:`The proposed ${invalidBudget.name} allocation is below its existing committed and spent total of ₱${((committedCents+spentCents)/100).toLocaleString('en-PH',{minimumFractionDigits:2})}. Increase the annual budget or edit the department split before applying.`},409,cors);
      }
      const normalizedConfig={
        companyName,industry,activeSetupId:setupId,
        priorities:priorities.map(item=>({code:item.code,name:clean(item.name,80),description:clean(item.description,300)}))
      };
      const normalizedSetup={
        setupId,industry,companyName,priorities:normalizedConfig.priorities,
        departments:normalizedDepartments,annualBudgetPHP,
        approvals:{
          financeFrom:financeFrom/100,financeHeadFrom:financeHeadFrom/100,adminFrom:adminFrom/100
        }
      };
      const normalizedApprovals={
        financeFrom:financeFrom/100,financeHeadFrom:financeHeadFrom/100,adminFrom:adminFrom/100
      };
      const now=new Date().toISOString();
      const statements:D1PreparedStatement[]=[];
      for(const allocation of allocations){
        if(!directory.results.some(row=>same(row.name,allocation.name)))
          statements.push(env.DB.prepare('INSERT OR IGNORE INTO organization_departments(name) VALUES(?)').bind(allocation.name));
        statements.push(env.DB.prepare(`INSERT INTO department_budgets(department,allocated_cents,updated_by)
          VALUES(?,?,?) ON CONFLICT(department) DO UPDATE SET allocated_cents=excluded.allocated_cents,
          updated_by=excluded.updated_by,updated_at=datetime('now')`)
          .bind(allocation.name,allocation.allocatedCents,user.id));
        const before=budgetRows.results.find(row=>same(row.department,allocation.name));
        statements.push(evidenceStatement(env,user,'department_budgets',allocation.name,'Company setup applied',
          before?{department:before.department,allocated:Number(before.allocated_cents)/100}:null,
          {department:allocation.name,allocated:allocation.allocatedCents/100,budgetPercent:allocation.percent}));
      }
      statements.push(
        env.DB.prepare(`INSERT INTO finance_rules(id,finance_from_cents,admin_from_cents,finance_head_from_cents)
          VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET finance_from_cents=excluded.finance_from_cents,
          admin_from_cents=excluded.admin_from_cents,finance_head_from_cents=excluded.finance_head_from_cents,
          updated_at=datetime('now')`).bind(financeFrom,adminFrom,financeHeadFrom),
        env.DB.prepare(`INSERT INTO operations_material_configuration(id,config,updated_by,updated_at)
          VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET config=excluded.config,updated_by=excluded.updated_by,
          updated_at=excluded.updated_at`).bind(JSON.stringify(normalizedConfig),user.id,now),
        env.DB.prepare(`INSERT INTO company_setup_state(id,setup_id,annual_budget_cents,setup_config,updated_by,updated_at)
          VALUES(1,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET setup_id=excluded.setup_id,
          annual_budget_cents=excluded.annual_budget_cents,setup_config=excluded.setup_config,
          updated_by=excluded.updated_by,updated_at=excluded.updated_at`)
          .bind(setupId,annualBudgetCents,JSON.stringify(normalizedSetup),user.id,now),
        evidenceStatement(env,user,'finance_rules','company-setup','Approval thresholds configured',
          previousRules?{
            financeFrom:Number(previousRules.finance_from_cents)/100,
            financeHeadFrom:Number(previousRules.finance_head_from_cents)/100,
            adminFrom:Number(previousRules.admin_from_cents)/100
          }:null,normalizedApprovals),
        evidenceStatement(env,user,'operations_material_configuration','company-profile','Company setup applied',
          previousConfig?JSON.parse(previousConfig.config):null,normalizedConfig),
        evidenceStatement(env,user,'company_setup_state','active-setup','Activated',
          previousState?{setupId:previousState.setup_id,annualBudget:Number(previousState.annual_budget_cents)/100}:null,
          {setupId,annualBudget:annualBudgetPHP,departments:allocations.length})
      );
      await env.DB.batch(statements);
      const untouchedBudgets=budgetRows.results.filter(row=>!allocations.some(item=>same(item.name,row.department))).map(row=>row.department);
      return json({ok:true,activeSetup:{setupId,annualBudget:annualBudgetPHP,updatedAt:now},untouchedBudgets},200,cors);
    }
    return json({error:'Method not allowed.'},405,cors);
  }
  if(path==='/operations/material-configuration'){
    if(!isStaff(user))return json({error:'Staff access required.'},403,cors);
    if(request.method==='GET'){
      const row=await env.DB.prepare('SELECT config,updated_at FROM operations_material_configuration WHERE id=1').first<{config:string;updated_at:string}>();
      return json({config:row?JSON.parse(row.config):null,updatedAt:row?.updated_at??null},200,cors);
    }
    if(request.method==='PUT'){
      if(!canManageMaterialConfig(user))return json({error:'Only Admin or Operations can update material configuration.'},403,cors);
      const body=await request.json() as Rec;
      const config=body?.config as Rec;
      const companyName=clean(config?.companyName,100);
      const industry=clean(config?.industry,30);
      const classes=Array.isArray(config?.priorities)?config.priorities as Rec[]:[];
      if(companyName.length<2||!validIndustries.includes(industry)||classes.length!==3||
        classes.some((item,index)=>item?.code!==materialCodes[index]||clean(item?.name,80).length<2||clean(item?.description,300).length<3))
        return json({error:'Provide a company name, supported company type, and complete A/B/C material definitions.'},400,cors);
      const normalized={companyName,industry,activeSetupId:null,priorities:classes.map(item=>({
        code:item.code,name:clean(item.name,80),description:clean(item.description,300)
      }))};
      const previous=await env.DB.prepare('SELECT config FROM operations_material_configuration WHERE id=1').first<{config:string}>();
      const now=new Date().toISOString();
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO operations_material_configuration (id,config,updated_by,updated_at) VALUES (1,?,?,?)
          ON CONFLICT(id) DO UPDATE SET config=excluded.config,updated_by=excluded.updated_by,updated_at=excluded.updated_at`)
          .bind(JSON.stringify(normalized),user.id,now),
        env.DB.prepare("UPDATE company_setup_state SET setup_id='custom',updated_by=?,updated_at=? WHERE id=1")
          .bind(user.id,now),
        evidenceStatement(env,user,'operations_material_configuration','company-profile','Updated',
          previous?JSON.parse(previous.config):null,normalized)
      ]);
      return json({ok:true,config:normalized,updatedAt:now},200,cors);
    }
    return json({error:'Method not allowed.'},405,cors);
  }
  const data=await state(env);
  if(path==='/operations/reports'&&request.method==='GET'){
    if(!isStaff(user))return json({error:'Staff only.'},403,cors);
    return json(await report(env,user,data,await mayReportAcrossDepartments(env,user)),200,cors);
  }
  if(path==='/operations/discrepancies'&&request.method==='GET'){
    await ensureDiscrepancies(env,data);
    const rows=(await env.DB.prepare('SELECT * FROM delivery_discrepancies ORDER BY updated_at DESC,delivery_id').all<Rec>()).results;
    return json({discrepancies:rows.filter(row=>visibleDiscrepancy(user,row)).map(row=>{
      const delivery=data.deliveries.find(d=>d.id===row.delivery_id);
      return {...row,inspectionStatus:String(delivery?.complianceStatus||'Record unavailable'),inspectionRemarks:String(delivery?.remarks||''),actualDate:String(delivery?.actualDate||''),isVerified:delivery?.complianceStatus==='Completed - Verified'};
    })},200,cors);
  }
  const detail=path.match(/^\/operations\/discrepancies\/([^/]+)\/events$/);
  if(detail&&request.method==='GET'){
    const id=decodeURIComponent(detail[1]);
    const row=await env.DB.prepare('SELECT * FROM delivery_discrepancies WHERE delivery_id=?').bind(id).first<Rec>();
    if(!row||!visibleDiscrepancy(user,row))return json({error:'Not found.'},404,cors);
    const events=(await env.DB.prepare('SELECT * FROM delivery_discrepancy_events WHERE delivery_id=? ORDER BY recorded_at DESC LIMIT 100').bind(id).all<Rec>()).results;
    return json({events},200,cors);
  }
  const update=path.match(/^\/operations\/discrepancies\/([^/]+)$/);
  if(update&&request.method==='PATCH'){
    if(!isManager(user))return json({error:'Only Admin or authorized Procurement staff can update resolution progress.'},403,cors);
    const id=decodeURIComponent(update[1]);
    const row=await env.DB.prepare('SELECT * FROM delivery_discrepancies WHERE delivery_id=?').bind(id).first<Rec>();
    if(!row)return json({error:'Discrepancy not found.'},404,cors);
    const body=await request.json() as Rec;
    const statuses=['Open','Investigating','Awaiting Supplier','Replacement In Transit','Resolved'];
    const status=clean(body.status,60),notes=clean(body.resolutionNotes,1500);
    if(!statuses.includes(status)||!notes)return json({error:'Select a status and enter resolution notes.'},400,cors);
    const delivery=data.deliveries.find(d=>d.id===id);
    if(status==='Resolved'&&delivery?.complianceStatus!=='Completed - Verified')
      return json({error:'Final resolution requires Completed - Verified inspection. Re-inspect the corrected delivery first.'},409,cors);
    const now=new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare('UPDATE delivery_discrepancies SET status=?,resolution_notes=?,updated_by=?,updated_at=? WHERE delivery_id=?')
        .bind(status,notes,user.id,now,id),
      env.DB.prepare('INSERT INTO delivery_discrepancy_events(id,delivery_id,event_type,message,actor_id,recorded_at) VALUES(?,?,?,?,?,?)')
        .bind(crypto.randomUUID(),id,status,notes,user.id,now)
    ]);
    return json({ok:true},200,cors);
  }
  if(path==='/operations/inventory'&&request.method==='GET'){
    if(!isStaff(user))return json({error:'Staff only.'},403,cors);
    // Reconciliation uses all deliveries so department-specific viewers do not
    // accidentally omit stock or cause reversals for other departments.
    await ensureInventory(env,data);
    const receipts=(await env.DB.prepare('SELECT * FROM verified_inventory_receipts WHERE active=1 ORDER BY department,item_title').all<Rec>()).results
      .filter(r=>permitted(user,r.department));
    // Unit is sourced from the order/delivery in the shared procurement snapshot.
    // Keep the existing D1 inventory tables intact. Never add kg, pcs, etc.
    // together into one stock bin or metric.
    const orderUnits=new Map(data.orders.map(order=>[String(order.id),clean(order.unit,30)||'units']));
    const deliveryUnits=new Map(data.deliveries.map(delivery=>[
      String(delivery.id),clean(delivery.unit,30)||orderUnits.get(String(delivery.poId))||'units'
    ]));
    const unitFor=(row:Rec)=>deliveryUnits.get(String(row.delivery_id))||orderUnits.get(String(row.po_id))||'units';
    const receiptsWithUnits:Rec[]=receipts.map(row=>({...row,unit:unitFor(row)}));
    const bins=new Map<string,{department:string;itemTitle:string;specifications:string;unit:string;quantity:number;receiptCount:number}>();
    for(const r of receiptsWithUnits){
      const key=JSON.stringify([r.department,r.item_title,r.specifications,r.unit]);
      const a=bins.get(key)||{department:String(r.department),itemTitle:String(r.item_title),specifications:String(r.specifications),unit:r.unit,quantity:0,receiptCount:0};
      a.quantity+=n(r.quantity);a.receiptCount++;bins.set(key,a);
    }
    const history=(await env.DB.prepare('SELECT * FROM verified_inventory_movements ORDER BY recorded_at DESC LIMIT 2000').all<Rec>()).results
      .filter(h=>permitted(user,h.department)).map(h=>({...h,unit:unitFor(h)}));
    return json({stock:[...bins.values()].sort((a,b)=>a.department.localeCompare(b.department)||a.itemTitle.localeCompare(b.itemTitle)||a.unit.localeCompare(b.unit)),receipts:receiptsWithUnits,history},200,cors);
  }
  if(path==='/operations/inventory/sync'&&request.method==='POST'){
    if(!isStaff(user))return json({error:'Staff only.'},403,cors);
    await ensureInventory(env,data);
    return json({ok:true},200,cors);
  }
  return json({error:'Unknown operations route.'},404,cors);
}
