// Node 22+ integration test. Runs the actual Worker route against SQLite locally.
// No Cloudflare account, deployed API, or user database is accessed.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');
require.extensions['.ts']=(module,filename)=>{
 const source=fs.readFileSync(filename,'utf8');
 const compiled=ts.transpileModule(source,{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 module._compile(compiled,filename);
};
const {handleDemoScenarioRoutes}=require('../cloudflare/src/demoScenarioRoutes.ts');
const {DEMO_PRESETS}=require('../src/data/demoPresets.ts');
const {COMPANY_SETUP_TEMPLATES}=require('../src/domain/companySetup.ts');
function createDb(){
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys = ON;');
 db.exec(fs.readFileSync(path.join(__dirname,'../src/db/schema.sql'),'utf8'));
 for(const file of fs.readdirSync(path.join(__dirname,'../cloudflare/migrations')).filter(f=>f.endsWith('.sql')).sort()){
  try{db.exec(fs.readFileSync(path.join(__dirname,'../cloudflare/migrations',file),'utf8'));}
  catch(e){throw new Error(`Migration ${file}: ${e.message}`)}
 }
 db.prepare(`INSERT INTO users (id,username,password_hash,name,email,role,app_role,status,department,company_name,requested_position) VALUES ('admin-user','admin','unused','Admin','admin@demo.invalid','admin','Admin','approved','Executive','','Head')`).run();
 function prepared(sql,args=[]){
  return {bind(...next){return prepared(sql,next)},async first(){return db.prepare(sql).get(...args)??null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){return {meta:{changes:db.prepare(sql).run(...args).changes}}},sql,args};
 }
 const kv=new Map();
 const env={DB:{prepare:sql=>prepared(sql),async batch(statements){db.exec('BEGIN TRANSACTION');try{const results=[];for(const stmt of statements)results.push({meta:{changes:db.prepare(stmt.sql).run(...stmt.args).changes}});db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}}},DOCUMENTS:{async put(k,v){kv.set(k,v)},async get(k){return kv.get(k)},async delete(k){kv.delete(k)}},ENABLE_DEMO_PRESETS:'true'};
 return {db,kv,env};
}
async function perform(env,user,method,route,body){
 const res=await handleDemoScenarioRoutes(new Request(`https://demo.invalid${route}`,{method,...(body?{body:JSON.stringify(body)}:{})}),env,user,{});
 const json=await res.json();return {status:res.status,json};
}
(async()=>{
 const {db,env,kv}=createDb();
 const admin={id:'admin-user',name:'Admin',role:'admin',app_role:'Admin',company_name:''};
 const guest={id:'guest-user',name:'Unauthorized',role:'guest',app_role:'Supplier',company_name:''};
 const productionEnv={...env,ENABLE_DEMO_PRESETS:undefined,DB:{prepare(){throw new Error('Disabled demo routes must not query demo-only tables.');}}};
 let r=await perform(productionEnv,admin,'GET','/demo/status');
 assert.deepEqual(r.json,{enabled:false,active:null,activatedAt:null});
 r=await perform(productionEnv,admin,'GET','/demo/catalog');
 assert.deepEqual(r.json,{active:null,materials:[],suppliers:[],accounts:[]});
 r=await perform(productionEnv,admin,'POST','/demo/activate',{scenarioId:'electronics',confirmation:'ACTIVATE ELECTRONICS'});
 assert.equal(r.status,403);
 console.log('PASS production isolation: disabled demo endpoints never query demo-only tables');
 const auditOnly=createDb();
 auditOnly.db.prepare('INSERT INTO enterprise_state(id,data) VALUES(1,?)').run(JSON.stringify({
  stockNeeds:[],bids:[],proposalMeetings:[],requisitions:[],orders:[],deliveries:[],amendments:[],payments:[],
  suppliers:[],ratings:[],auditLogs:[{action:'User Login',details:'Training Admin signed in successfully.'}]
 }));
 const auditResult=await perform(auditOnly.env,admin,'POST','/demo/activate',{scenarioId:'bakery',confirmation:'ACTIVATE BAKERY'});
 assert.equal(auditResult.status,200,JSON.stringify(auditResult.json));
 const auditSnapshot=JSON.parse(auditOnly.db.prepare('SELECT data FROM enterprise_state WHERE id=1').get().data);
 assert.ok(auditSnapshot.auditLogs.some(entry=>entry.action==='User Login'));
 console.log('PASS activation ignores and preserves audit-only login activity in a fresh training workspace');
 r=await perform(env,guest,'POST','/demo/activate',{scenarioId:'electronics',confirmation:'ACTIVATE ELECTRONICS'});
 assert.equal(r.status,403);
 let old='';
 for(const industry of Object.keys(DEMO_PRESETS)){
  assert.equal(DEMO_PRESETS[industry].materials.length,24);
  assert.equal(DEMO_PRESETS[industry].suppliers.length,8);
  for(const supplier of DEMO_PRESETS[industry].suppliers){
   if(!supplier.offeredMaterialSkus)continue;
   assert.equal(new Set(supplier.offeredMaterialSkus).size,supplier.offeredMaterialSkus.length,
    `${industry}: ${supplier.name} product coverage has no duplicate SKUs`);
   assert.ok(supplier.offeredMaterialSkus.every(sku=>DEMO_PRESETS[industry].materials.some(material=>material.sku===sku)),
    `${industry}: ${supplier.name} coverage only references catalog SKUs`);
  }
  for(const priority of ['A','B','C']){
   assert.equal(DEMO_PRESETS[industry].materials.filter(material=>material.priority===priority).length,8);
  }
  assert.equal(COMPANY_SETUP_TEMPLATES.find(x=>x.id===industry)?.companyName,DEMO_PRESETS[industry].companyName);
  r=await perform(env,admin,'POST','/demo/activate',{scenarioId:industry,confirmation:`ACTIVATE ${industry.toUpperCase()}`});
  assert.equal(r.status,200,`${industry}: ${JSON.stringify(r.json)}`);
  assert.equal(r.json.company,DEMO_PRESETS[industry].companyName);
  assert.equal(db.prepare('SELECT seed_version FROM demo_scenario_state WHERE id=1').get().seed_version,5);
  const n=db.prepare("SELECT COUNT(*) count FROM users WHERE id LIKE 'demo-%'").get().count;
  assert.ok(n>=18);
  const docs=db.prepare("SELECT COUNT(*) count FROM supplier_accreditation_files").get().count;
  assert.equal(docs,DEMO_PRESETS[industry].suppliers.length*3);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM supplier_company_inventory').get().count,
   DEMO_PRESETS[industry].suppliers.reduce((count,supplier)=>count+
    (supplier.offeredMaterialSkus?.length??DEMO_PRESETS[industry].materials.length),0));
  assert.equal(db.prepare('SELECT COUNT(*) count FROM supplier_invoices').get().count,4);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM sourcing_deadlines').get().count,DEMO_PRESETS[industry].materials.length);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM procurement_contracts').get().count,DEMO_PRESETS[industry].suppliers.length);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM recurring_supply_plans').get().count,3);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM supply_shortage_cases').get().count,1);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM pr_approval_requests').get().count,DEMO_PRESETS[industry].materials.length);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM approval_delegations').get().count,1);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM delivery_discrepancies').get().count,3);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM verified_inventory_receipts').get().count,4);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM procurement_documents').get().count,4);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM sourcing_messages').get().count,3+DEMO_PRESETS[industry].suppliers.length-1);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM account_direct_messages').get().count,2);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM audit_evidence WHERE entity_ref=?").get(`ORG-${industry.toUpperCase()}-SETUP`).count,1);
  const contracts=db.prepare("SELECT supplier_name FROM procurement_contracts WHERE id LIKE 'ORG-%'").all().map(row=>row.supplier_name);
  assert.deepEqual(new Set(contracts),new Set(DEMO_PRESETS[industry].suppliers.map(supplier=>supplier.name)));
  const plans=db.prepare("SELECT sku,priority FROM recurring_supply_plans WHERE id LIKE 'ORG-%'").all();
  assert.deepEqual(new Set(plans.map(plan=>plan.priority)),new Set(['A','B','C']));
  assert.equal(plans.length,3);
  for(const document of db.prepare("SELECT kv_key FROM procurement_documents WHERE entity_id LIKE 'ORG-%'").all()){
   assert.ok(kv.has(document.kv_key));
   assert.equal(Buffer.from(kv.get(document.kv_key)).subarray(0,8).toString(),'%PDF-1.4');
  }
  for(const [key,bytes] of kv){if(key.includes(industry)){assert.equal(Buffer.from(bytes).subarray(0,8).toString(),'%PDF-1.4');if(process.env.TEST_PDF_EXPORT && industry==='electronics')fs.writeFileSync(process.env.TEST_PDF_EXPORT,Buffer.from(bytes));}}
  const rows=db.prepare('SELECT username,password_hash,role FROM users WHERE id LIKE \'demo-%\'').all();
  for(const user of rows){const parts=user.password_hash.split('$');const computed=crypto.pbkdf2Sync('password123',Buffer.from(parts[2],'hex'),Number(parts[1]),32,'sha256').toString('hex');assert.equal(computed,parts[3]);}
  const sample=JSON.parse(db.prepare('SELECT data FROM enterprise_state WHERE id=1').get().data);
  assert.equal(sample.requisitions.length,DEMO_PRESETS[industry].materials.length);
  assert.equal(sample.stockNeeds.length,DEMO_PRESETS[industry].materials.length);
  const expectedOfferCount=DEMO_PRESETS[industry].suppliers.reduce((count,supplier)=>count+
   (supplier.offeredMaterialSkus?.length??DEMO_PRESETS[industry].materials.length),0);
  assert.equal(sample.bids.length,expectedOfferCount);
  if(industry==='bakery'){
   const sanitationSupplier=DEMO_PRESETS.bakery.suppliers.find(supplier=>supplier.name==='PureServe Sanitation & Hygiene');
   assert.ok(!sanitationSupplier.offeredMaterialSkus.includes('BK-FLOUR'));
   assert.equal(sample.bids.filter(bid=>bid.supplierName==='PureServe Sanitation & Hygiene').length,
    sanitationSupplier.offeredMaterialSkus.length);
   assert.equal(sample.bids.length,38);
  }
  assert.equal(sample.proposalMeetings.length,3);
  assert.equal(sample.orders.length,DEMO_PRESETS[industry].suppliers.length+1);
  assert.equal(sample.deliveries.length,sample.orders.length);
  assert.equal(sample.amendments.length,1);assert.ok(sample.payments.length>2);
  assert.equal(sample.ratings.length,DEMO_PRESETS[industry].suppliers.length);
  assert.deepEqual(new Set(sample.requisitions.map(request=>request.itemTitle)),
   new Set(DEMO_PRESETS[industry].materials.map(material=>material.name)));
  assert.deepEqual(new Set(sample.stockNeeds.map(need=>need.priority)),new Set(['A','B','C']));
  assert.ok(sample.requisitions.some(request=>request.status==='Pending'));
  assert.ok(sample.requisitions.some(request=>request.status==='Rejected'));
  assert.ok(sample.bids.every(bid=>sample.stockNeeds.some(need=>need.id===bid.needId)));
  assert.ok(sample.bids.every(bid=>{
   const supplierIndex=Number(bid.supplierId.split('-').at(-1))-1;
   const material=DEMO_PRESETS[industry].materials.find(item=>
    sample.stockNeeds.find(need=>need.id===bid.needId)?.title===item.name);
   const allowed=DEMO_PRESETS[industry].suppliers[supplierIndex].offeredMaterialSkus;
   return material&&(!allowed||allowed.includes(material.sku));
  }),`${industry}: each quote must be within its supplier's product coverage`);
  assert.ok(sample.stockNeeds.every(need=>sample.bids.some(bid=>bid.needId===need.id)),
   `${industry}: every procurement need must have at least one eligible supplier`);
  assert.equal(sample.stockNeeds[0].prId,sample.requisitions[0].id);
  assert.equal(sample.requisitions[0].status,'Approved');assert.equal(sample.requisitions[1].status,'Completed');assert.equal(sample.requisitions[2].status,'Pending');
  for(const order of sample.orders){
   const need=sample.stockNeeds.find(row=>row.prId===order.prId);
   assert.ok(need,`${order.id} has a linked procurement need`);
   const winningBid=sample.bids.find(row=>row.needId===need.id&&row.supplierId===order.supplierId);
   assert.ok(winningBid,`${order.id} has a matching supplier bid`);
   assert.equal(order.bidId,winningBid.id);
   assert.equal(need.status,'Supplier Selected');
   assert.equal(need.selectedBidId,winningBid.id);
   assert.equal(winningBid.status,'Selected');
   assert.equal(sample.bids.filter(row=>row.needId===need.id&&row.status==='Selected').length,1);
  }
  const catalog=await perform(env,admin,'GET','/demo/catalog');
  assert.equal(catalog.json.materials.length,DEMO_PRESETS[industry].materials.length);
  assert.equal(catalog.json.suppliers.length,DEMO_PRESETS[industry].suppliers.length);
  assert.deepEqual(new Set(catalog.json.suppliers.map(supplier=>supplier.name)),
   new Set(DEMO_PRESETS[industry].suppliers.map(supplier=>supplier.name)));
  assert.equal(catalog.json.accounts.length,n);
  assert.equal(n,COMPANY_SETUP_TEMPLATES.find(x=>x.id===industry).departments.length*2+DEMO_PRESETS[industry].suppliers.length);
  assert.ok(catalog.json.suppliers[0].terms.payment.includes('Bank'));
  if(old){
   assert.equal(db.prepare('SELECT COUNT(*) count FROM users WHERE id LIKE ?').get(`demo-user-${old}-%`).count,0);
   assert.equal(db.prepare("SELECT COUNT(*) count FROM procurement_contracts WHERE id LIKE ?").get(`ORG-${old.toUpperCase()}-%`).count,0);
   assert.equal(db.prepare("SELECT COUNT(*) count FROM audit_evidence WHERE entity_ref=?").get(`ORG-${old.toUpperCase()}-SETUP`).count,0);
   assert.equal([...kv.keys()].filter(key=>key.includes(`demo-accreditation/${old}/`)||key.includes(`demo-procurement/${old}/`)).length,0);
  }
  old=industry;
  console.log(`PASS ${industry}: ${n} accounts, ${sample.requisitions.length} requisitions, ${sample.stockNeeds.length} sourcing needs, ${sample.bids.length} bids, ${sample.orders.length} orders and ${catalog.json.suppliers.length} suppliers`);
 }
 for(let attempt=0;attempt<2;attempt++){
  r=await perform(env,admin,'POST','/demo/activate',{scenarioId:'bakery',confirmation:'ACTIVATE BAKERY'});
  assert.equal(r.status,200,`bakery re-activation ${attempt+1}: ${JSON.stringify(r.json)}`);
 }
 assert.equal(db.prepare("SELECT COUNT(*) count FROM supply_chain_audit WHERE id LIKE 'ORG-BAKERY-SUPPLY-AUDIT-%'").get().count,1);
 assert.equal(db.prepare('SELECT COUNT(*) count FROM supplier_company_inventory').get().count,38);
 old='bakery';
 console.log('PASS repeated Bakery activation replaces generated records without duplicate audit IDs');
 // Protection: refuse to add training identities to a DB with real employee accounts.
 db.prepare("INSERT INTO users(id,username,password_hash,name,email,role,app_role,status,department,company_name,requested_position) VALUES('real-staff','real.person','hash','Real Employee','real@invalid.invalid','employee','Employee','approved','Operations','','Employee')").run();
 r=await perform(env,admin,'POST','/demo/activate',{scenarioId:'electronics',confirmation:'ACTIVATE ELECTRONICS'});
 assert.equal(r.status,409);
 const after=db.prepare('SELECT scenario_id FROM demo_scenario_state WHERE id=1').get().scenario_id;
 assert.equal(after,old);
 console.log('PASS protection: real employee blocks demo activation; current scenario preserved');
})().catch(err=>{console.error(err);process.exitCode=1;});
