/** Opt-in, dedicated training workspace. Not a multi-tenant production database.
 * Every business and legal-document record created here is fictional.
 */
import type { D1Database, D1PreparedStatement, KVNamespace } from '@cloudflare/workers-types';
import { DEMO_PRESETS, type DemoIndustry, type DemoSupplier } from '../../src/data/demoPresets';
import { COMPANY_SETUP_TEMPLATES } from '../../src/domain/companySetup';
import { configFromIndustry } from '../../src/domain/companyMaterialConfig';
import { DEMO_PASSWORD_HASH } from './demoPasswordHash';

type Env={DB:D1Database;DOCUMENTS:KVNamespace;ENABLE_DEMO_PRESETS?:string};
type User={id:string;name:string;role:string;app_role:string;company_name:string};
type R=Record<string,unknown>;
const reply=(value:unknown,status:number,cors:HeadersInit)=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const supplierOffersMaterial=(supplier:DemoSupplier,sku:string)=>!supplier.offeredMaterialSkus||supplier.offeredMaterialSkus.includes(sku);
const cols=['stockNeeds','bids','proposalMeetings','requisitions','orders','deliveries','amendments','payments','suppliers','ratings','auditLogs'] as const;
const money=(n:number)=>Math.round(n*100);
const emailFor=(username:string)=>`${username}@training.invalid`;
function pdfBytes(company:string,category:string):Uint8Array {
  // Valid minimal PDF served as a sample, without impersonating a real agency.
  const line=(text:string)=>text.replace(/[^\x20-\x7e]/g,' ').replace(/[\\()]/g,' ');
  const stream=`BT /F1 16 Tf 42 755 Td (${line('SAMPLE - NOT A LEGAL DOCUMENT')}) Tj /F1 11 Tf 0 -40 Td (${line(company)}) Tj 0 -26 Td (${line(category)}) Tj 0 -34 Td (FICTIONAL TRAINING DATA ONLY) Tj 0 -20 Td (No agency issued this file. Not proof of compliance.) Tj 0 -20 Td (Replace with authentic permits and certificates before real bidding.) Tj ET`;
  const objs=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  ];
  let pdf='%PDF-1.4\n'; const offsets=[0];
  for(let i=0;i<objs.length;i++){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${objs[i]}\nendobj\n`;}
  const xref=pdf.length;pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;
  for(const off of offsets.slice(1))pdf+=`${String(off).padStart(10,'0')} 00000 n \n`;
  pdf+=`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
function stockState(scenarioId:DemoIndustry,username:string){
  const preset=DEMO_PRESETS[scenarioId],key=`ORG-${scenarioId.toUpperCase()}`;
  const supplierId=(index:number)=>`demo-supplier-${scenarioId}-${index+1}`;
  const quotePrice=(material:DemoMaterial,materialIndex:number,supplierIndex:number)=>
    Math.max(1,Math.round(material.unitPrice*(1+(supplierIndex-2.5)*.025+((materialIndex%3)-1)*.008)));
  const date=(days:number)=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);
  const stamp=new Date().toISOString().slice(0,16).replace('T',' ');
  const critical=preset.materials.find(row=>row.priority==='A'&&row.onHand<row.reorderPoint)!;
  const routine=preset.materials.find(row=>row.priority==='B')!;
  const support=preset.materials.find(row=>row.priority==='C')!;
  const pr={id:`${key}-PR-01`,department:'Operations',itemTitle:critical.name,specs:critical.specs,targetDate:date(14),
    unitPrice:critical.unitPrice,quantity:critical.targetQty,unit:critical.unit,totalCost:critical.targetQty*critical.unitPrice,
    priority:'A',status:'Approved',requestedBy:'Operations Officer',requestedByUsername:`${scenarioId.slice(0,4)}.01.officer`,
    purchaseCategory:'Goods & Materials',createdAt:stamp,
    remarks:`Urgent replenishment for ${critical.name}. On hand ${critical.onHand} ${critical.unit} is below the reorder point of ${critical.reorderPoint}; request ${critical.targetQty} ${critical.unit} for the next production cycle.`};
  const pending={id:`${key}-PR-03`,department:'Operations',itemTitle:support.name,specs:support.specs,targetDate:date(21),
    unitPrice:support.unitPrice,quantity:support.targetQty,unit:support.unit,totalCost:support.targetQty*support.unitPrice,
    priority:'C',status:'Pending',requestedBy:'Operations Officer',requestedByUsername:`${scenarioId.slice(0,4)}.01.officer`,
    purchaseCategory:'Goods & Materials',createdAt:stamp,
    remarks:`Routine replenishment of ${support.name}; stock is ${support.onHand} ${support.unit}, reorder point is ${support.reorderPoint}. Awaiting department approval.`};
  // Fulfilled B-priority example, useful for inspection and finance demonstrations.
  const delivered={id:`${key}-PR-02`,department:'Operations',itemTitle:routine.name,specs:routine.specs,targetDate:date(-5),
    unitPrice:routine.unitPrice,quantity:Math.max(10,Math.round(routine.targetQty/3)),unit:routine.unit,
    totalCost:Math.max(10,Math.round(routine.targetQty/3))*routine.unitPrice,
    priority:'B',status:'Completed',requestedBy:'Operations Head',requestedByUsername:`${scenarioId.slice(0,4)}.01.head`,
    purchaseCategory:'Goods & Materials',createdAt:stamp,
    remarks:`Completed replenishment of ${routine.name}; purchase order, receipt inspection, invoice matching and payment are recorded.`};
  const requisitions=[pr,delivered,pending];
  const requisitionBySku=new Map([[critical.sku,pr],[routine.sku,delivered],[support.sku,pending]]);
  const coreSkus=new Set([critical.sku,routine.sku,support.sku]);
  const additionalMaterials=preset.materials.filter(material=>!coreSkus.has(material.sku));
  const additionalStatuses=['Approved','Pending','Rejected','Approved'] as const;
  for(let i=0;i<additionalMaterials.length;i++){
    const material=additionalMaterials[i],status=additionalStatuses[i%additionalStatuses.length];
    const quantity=Math.max(1,Math.round(material.targetQty*(i%3===0?.5:i%3===1?.75:1)));
    const request={id:`${key}-PR-${String(i+4).padStart(2,'0')}`,department:'Operations',itemTitle:material.name,specs:material.specs,
      targetDate:date(7+(i%4)*7),unitPrice:material.unitPrice,quantity,unit:material.unit,totalCost:quantity*material.unitPrice,
      priority:material.priority,status,requestedBy:i%2?'Operations Head':'Operations Officer',
      requestedByUsername:`${scenarioId.slice(0,4)}.01.${i%2?'head':'officer'}`,
      purchaseCategory:'Goods & Materials',createdAt:stamp,
      remarks:`${material.priority}-priority request for ${quantity} ${material.unit} of ${material.name}. Stock is ${material.onHand} ${material.unit}; reorder point ${material.reorderPoint}; target stock ${material.targetQty}. ${status==='Rejected'?'Returned for revised quantity and supporting usage forecast.':status==='Pending'?'Awaiting department and procurement review.':'Technical specification and receiving checks are required before award.'}`};
    requisitions.push(request);
    requisitionBySku.set(material.sku,request);
  }
  const needForMaterial=new Map(preset.materials.map((material,index)=>[material.sku,{
    id:`${key}-NEED-${String(index+1).padStart(2,'0')}`,prId:requisitionBySku.get(material.sku)!.id,
    title:material.name,targetQty:material.targetQty,budgetCap:Math.round(material.targetQty*material.unitPrice*1.2),
    techSpecs:`${material.specs}; inventory on hand ${material.onHand} ${material.unit}; reorder at ${material.reorderPoint}; target ${material.targetQty}.`,
    status:'Published',priority:material.priority,createdBy:username,createdAt:stamp
  }]));
  const stockNeeds=[...needForMaterial.values()];
  const routineSupplierIndex=preset.suppliers.findIndex(s=>supplierOffersMaterial(s,routine.sku));
  if(routineSupplierIndex<0)throw new Error(`No supplier is configured to offer ${routine.name}.`);
  const routinePrice=quotePrice(routine,preset.materials.indexOf(routine),routineSupplierIndex);
  const po={id:`${key}-PO-01`,prId:delivered.id,supplierId:supplierId(routineSupplierIndex),supplierName:preset.suppliers[routineSupplierIndex].name,department:'Operations',
    itemTitle:routine.name,specs:routine.specs,quantity:delivered.quantity,unit:routine.unit,unitPrice:routinePrice,totalCost:delivered.quantity*routinePrice,
    poDate:date(-12),status:'Issued',type:'Purchase Order',createdByName:'Procurement Head'};
  const criticalPrice=quotePrice(critical,preset.materials.indexOf(critical),0);
  const activePo={id:`${key}-PO-02`,prId:pr.id,supplierId:supplierId(0),supplierName:preset.suppliers[0].name,department:'Operations',
    itemTitle:critical.name,specs:critical.specs,quantity:critical.targetQty,unit:critical.unit,unitPrice:criticalPrice,totalCost:critical.targetQty*criticalPrice,
    poDate:date(-2),expectedDate:date(5),status:'Issued',type:'Purchase Order',createdByName:'Procurement Head',
    priority:'A',purchaseCategory:'Goods & Materials'};
  const approvedMaterials=preset.materials.filter(material=>!coreSkus.has(material.sku)&&requisitionBySku.get(material.sku)?.status==='Approved');
  const additionalOrders=[];
  const additionalDeliveries=[];
  const additionalPayments=[];
  for(let i=0;i<preset.suppliers.length-1;i++){
    const material=approvedMaterials[i];
    if(!material)break;
    const requisition=requisitionBySku.get(material.sku)!;
    const materialIndex=preset.materials.indexOf(material);
    const eligibleSupplierIndexes=preset.suppliers.map((candidate,index)=>supplierOffersMaterial(candidate,material.sku)?index:-1).filter(index=>index>=0);
    const supplierIndex=eligibleSupplierIndexes.find(index=>index!==0)??eligibleSupplierIndexes[0];
    if(supplierIndex===undefined)throw new Error(`No supplier is configured to offer ${material.name}.`);
    const supplier=preset.suppliers[supplierIndex];
    const unitPrice=quotePrice(material,materialIndex,supplierIndex),quantity=Math.max(1,Math.round(material.targetQty*.4));
    const orderId=`${key}-PO-${String(i+3).padStart(2,'0')}`,deliveryId=`${key}-DEL-${String(i+3).padStart(2,'0')}`;
    const order={id:orderId,prId:requisition.id,supplierId:supplierId(supplierIndex),supplierName:supplier.name,department:'Operations',
      itemTitle:material.name,specs:material.specs,quantity,unit:material.unit,unitPrice,totalCost:quantity*unitPrice,
      poDate:date(-1-i),expectedDate:date(4+i),status:'Issued',type:'Purchase Order',createdByName:'Procurement Head',
      priority:material.priority,purchaseCategory:'Goods & Materials',
      notes:`Training order against ${requisition.id}; quotation comparison and specification checks recorded.`};
    const deliveryMode=i%3,deliveredQty=deliveryMode===0?quantity:deliveryMode===1?0:Math.max(1,Math.floor(quantity*.65));
    const deliveryStatus=deliveryMode===0?'Delivered':deliveryMode===1?'In Transit':'Partial Delivery';
    const delivery={id:deliveryId,poId:orderId,prId:requisition.id,supplierId:supplierId(supplierIndex),
      supplierName:supplier.name,department:'Operations',itemTitle:material.name,specs:material.specs,
      orderedQty:quantity,deliveredQty,unit:material.unit,expectedDate:date(4+i),
      actualDate:deliveryMode===0?date(-1):deliveryMode===2?date(0):'',
      deliveryStatus,complianceStatus:deliveryMode===0?'Completed - Verified':deliveryMode===2?'Short Delivery - Review Required':'Awaiting Receipt',
      remarks:deliveryMode===0?'Quantity and specification checks passed; receipt posted to inventory.':
        deliveryMode===2?'Partial quantity received; balance and supplier corrective action remain open.':'Shipment advice received; warehouse inspection is pending.',
      recordedBy:'Warehouse Officer',updatedAt:stamp};
    if(deliveryMode===0){
      requisition.status='Completed';
      additionalPayments.push({id:`${key}-PAY-${String(i+3).padStart(2,'0')}`,poId:orderId,supplierName:supplier.name,
        department:'Operations',totalAmount:order.totalCost,deliveryVerified:true,paymentAmount:order.totalCost,
        paymentMethod:'Bank Transfer',paymentDate:date(-1),status:'Paid',
        refNumber:`TRAIN-${scenarioId.toUpperCase()}-${String(i+1).padStart(3,'0')}`,
        remarks:'Fictional training payment; matched to an accepted receipt and supplier invoice.',processedBy:'Finance Officer'});
    }
    additionalOrders.push(order);
    additionalDeliveries.push(delivery);
  }
  const partialQty=Math.max(1,Math.floor(activePo.quantity*.75));
  const receipt={id:`${key}-DEL-01`,poId:po.id,prId:delivered.id,supplierId:supplierId(0),supplierName:preset.suppliers[0].name,department:'Operations',
    itemTitle:routine.name,specs:routine.specs,orderedQty:po.quantity,deliveredQty:po.quantity,unit:routine.unit,
    expectedDate:date(-7),actualDate:date(-7),deliveryStatus:'Delivered',complianceStatus:'Completed - Verified',
    remarks:'Training inspection: quantity and specifications accepted.',recordedBy:'Warehouse Officer',updatedAt:stamp};
  const partialReceipt={id:`${key}-DEL-02`,poId:activePo.id,prId:pr.id,supplierId:supplierId(0),supplierName:preset.suppliers[0].name,department:'Operations',
    itemTitle:critical.name,specs:critical.specs,orderedQty:activePo.quantity,deliveredQty:partialQty,unit:critical.unit,
    expectedDate:date(1),actualDate:date(1),deliveryStatus:'Partial Delivery',complianceStatus:'Short Delivery - Review Required',
    remarks:'Training case: initial shipment was short; supplier corrective action is being reviewed.',recordedBy:'Warehouse Officer',updatedAt:stamp};
  const payment={id:`${key}-PAY-01`,poId:po.id,supplierName:po.supplierName,department:'Operations',
    totalAmount:po.totalCost,deliveryVerified:true,paymentAmount:po.totalCost,paymentMethod:'Bank Transfer',
    paymentDate:date(-3),status:'Paid',refNumber:`SAMPLE-${scenarioId.toUpperCase()}-001`,
    remarks:'Training record: invoice matched to accepted delivery; no real transfer occurred.',processedBy:'Finance Officer'};
  const pendingPayment={id:`${key}-PAY-02`,poId:activePo.id,supplierName:preset.suppliers[0].name,department:'Operations',
    totalAmount:activePo.totalCost,deliveryVerified:false,paymentAmount:0,paymentMethod:'Bank Transfer',
    paymentDate:date(7),status:'Pending',refNumber:'',
    remarks:'Training record: payment is on hold until the short delivery is resolved and verified.',processedBy:'Finance Officer'};
  const bids=[];
  let bidSequence=0;
  for(const material of preset.materials){
    const need=needForMaterial.get(material.sku)!;
    for(let i=0;i<preset.suppliers.length;i++){
      const supplier=preset.suppliers[i];
      if(!supplierOffersMaterial(supplier,material.sku))continue;
      const id=`${key}-BID-${String(++bidSequence).padStart(2,'0')}`;
      const unitPrice=quotePrice(material,preset.materials.indexOf(material),i);
      const quotationTerms={version:1,offeredModel:material.name,specificationClaim:'fully-compliant',specificationExceptions:'',
        deliveryCommitment:'firm',warrantyMonths:i===0?12:6,warrantyCoverage:'limited',
        warrantyService:`${supplier.terms.warranty}; verify coverage and exclusions in the final signed agreement.`,
        replacementDays:7,paymentCondition:i%2?'after-acceptance':'advance-required',validityDays:30,
        afterSalesSupport:'included',supportingReference:`TRAIN-${scenarioId.toUpperCase()}-QUOTE-${String(bidSequence).padStart(3,'0')}`,
        additionalClauses:`Illustrative quote for ${material.name}; subject to technical compliance, stock confirmation, receiving inspection and final negotiation.`,
        supplierDeclaration:true};
      bids.push({id,needId:need.id,supplierId:supplierId(i),supplierName:supplier.name,unitPrice,
        totalCost:unitPrice*material.targetQty,leadTimeDays:supplier.terms.leadTimeDays,
        notes:`${supplier.name} quotation for ${material.name}: ${supplier.terms.leadTimeDays} day lead time; minimum order PHP ${supplier.terms.minimumOrderPHP.toLocaleString('en-PH')}; ${supplier.terms.delivery}.`,
        quotationTerms,submittedAt:stamp,status:'Submitted'});
    }
  }
  const allOrders=[po,activePo,...additionalOrders];
  for(const order of allOrders){
    const need=stockNeeds.find(row=>row.prId===order.prId);
    const selectedBid=need&&bids.find(row=>row.needId===need.id&&row.supplierId===order.supplierId);
    if(!need||!selectedBid)throw new Error(`Could not link purchase order ${order.id} to its selected supplier bid.`);
    need.status='Supplier Selected';
    need.selectedBidId=selectedBid.id;
    order.bidId=selectedBid.id;
    bids.filter(row=>row.needId===need.id).forEach(row=>{row.status=row.id===selectedBid.id?'Selected':'Not Selected';});
  }
  const proposalMeetings=[critical,routine,support].map((material,index)=>{
    const need=needForMaterial.get(material.sku)!;
    const bid=bids.find(row=>row.needId===need.id)!;
    return {id:`${key}-MEET-${String(index+1).padStart(2,'0')}`,needId:need.id,bidId:bid.id,
      supplierId:bid.supplierId,supplierName:bid.supplierName,date:date(2+index),time:['10:00','13:30','15:00'][index],
      venue:index===1?'Procurement conference room':'Online training meeting',
      status:index===2?'Pending Response':'Scheduled',
      notes:`Review ${material.priority}-priority ${material.name}: confirm specification compliance, stock availability, delivery milestones, warranty exclusions and payment terms. Fictional training meeting; no real meeting is scheduled.`};
  });
  return {stockNeeds,bids,proposalMeetings,
    requisitions,orders:[po,activePo,...additionalOrders],deliveries:[receipt,partialReceipt,...additionalDeliveries],
    amendments:[{id:`${key}-AMD-01`,poId:activePo.id,delId:partialReceipt.id,
      reason:'Initial delivery was short of the purchase-order quantity.',
      revisedSpecs:`Deliver remaining ${activePo.quantity-partialQty} ${critical.unit} of ${critical.name}.`,
      revisedQty:activePo.quantity,supplierResponse:'We acknowledge the short shipment and propose delivery of the remaining quantity within 3 business days.',
      approvalStatus:'Supplier Responded',createdAt:stamp}],
    payments:[payment,pendingPayment,...additionalPayments],
    suppliers:preset.suppliers.map((s,i)=>({id:`demo-supplier-${scenarioId}-${i+1}`,name:s.name,contact:s.contact,email:emailFor(`${scenarioId.slice(0,4)}.supplier${i+1}`),
      phone:'',category:s.category,status:'Active'})),
    ratings:preset.suppliers.map((supplier,index)=>({id:`${key}-RATE-${String(index+1).padStart(2,'0')}`,
      poId:index===0?po.id:additionalOrders[index-1]?.id??activePo.id,supplierId:supplierId(index),supplierName:supplier.name,
      rating:Number((4.1+(index%5)*.17).toFixed(1)),
      feedback:`Training scorecard for ${supplier.name}: delivery performance, specification compliance, responsiveness, documentation and after-sales support are illustrative and should be replaced with actual evaluated results.`,
      ratedBy:'Procurement Head',ratedAt:stamp})),
    auditLogs:[{id:`${key}-AUDIT-01`,timestamp:stamp,user:username,role:'Admin',action:'Fictional demo company activated',details:`${preset.companyName}: training records only.`},
      {id:`${key}-AUDIT-02`,timestamp:stamp,user:'Procurement Officer',role:'Procurement Officer',
        action:'Supplier quotation evaluated',details:`Compared fictional bids for ${critical.name}.`}]};
}
const userId=(id:DemoIndustry,index:number,position:'head'|'officer')=>`demo-user-${id}-${index}-${position}`;
const username=(id:DemoIndustry,index:number,position:'head'|'officer')=>`${id.slice(0,4)}.${String(index+1).padStart(2,'0')}.${position}`;

export async function handleDemoScenarioRoutes(request:Request,env:Env,user:User,cors:HeadersInit):Promise<Response|null>{
 const path=new URL(request.url).pathname;
 if(!path.startsWith('/demo/'))return null;
 const enabled=env.ENABLE_DEMO_PRESETS==='true';
 if(path==='/demo/status'&&request.method==='GET'){
   if(!enabled||user.role==='guest')return reply({enabled,active:null,activatedAt:null},200,cors);
   const current=await env.DB.prepare('SELECT scenario_id,activated_at FROM demo_scenario_state WHERE id=1').first<{scenario_id:string;activated_at:string}>();
   return reply({enabled,active:current?.scenario_id??null,activatedAt:current?.activated_at??null},200,cors);
 }
 if(path==='/demo/catalog'&&request.method==='GET'){
   if(!enabled)return reply({active:null,materials:[],suppliers:[],accounts:[]},200,cors);
   const current=await env.DB.prepare('SELECT scenario_id FROM demo_scenario_state WHERE id=1').first<{scenario_id:string}>();
   if(!current)return reply({active:null,materials:[],suppliers:[],accounts:[]},200,cors);
   const materials=user.role==='guest'?[]:(await env.DB.prepare('SELECT * FROM demo_material_catalog WHERE scenario_id=? ORDER BY priority,sku').bind(current.scenario_id).all()).results;
   const rows=(await env.DB.prepare('SELECT supplier_id,supplier_name,contact,category,terms_json FROM demo_supplier_terms WHERE scenario_id=? ORDER BY supplier_name').bind(current.scenario_id).all<{supplier_id:string;supplier_name:string;contact:string;category:string;terms_json:string}>()).results;
   const suppliers=rows.filter(row=>user.role!=='guest'||row.supplier_name.toLowerCase()===user.company_name.toLowerCase()).map(row=>({supplierId:row.supplier_id,name:row.supplier_name,contact:row.contact,category:row.category,terms:JSON.parse(row.terms_json),simulated:true}));
   const accounts=user.role==='admin'?(await env.DB.prepare("SELECT username,name,department,requested_position,app_role FROM users WHERE id LIKE 'demo-user-%' OR id LIKE 'demo-supplier-user-%' ORDER BY department,username").all()).results:[];
   return reply({active:current.scenario_id,materials,suppliers,accounts},200,cors);
 }
 if(path==='/demo/activate'&&request.method==='POST'){
   if(!enabled)return reply({error:'Company record loading is disabled. Enable it only on a dedicated training Worker.'},403,cors);
   if(user.role!=='admin')return reply({error:'Only the existing Admin can activate a demo company.'},403,cors);
   const body=await request.json() as R;
   const id=String(body.scenarioId??'') as DemoIndustry;
   const preset=DEMO_PRESETS[id],template=COMPANY_SETUP_TEMPLATES.find(x=>x.id===id);
   if(!preset||!template||body.confirmation!==`ACTIVATE ${id.toUpperCase()}`)return reply({error:'Choose a valid company and confirm the scenario name.'},400,cors);
   const [existing,previous,foreignUsers]=await Promise.all([
     env.DB.prepare('SELECT data FROM enterprise_state WHERE id=1').first<{data:string}>(),
     env.DB.prepare('SELECT scenario_id FROM demo_scenario_state WHERE id=1').first<{scenario_id:string}>(),
     env.DB.prepare("SELECT id FROM users WHERE role!='admin' AND id NOT LIKE 'demo-user-%' AND id NOT LIKE 'demo-supplier-user-%' LIMIT 1").first()
   ]);
   if(foreignUsers)return reply({error:'This database contains real/non-demo user accounts. Use a separate D1 database for training; no data was changed.'},409,cors);
   const newData=stockState(id,user.name);
   if(!previous&&existing){
     let data:R={};try{data=JSON.parse(existing.data) as R;}catch{return reply({error:'Existing data is not readable; refusing to overwrite it.'},409,cors);}
     if(cols.some(c=>c!=='auditLogs'&&Array.isArray(data[c])&&(data[c] as unknown[]).length>0))
       return reply({error:'The existing workspace contains procurement records. To protect them, create a fresh dedicated demo database. No data was changed.'},409,cors);
     if(Array.isArray(data.auditLogs))newData.auditLogs=[...(data.auditLogs as unknown[]),...newData.auditLogs];
   }
   const oldDocuments=previous
     ?(await env.DB.prepare("SELECT kv_key FROM procurement_documents WHERE entity_id LIKE 'DEMO-%' OR entity_id LIKE 'ORG-%'").all<{kv_key:string}>()).results
     :[];
   const oldAccreditationFiles=previous
     ?(await env.DB.prepare("SELECT kv_key FROM supplier_accreditation_files WHERE supplier_user_id LIKE 'demo-supplier-user-%'").all<{kv_key:string}>()).results
     :[];
   const activationKey=crypto.randomUUID();
   const now=new Date().toISOString(),prefix=`ORG-${id.toUpperCase()}`;
   const statements:D1PreparedStatement[]=[];
   // Ensure all old training identities are withdrawn; real users and Admin are never altered.
   statements.push(env.DB.prepare("DELETE FROM audit_evidence_reviews WHERE evidence_id IN (SELECT id FROM audit_evidence WHERE entity_ref LIKE 'DEMO-%' OR entity_ref LIKE 'ORG-%')"));
   statements.push(env.DB.prepare("DELETE FROM audit_evidence WHERE entity_ref LIKE 'DEMO-%' OR entity_ref LIKE 'ORG-%'"));
   statements.push(env.DB.prepare("DELETE FROM procurement_document_events WHERE document_id IN (SELECT id FROM procurement_documents WHERE entity_id LIKE 'DEMO-%' OR entity_id LIKE 'ORG-%')"));
   statements.push(env.DB.prepare("DELETE FROM procurement_documents WHERE entity_id LIKE 'DEMO-%' OR entity_id LIKE 'ORG-%'"));
   statements.push(env.DB.prepare("DELETE FROM pr_approval_requests WHERE pr_id LIKE 'DEMO-%' OR pr_id LIKE 'ORG-%'"));
   statements.push(env.DB.prepare("DELETE FROM supply_shortage_cases WHERE plan_id LIKE 'DEMO-%' OR plan_id LIKE 'ORG-%'"));
   statements.push(env.DB.prepare("DELETE FROM recurring_supply_plans WHERE id LIKE 'DEMO-%' OR id LIKE 'ORG-%'"));
   statements.push(env.DB.prepare("DELETE FROM procurement_contract_renewals WHERE contract_id LIKE 'DEMO-%' OR contract_id LIKE 'ORG-%'"));
   statements.push(env.DB.prepare("DELETE FROM procurement_contracts WHERE id LIKE 'DEMO-%' OR id LIKE 'ORG-%'"));
   statements.push(env.DB.prepare("DELETE FROM delivery_discrepancy_events WHERE delivery_id LIKE 'DEMO-%' OR delivery_id LIKE 'ORG-%'"));
   statements.push(env.DB.prepare("DELETE FROM delivery_discrepancies WHERE delivery_id LIKE 'DEMO-%' OR delivery_id LIKE 'ORG-%'"));
   statements.push(env.DB.prepare("DELETE FROM verified_inventory_movements WHERE delivery_id LIKE 'DEMO-%' OR delivery_id LIKE 'ORG-%'"));
   statements.push(env.DB.prepare("DELETE FROM verified_inventory_receipts WHERE delivery_id LIKE 'DEMO-%' OR delivery_id LIKE 'ORG-%'"));
   statements.push(env.DB.prepare("DELETE FROM sourcing_messages WHERE entity_id LIKE 'DEMO-%' OR entity_id LIKE 'ORG-%'"));
   statements.push(env.DB.prepare("DELETE FROM supplier_stock_audit WHERE inventory_id LIKE 'demo-inventory-%'"));
   statements.push(env.DB.prepare("DELETE FROM supply_chain_audit WHERE id LIKE 'DEMO-%-SUPPLY-AUDIT-%' OR id LIKE 'ORG-%-SUPPLY-AUDIT-%'"));
   statements.push(env.DB.prepare("DELETE FROM supplier_invoices WHERE id LIKE 'DEMO-%' OR id LIKE 'ORG-%'"));
   statements.push(env.DB.prepare("DELETE FROM sourcing_deadlines WHERE need_id LIKE 'DEMO-%' OR need_id LIKE 'ORG-%'"));
   statements.push(env.DB.prepare("DELETE FROM finance_approvers WHERE user_id LIKE 'demo-user-%'"));
   statements.push(env.DB.prepare("DELETE FROM operations_officers WHERE user_id LIKE 'demo-user-%'"));
   statements.push(env.DB.prepare("DELETE FROM supplier_accreditation_files WHERE supplier_user_id LIKE 'demo-supplier-user-%'"));
   statements.push(env.DB.prepare("DELETE FROM supplier_accreditations WHERE supplier_user_id LIKE 'demo-supplier-user-%'"));
   statements.push(env.DB.prepare("DELETE FROM users WHERE id LIKE 'demo-user-%' OR id LIKE 'demo-supplier-user-%'"));
   statements.push(env.DB.prepare("DELETE FROM supplier_company_inventory WHERE id LIKE 'demo-inventory-%'"));
   statements.push(env.DB.prepare('DELETE FROM demo_material_catalog'));
   statements.push(env.DB.prepare('DELETE FROM demo_supplier_terms'));
   // Remove old demo-only budgets and directory entries, but retain the core organizational labels.
   if(previous){
     const old=COMPANY_SETUP_TEMPLATES.find(t=>t.id===previous.scenario_id);
     if(old){
       for(const d of old.departments){
         statements.push(env.DB.prepare('DELETE FROM department_budgets WHERE department=?').bind(d.name));
         if(!['Executive','Procurement','Operations','Finance & Accounting','IT Systems','Human Resources'].includes(d.name))
           statements.push(env.DB.prepare('DELETE FROM organization_departments WHERE name=?').bind(d.name));
       }
     }
   }
   // Appointments are stored in D1, never inferred from a user-selected client role.
   for(let i=0;i<template.departments.length;i++){
     const dept=template.departments[i];
     for(const pos of ['head','officer'] as const){
       const uid=userId(id,i,pos),uname=username(id,i,pos);
       const appRole=dept.name==='Procurement'?(pos==='head'?'Procurement Head':'Procurement Officer'):'Employee';
       const name=`${dept.name} ${pos==='head'?'Head':'Officer'}`.slice(0,120);
       statements.push(env.DB.prepare(`INSERT INTO users(id,username,password_hash,name,email,role,app_role,status,department,company_name,requested_position,created_at,updated_at)
        VALUES(?,?,?,?,?,'employee',?,'approved',?,'',?,?,?)`).bind(uid,uname,DEMO_PASSWORD_HASH,name,emailFor(uname),appRole,dept.name,pos==='head'?'Head':'Officer',now,now));
       if(pos==='head'&&dept.name!=='Executive'){
         statements.push(env.DB.prepare(`INSERT INTO finance_approvers(step_role,department,user_id,updated_at) VALUES('Department Head',?,?,?)
          ON CONFLICT(step_role,department) DO UPDATE SET user_id=excluded.user_id,updated_at=excluded.updated_at`).bind(dept.name,uid,now));
       }
       if(dept.name==='Finance & Accounting'&&pos==='officer'){
         statements.push(env.DB.prepare(`INSERT INTO finance_approvers(step_role,department,user_id,updated_at) VALUES('Finance Officer','*',?,?)
          ON CONFLICT(step_role,department) DO UPDATE SET user_id=excluded.user_id,updated_at=excluded.updated_at`).bind(uid,now));
       }
       if(dept.name==='Operations'&&pos==='officer'){
         statements.push(env.DB.prepare('INSERT INTO operations_officers(user_id,appointed_by,appointed_at) VALUES(?,?,?)').bind(uid,user.id,now));
       }
     }
   }
   const docKeys:string[]=[];
   const expiration=new Date(Date.now()+540*86400000).toISOString().slice(0,10);
   const categories=['Business Registration','Tax Certificate','Business Permit'];
   for(let i=0;i<preset.suppliers.length;i++){
     const s=preset.suppliers[i],supplierId=`demo-supplier-${id}-${i+1}`,uid=`demo-supplier-user-${id}-${i+1}`;
     const uname=`${id.slice(0,4)}.supplier${i+1}`;
     statements.push(env.DB.prepare(`INSERT INTO users(id,username,password_hash,name,email,role,app_role,status,department,company_name,requested_position,created_at,updated_at)
       VALUES(?,?,?,?,?,'guest','Supplier','approved','',?,'Supplier',?,?)`).bind(uid,uname,DEMO_PASSWORD_HASH,s.contact,emailFor(uname),s.name,now,now));
     statements.push(env.DB.prepare('INSERT INTO demo_supplier_terms(supplier_id,scenario_id,supplier_name,contact,category,terms_json) VALUES(?,?,?,?,?,?)').bind(supplierId,id,s.name,s.contact,s.category,JSON.stringify(s.terms)));
     statements.push(env.DB.prepare(`INSERT INTO supplier_accreditations(supplier_user_id,status,review_note,reviewed_by,reviewed_at,updated_at)
       VALUES(?,'Approved','DEMO APPROVAL ONLY - Sample documents, not verified legal evidence.',?,?,?)`).bind(uid,user.id,now,now));
     for(let k=0;k<categories.length;k++){
       const category=categories[k],docId=`demo-doc-${id}-${i+1}-${k+1}`,kvKey=`demo-accreditation/${id}/${activationKey}/${i+1}/${k+1}.pdf`,pdf=pdfBytes(s.name,category);
       try{await env.DOCUMENTS.put(kvKey,pdf);}catch{for(const key of docKeys)await env.DOCUMENTS.delete(key);return reply({error:'Could not write sample PDF to document storage. No database records were changed.'},503,cors);}
       docKeys.push(kvKey);
       statements.push(env.DB.prepare(`INSERT INTO supplier_accreditation_files(id,supplier_user_id,category,file_name,mime_type,size,kv_key,valid_until,uploaded_at)
        VALUES(?,?,? ,?,'application/pdf',?,?,?,?)`).bind(docId,uid,category,`SAMPLE_${category.replaceAll(' ','_')}_${id}.pdf`,pdf.byteLength,kvKey,expiration,now));
     }
   }
   for(let i=0;i<preset.materials.length;i++){
     const m=preset.materials[i],catalogSupplierIndex=preset.suppliers.findIndex(s=>supplierOffersMaterial(s,m.sku));
     if(catalogSupplierIndex<0)return reply({error:`No supplier is configured to offer ${m.name}.`},500,cors);
     const supplierId=`demo-supplier-${id}-${catalogSupplierIndex+1}`;
     statements.push(env.DB.prepare(`INSERT INTO demo_material_catalog(id,scenario_id,sku,item_name,priority,unit,on_hand,reorder_point,target_qty,unit_price_cents,specifications,supplier_id)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(`demo-material-${id}-${i+1}`,id,m.sku,m.name,m.priority,m.unit,m.onHand,m.reorderPoint,m.targetQty,money(m.unitPrice),m.specs,supplierId));
     for(let sn=1;sn<=preset.suppliers.length;sn++){
       const sup=preset.suppliers[sn-1],iid=`demo-inventory-${id}-${sn}-${i+1}`;
       if(!supplierOffersMaterial(sup,m.sku))continue;
       statements.push(env.DB.prepare(`INSERT INTO supplier_company_inventory(id,supplier_id,supplier_name,sku,item_name,specifications,unit,on_hand,reserved,unit_price_cents,lead_time_days,updated_by,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(iid,`demo-supplier-${id}-${sn}`,sup.name,m.sku,m.name,m.specs,m.unit,
           sn===1?m.targetQty*2:Math.round(m.targetQty*.8),sn===1?Math.round(m.targetQty*.1):0,
           money(Math.max(1,Math.round(m.unitPrice*(1+((sn-1)-2.5)*.025+((i%3)-1)*.008)))),
           sup.terms.leadTimeDays,`demo-supplier-user-${id}-${sn}`,now));
     }
   }
   const operationsIndex=template.departments.findIndex(dept=>dept.name==='Operations');
   const procurementIndex=template.departments.findIndex(dept=>dept.name==='Procurement');
   const financeIndex=template.departments.findIndex(dept=>dept.name==='Finance & Accounting');
   const operationsOfficerId=userId(id,operationsIndex,'officer');
   const procurementHeadId=userId(id,procurementIndex,'head');
   const procurementOfficerId=userId(id,procurementIndex,'officer');
   const financeOfficerId=userId(id,financeIndex,'officer');
   const contractId=(index:number)=>`ORG-${id.toUpperCase()}-CONTRACT-${String(index+1).padStart(2,'0')}`;
   for(let i=0;i<preset.suppliers.length;i++){
     const supplier=preset.suppliers[i],material=preset.materials[i%preset.materials.length];
     const contract={id:contractId(i),reference:`TRAIN-${id.toUpperCase()}-C${String(i+1).padStart(2,'0')}`,
       title:`${supplier.name} - ${material.name} framework supply agreement`,
       supplierId:`demo-supplier-${id}-${i+1}`,supplierName:supplier.name,
       poId:newData.orders.find(order=>order.supplierId===`demo-supplier-${id}-${i+1}`)?.id??null,
       startsOn:new Date(Date.now()-30*86400000).toISOString().slice(0,10),
       endsOn:new Date(Date.now()+335*86400000).toISOString().slice(0,10)};
     const bid=newData.bids.find(row=>row.supplierId===contract.supplierId&&row.needId===newData.stockNeeds[i%newData.stockNeeds.length].id);
     statements.push(env.DB.prepare(`INSERT INTO procurement_contracts
       (id,reference,title,supplier_id,supplier_name,po_id,bid_id,lifecycle_status,starts_on,ends_on,negotiated_price_cents,
        pricing_terms,renewal_notice_days,notes,created_by,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,'Published',?,?,?,?,?,?,?, ?,?)`).bind(contract.id,contract.reference,contract.title,contract.supplierId,
         contract.supplierName,contract.poId,bid?.id??null,contract.startsOn,contract.endsOn,
         money(bid?.unitPrice??material.unitPrice),supplier.terms.payment,30,
         'Fictional training framework record only; not a legal offer, signed agreement, or commitment.',user.id,now,now));
   }
   const priorityMaterials=(['A','B','C'] as const).map(priority=>preset.materials.find(material=>material.priority===priority)!);
   const planIds=new Map<string,string>();
   for(let i=0;i<priorityMaterials.length;i++){
     const material=priorityMaterials[i],primaryIndex=i%preset.suppliers.length,backupIndex=(primaryIndex+1)%preset.suppliers.length;
     const planId=`ORG-${id.toUpperCase()}-PLAN-${String(i+1).padStart(2,'0')}`;
     planIds.set(material.priority,planId);
     statements.push(env.DB.prepare(`INSERT INTO recurring_supply_plans
       (id,item_name,sku,unit,category,priority,primary_supplier_id,backup_supplier_id,primary_contract_id,backup_contract_id,
        quantity_per_cycle,frequency,next_release_date,safety_stock,status,created_by,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(planId,material.name,material.sku,material.unit,
         'Goods & Materials',material.priority,`demo-supplier-${id}-${primaryIndex+1}`,`demo-supplier-${id}-${backupIndex+1}`,
         contractId(primaryIndex),contractId(backupIndex),Math.max(1,Math.round(material.targetQty/3)),
         material.priority==='A'?'Weekly':material.priority==='B'?'Monthly':'Quarterly',
         new Date(Date.now()+(14+i*7)*86400000).toISOString().slice(0,10),material.reorderPoint,'Active',user.id,now,now));
   }
   const plannedMaterial=priorityMaterials[0],planId=planIds.get('A')!;
   statements.push(env.DB.prepare(`INSERT INTO supply_shortage_cases
     (id,plan_id,required_qty,primary_confirmed_qty,shortage_qty,backup_available_at_report,status,notes,created_by,created_at)
     VALUES(?,?,?, ?,?,?, 'Recommended',?,?,?)`).bind(`${prefix.toUpperCase()}-SHORT-01`,planId,
       Math.max(2,plannedMaterial.targetQty),Math.max(0,Math.floor(plannedMaterial.targetQty*.6)),
       Math.max(1,Math.ceil(plannedMaterial.targetQty*.4)),Math.max(1,Math.floor(plannedMaterial.targetQty*.8)),
       'Training scenario: primary supplier confirms a temporary capacity constraint; compare backup inventory, total landed cost and delivery risk before releasing a change.',user.id,now));
   const partialDelivery=newData.deliveries[1];
   const affectedQty=partialDelivery.orderedQty-partialDelivery.deliveredQty;
   statements.push(env.DB.prepare(`INSERT INTO delivery_discrepancies
     (delivery_id,po_id,supplier_name,department,item_title,category,affected_qty,reported_at,status,resolution_notes,updated_by,updated_at)
     VALUES(?,?,?,?,?,'Short Delivery',?,?,'Investigating','Awaiting confirmation of the balance delivery.',?,?)`).bind(
       partialDelivery.id,partialDelivery.poId,partialDelivery.supplierName,partialDelivery.department,partialDelivery.itemTitle,
       affectedQty,now,procurementOfficerId,now));
   statements.push(env.DB.prepare(`INSERT INTO delivery_discrepancy_events(delivery_id,event_type,message,actor_id,recorded_at)
     VALUES(?,?,?,?,?),(?,?,?,?,?)`).bind(partialDelivery.id,'Reported','Short delivery recorded during sample receiving inspection.',
       operationsOfficerId,now,partialDelivery.id,'Supplier Response','Supplier proposed delivery of the outstanding quantity within 3 business days.',
       `demo-supplier-user-${id}-1`,now));
   for(const delivery of newData.deliveries.slice(2)){
     if(delivery.deliveryStatus==='Partial Delivery'){
       const shortage=delivery.orderedQty-delivery.deliveredQty;
       statements.push(env.DB.prepare(`INSERT INTO delivery_discrepancies
         (delivery_id,po_id,supplier_name,department,item_title,category,affected_qty,reported_at,status,resolution_notes,updated_by,updated_at)
         VALUES(?,?,?,?,?,'Short Delivery',?,?,'Investigating','Supplier balance confirmation and revised delivery date are required.',?,?)`).bind(
           delivery.id,delivery.poId,delivery.supplierName,delivery.department,delivery.itemTitle,shortage,now,procurementOfficerId,now));
       const supplierIndex=preset.suppliers.findIndex(supplier=>supplier.name===delivery.supplierName);
       statements.push(env.DB.prepare(`INSERT INTO delivery_discrepancy_events(delivery_id,event_type,message,actor_id,recorded_at)
         VALUES(?,?,?,?,?),(?,?,?,?,?)`).bind(delivery.id,'Reported',
         `Receiving recorded ${shortage} ${delivery.unit} short for ${delivery.itemTitle}; quantity variance is under review.`,
         operationsOfficerId,now,delivery.id,'Supplier Response',
         'Supplier acknowledged the discrepancy and is confirming replacement stock and dispatch timing.',
         `demo-supplier-user-${id}-${supplierIndex+1}`,now));
     }
   }
   const acceptedDelivery=newData.deliveries[0];
   statements.push(env.DB.prepare(`INSERT INTO verified_inventory_receipts
     (delivery_id,po_id,department,supplier_name,item_title,specifications,quantity,active,first_received_at,updated_at)
     VALUES(?,?,?,?,?,?,?,1,?,?)`).bind(acceptedDelivery.id,acceptedDelivery.poId,acceptedDelivery.department,
       acceptedDelivery.supplierName,acceptedDelivery.itemTitle,acceptedDelivery.specs,acceptedDelivery.deliveredQty,now,now));
   statements.push(env.DB.prepare(`INSERT INTO verified_inventory_movements
     (id,delivery_id,po_id,department,item_title,movement_type,quantity_delta,notes,recorded_at)
     VALUES(?,?,?, ?,?,'Received',?,?,?)`).bind(`${prefix.toUpperCase()}-MOV-01`,acceptedDelivery.id,acceptedDelivery.poId,
       acceptedDelivery.department,acceptedDelivery.itemTitle,acceptedDelivery.deliveredQty,
       'Sample verified receipt posted to company inventory.',now));
   for(const delivery of newData.deliveries.slice(2).filter(row=>row.deliveryStatus==='Delivered')){
     statements.push(env.DB.prepare(`INSERT INTO verified_inventory_receipts
       (delivery_id,po_id,department,supplier_name,item_title,specifications,quantity,active,first_received_at,updated_at)
       VALUES(?,?,?,?,?,?,?,1,?,?)`).bind(delivery.id,delivery.poId,delivery.department,
         delivery.supplierName,delivery.itemTitle,delivery.specs,delivery.deliveredQty,now,now));
     statements.push(env.DB.prepare(`INSERT INTO verified_inventory_movements
       (id,delivery_id,po_id,department,item_title,movement_type,quantity_delta,notes,recorded_at)
       VALUES(?,?,?,?,?,'Received',?,?,?)`).bind(`${prefix.toUpperCase()}-MOV-${delivery.id.slice(-2)}`,
         delivery.id,delivery.poId,delivery.department,delivery.itemTitle,delivery.deliveredQty,
         `Accepted receipt for ${delivery.itemTitle}; quantity and product specifications were checked.`,now));
   }
   statements.push(env.DB.prepare(`INSERT INTO supplier_stock_audit
     (id,inventory_id,supplier_id,old_on_hand,new_on_hand,old_reserved,new_reserved,changed_by,changed_at)
     VALUES(?,?,?,NULL,?,NULL,?,?,?)`).bind(`${prefix.toUpperCase()}-STOCK-AUDIT-01`,
       `demo-inventory-${id}-1-1`,`demo-supplier-${id}-1`,plannedMaterial.targetQty*2,
       Math.round(plannedMaterial.targetQty*.1),`demo-supplier-user-${id}-1`,now));
   statements.push(env.DB.prepare(`INSERT INTO supply_chain_audit(id,action,description,user_id,created_at)
     VALUES(?,?,?,?,?)`).bind(`${prefix}-SUPPLY-AUDIT-01`,'Company supply plan loaded',
       `${preset.companyName}: fictional recurring plan and backup sourcing example.`,user.id,now));

   const approvalTime=now;
   for(const pr of newData.requisitions){
     const approvalStatus=pr.status==='Pending'?'Pending':pr.status==='Rejected'?'Rejected':'Approved';
     const isPending=approvalStatus==='Pending';
     statements.push(env.DB.prepare(`INSERT INTO pr_approval_requests
       (pr_id,department,amount_cents,status,current_step,total_steps,requested_by,created_at,decided_at)
       VALUES(?,?,?,?,2,2,?,?,?)`).bind(pr.id,pr.department,money(pr.totalCost),approvalStatus,
         operationsOfficerId,pr.createdAt,isPending?null:approvalTime));
     statements.push(env.DB.prepare(`INSERT INTO pr_approval_steps(pr_id,step_no,step_role,status,decided_by,comment,decided_at)
       VALUES(?,1,'Department Head','Approved',?,?,?)`).bind(pr.id,operationsOfficerId,
         'Submission acknowledged by the department; this entry is part of the sample workflow.',pr.createdAt));
     statements.push(env.DB.prepare(`INSERT INTO pr_approval_steps(pr_id,step_no,step_role,status,decided_by,comment,decided_at)
       VALUES(?,2,'Procurement Head',?,?,?,?)`).bind(pr.id,approvalStatus,
         isPending?null:procurementHeadId,isPending?'Pending':approvalStatus==='Rejected'?'Rejected - revise quantity and provide supporting usage forecast.':'Reviewed against the department budget and procurement specifications.',
         isPending?null:approvalTime));
   }
   statements.push(env.DB.prepare(`INSERT INTO approval_delegations
     (id,step_role,department,primary_user_id,delegate_user_id,starts_on,ends_on,reason,created_by,created_at,request_kind,review_status,reviewed_by,reviewed_at,review_note)
     VALUES(?,'Procurement Head','',?,?,?,?,?,?,?,'Delegation','Approved',?,?,?)`).bind(
       `${prefix.toUpperCase()}-DELEGATION-01`,procurementHeadId,procurementOfficerId,
       new Date(Date.now()-86400000).toISOString().slice(0,10),new Date(Date.now()+14*86400000).toISOString().slice(0,10),
       'Training example of a temporary procurement approval delegation.',user.id,now,user.id,now,
       'Approved for the training scenario.'));
   statements.push(env.DB.prepare(`INSERT INTO sourcing_messages
     (id,entity_type,entity_id,supplier_id,sender_user_id,sender_name,sender_role,body,created_at)
     VALUES(?,?,?,?,?,?,?,?,?),(?,?,?,?,?,?,?,?,?),(?,?,?,?,?,?,?,?,?)`).bind(
       `${prefix.toUpperCase()}-MSG-01`,'BID',newData.bids[0].id,`demo-supplier-${id}-1`,
       `demo-supplier-user-${id}-1`,preset.suppliers[0].contact,'Supplier',
       'Quotation received with product datasheet, batch traceability information and proposed delivery schedule for technical review.',now,
       `${prefix.toUpperCase()}-MSG-02`,'MEETING',newData.proposalMeetings[0].id,`demo-supplier-${id}-1`,
       procurementOfficerId,'Procurement Officer','Procurement Officer',
       'Please confirm exact model compatibility, available quantity, dispatch date, warranty exclusions and delivery documentation.',now,
       `${prefix.toUpperCase()}-MSG-03`,'DELIVERY',partialDelivery.id,`demo-supplier-${id}-1`,
       `demo-supplier-user-${id}-1`,preset.suppliers[0].contact,'Supplier',
       'We acknowledge the short shipment and propose delivery of the remaining quantity within 3 business days.',now));
   for(let i=1;i<preset.suppliers.length;i++){
     const supplier=preset.suppliers[i],supplierBid=newData.bids.find(bid=>bid.supplierId===`demo-supplier-${id}-${i+1}`)!;
     statements.push(env.DB.prepare(`INSERT INTO sourcing_messages
       (id,entity_type,entity_id,supplier_id,sender_user_id,sender_name,sender_role,body,created_at)
       VALUES(?,?,?,?,?,?,?,?,?)`).bind(`${prefix.toUpperCase()}-MSG-SUP-${String(i+1).padStart(2,'0')}`,
         'BID',supplierBid.id,`demo-supplier-${id}-${i+1}`,`demo-supplier-user-${id}-${i+1}`,
         supplier.contact,'Supplier',
         `Quotation ${supplierBid.quotationTerms.supportingReference} submitted for ${supplierBid.supplierName}; ${supplierBid.leadTimeDays}-day lead time. Confirm scope, stock and final commercial terms before award.`,now));
   }
   statements.push(env.DB.prepare(`INSERT INTO account_direct_messages(id,sender_id,recipient_id,body,created_at)
     VALUES(?,?,?,?,?),(?,?,?,?,?)`).bind(
       `${prefix.toUpperCase()}-DM-01`,procurementHeadId,operationsOfficerId,
       `Replenishment review: ${plannedMaterial.name} is priority ${plannedMaterial.priority}, on-hand stock is ${plannedMaterial.onHand} ${plannedMaterial.unit}, and reorder point is ${plannedMaterial.reorderPoint}. Check the A-priority sourcing case before releasing the order.`,now,
       `${prefix.toUpperCase()}-DM-02`,operationsOfficerId,procurementHeadId,
       'Acknowledged. I will verify the quantity against current stock, attach the usage forecast, and record receiving inspection results against the purchase order.',now));
   statements.push(env.DB.prepare(`INSERT INTO audit_evidence
     (id,occurred_at,actor_id,actor_name,actor_role,entity_type,entity_ref,action,before_json,after_json,review_state,review_note)
     VALUES(?,?,?,?,?,'company_setup',?,'Company setup activated',NULL,?,'Reviewed','Fictional training record; not a real business event.')`).bind(
       `${prefix}-EVIDENCE-01`,now,user.id,user.name,'Admin',`${prefix}-SETUP`,
       JSON.stringify({scenario:id,company:preset.companyName,trainingOnly:true})));
   const exampleNeed=newData.stockNeeds[0],samplePo=newData.orders[0];
   for(const need of newData.stockNeeds){
     statements.push(env.DB.prepare('INSERT INTO sourcing_deadlines(need_id,closes_at,manually_closed,updated_by,updated_at) VALUES(?,?,0,?,?)')
       .bind(need.id,new Date(Date.now()+14*86400000).toISOString(),user.id,now));
   }
   const stageBusinessDocument=async(entityType:string,entityId:string,category:string,fileName:string):Promise<string|null>=>{
     const documentId=crypto.randomUUID(),kvKey=`training-records/${id}/${documentId}.pdf`;
     const pdf=pdfBytes(preset.companyName,`${category} - ${fileName}`);
     try{await env.DOCUMENTS.put(kvKey,pdf);}catch{
       for(const key of docKeys)await env.DOCUMENTS.delete(key);
       return null;
     }
     docKeys.push(kvKey);
     statements.push(env.DB.prepare(`INSERT INTO procurement_documents
       (id,entity_type,entity_id,category,file_name,mime_type,size,kv_key,uploader_id,uploader_name,created_at)
       VALUES(?,?,?, ?,?,'application/pdf',?,?,?,?,?)`).bind(documentId,entityType,entityId,category,fileName,
         pdf.byteLength,kvKey,user.id,user.name,now));
     return documentId;
   };
   const prDocumentId=await stageBusinessDocument('PR',newData.requisitions[0].id,'Supporting Document',`SAMPLE_${id}_requisition.pdf`);
   const bidDocumentId=await stageBusinessDocument('BID',newData.bids[0].id,'Quotation',`SAMPLE_${id}_quotation.pdf`);
   const deliveryDocumentId=await stageBusinessDocument('DEL',newData.deliveries[1].id,'Delivery Receipt',`SAMPLE_${id}_delivery_receipt.pdf`);
   const invoiceDocumentId=await stageBusinessDocument('PAY',newData.payments[0].id,'Invoice',`SAMPLE_${id}_invoice.pdf`);
   if(!prDocumentId||!bidDocumentId||!deliveryDocumentId||!invoiceDocumentId){
     for(const key of docKeys)await env.DOCUMENTS.delete(key);
     return reply({error:'Could not write sample procurement documents. No database records were changed.'},503,cors);
   }
   statements.push(env.DB.prepare(`INSERT INTO supplier_invoices
     (id,po_id,supplier_name,invoice_number,amount_cents,invoice_date,document_id,status,submitted_by,submitted_at,matched_by,matched_at)
     VALUES(?,?,?,?,?,?,?,'Matched',?,?,?,?)`).bind(`${prefix}-INVOICE-01`,samplePo.id,preset.suppliers[0].name,
       `SAMPLE-INV-${id.toUpperCase()}-001`,money(samplePo.totalCost),
       new Date(Date.now()-8*86400000).toISOString().slice(0,10),invoiceDocumentId,`demo-supplier-user-${id}-1`,
       now,financeOfficerId,now));
   let additionalInvoiceSequence=2;
   for(const order of newData.orders.slice(2)){
     const delivery=newData.deliveries.find(row=>row.poId===order.id&&row.deliveryStatus==='Delivered');
     if(!delivery)continue;
     const invoiceNumber=String(additionalInvoiceSequence++).padStart(2,'0');
     statements.push(env.DB.prepare(`INSERT INTO supplier_invoices
       (id,po_id,supplier_name,invoice_number,amount_cents,invoice_date,document_id,status,submitted_by,submitted_at,matched_by,matched_at)
       VALUES(?,?,?,?,?, ?,NULL,'Matched',?,?,?,?)`).bind(`${prefix}-INVOICE-${invoiceNumber}`,
         order.id,order.supplierName,`TRAIN-INV-${id.toUpperCase()}-${invoiceNumber}`,
         money(order.totalCost),new Date(Date.now()-2*86400000).toISOString().slice(0,10),
         `demo-supplier-user-${id}-${preset.suppliers.findIndex(supplier=>supplier.name===order.supplierName)+1}`,now,financeOfficerId,now));
   }
   const setup={setupId:id,industry:id,companyName:preset.companyName,priorities:configFromIndustry(id).priorities,
     departments:template.departments,annualBudgetPHP:preset.annualBudgetPHP,approvals:template.approvals};
   let used=0;
   for(let i=0;i<template.departments.length;i++){
     const d=template.departments[i];
     const amount=i===template.departments.length-1?money(preset.annualBudgetPHP)-used:Math.round(money(preset.annualBudgetPHP)*d.budgetPercent/100);
     used+=amount;
     statements.push(env.DB.prepare(`INSERT INTO organization_departments(name) VALUES(?) ON CONFLICT(name) DO NOTHING`).bind(d.name));
     statements.push(env.DB.prepare(`INSERT INTO department_budgets(department,allocated_cents,updated_by,updated_at) VALUES(?,?,?,?)
      ON CONFLICT(department) DO UPDATE SET allocated_cents=excluded.allocated_cents,updated_by=excluded.updated_by,updated_at=excluded.updated_at`).bind(d.name,amount,user.id,now));
   }
   statements.push(env.DB.prepare(`INSERT INTO finance_rules(id,finance_from_cents,admin_from_cents,finance_head_from_cents) VALUES(1,?,?,?)
    ON CONFLICT(id) DO UPDATE SET finance_from_cents=excluded.finance_from_cents,admin_from_cents=excluded.admin_from_cents,finance_head_from_cents=excluded.finance_head_from_cents,updated_at=datetime('now')`).bind(money(template.approvals.financeFrom),money(template.approvals.adminFrom),money(template.approvals.financeHeadFrom)));
   statements.push(env.DB.prepare(`INSERT INTO operations_material_configuration(id,config,updated_by,updated_at) VALUES(1,?,?,?)
    ON CONFLICT(id) DO UPDATE SET config=excluded.config,updated_by=excluded.updated_by,updated_at=excluded.updated_at`).bind(JSON.stringify({...configFromIndustry(id,preset.companyName),activeSetupId:id}),user.id,now));
   statements.push(env.DB.prepare(`INSERT INTO company_setup_state(id,setup_id,annual_budget_cents,setup_config,updated_by,updated_at) VALUES(1,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET setup_id=excluded.setup_id,annual_budget_cents=excluded.annual_budget_cents,setup_config=excluded.setup_config,updated_by=excluded.updated_by,updated_at=excluded.updated_at`).bind(id,money(preset.annualBudgetPHP),JSON.stringify(setup),user.id,now));
   statements.push(env.DB.prepare(`INSERT INTO enterprise_state(id,data,updated_at) VALUES(1,?,?)
    ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at`).bind(JSON.stringify(newData),now));
   statements.push(env.DB.prepare(`INSERT INTO demo_scenario_state(id,scenario_id,seed_version,activated_by,activated_at) VALUES(1,?,5,?,?)
    ON CONFLICT(id) DO UPDATE SET scenario_id=excluded.scenario_id,seed_version=5,activated_by=excluded.activated_by,activated_at=excluded.activated_at`).bind(id,user.id,now));
   try{await env.DB.batch(statements);}catch(err){
     for(const key of docKeys)await env.DOCUMENTS.delete(key);
     return reply({error:`Company setup failed without committing: ${String(err).slice(0,220)}`},500,cors);
   }
   // Old sample files are garbage-collected only after new database commit.
   for(const document of oldDocuments){
     try{await env.DOCUMENTS.delete(document.kv_key);}catch(error){console.error('Old demo document cleanup failed',document.kv_key,error);}
   }
   for(const document of oldAccreditationFiles){
     try{await env.DOCUMENTS.delete(document.kv_key);}catch(error){console.error('Old demo accreditation cleanup failed',error);}
   }
   return reply({ok:true,active:id,company:preset.companyName,accounts:template.departments.length*2+preset.suppliers.length,materials:preset.materials.length,
     populatedModules:['dashboard','global_search','tracking','notifications','requisitions','approvals','approval_delegation','budgets',
       'bidding','bidding_deadlines','bid_comparison','bid_evaluation','proposal_meetings','contracts','supply_planning',
       'supplier_inventory','suppliers','supplier_messages','accreditation','orders','delivery','amendments','delivery_discrepancies',
       'inventory','invoice_matching','payments','reports','supplier_analytics','documents','pdf_generator','people_directory',
       'people_messages','audit','staff_assignments','operations_materials','users','access_control']},200,cors);
 }
 return reply({error:'Method not allowed.'},405,cors);
}
