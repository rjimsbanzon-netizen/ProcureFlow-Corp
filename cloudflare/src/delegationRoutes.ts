/** Time-bound approval substitution. Assigned approvers may request; Admin reviews or submits on their behalf. */
import type { D1Database } from '@cloudflare/workers-types';
import {evidenceStatement} from './auditEvidenceRoutes';
export type DelegationUser = { id:string; name:string; role:string; app_role:string; department:string; status:string; access_revoked:number };
type Context = {DB:D1Database};
type Row = Record<string,any>;
const PH_TZ='Asia/Manila';
export const philippinesToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:PH_TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const match=(a:unknown,b:unknown)=>String(a??'').trim().toLowerCase()===String(b??'').trim().toLowerCase();
const finance=(department:unknown)=>['finance & accounting','finance and accounting','finance'].some(d=>match(department,d));
const eligible=(u:Row|undefined|null)=>Boolean(u&&u.role==='employee'&&u.status==='approved'&&!u.access_revoked);
const json=(data:unknown,code=200,cors:HeadersInit={})=>new Response(JSON.stringify(data),{status:code,headers:{'Content-Type':'application/json',...cors}});
const validDate=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
export const DELEGABLE_STEPS=['Procurement Head','Operations Head','Finance Officer','Finance Head','Department Head'] as const;
const STEPS=new Set<string>(DELEGABLE_STEPS);
const isOrdinaryDepartment=(name:string)=>Boolean(name.trim())&&!['procurement','finance & accounting','finance and accounting','finance','executive'].some(d=>match(name,d));
const normalizedScope=(role:string,department:unknown)=>role==='Department Head'&&typeof department==='string'&&isOrdinaryDepartment(department)&&!match(department,'Operations')?department.trim():role==='Department Head'?null:'';

async function userById(env:Context,id:string):Promise<Row|null>{
 return env.DB.prepare('SELECT id,name,role,app_role,department,status,access_revoked FROM users WHERE id=?').bind(id).first<Row>();
}
/** Primary account is derived from the actual D1 appointment, not from an arbitrary client-supplied user ID. */
export async function principalFor(env:Context,role:string,department=''):Promise<Row|null>{
 if(role==='Department Head'){
  if(!isOrdinaryDepartment(department))return null;
  return env.DB.prepare(`SELECT u.id,u.name,u.role,u.app_role,u.department,u.status,u.access_revoked
    FROM finance_approvers a JOIN users u ON u.id=a.user_id
    WHERE a.step_role='Department Head' AND LOWER(TRIM(a.department))=LOWER(TRIM(?)) LIMIT 1`)
    .bind(department).first<Row>();
 }
 if(role==='Operations Head')return env.DB.prepare("SELECT u.id,u.name,u.role,u.app_role,u.department,u.status,u.access_revoked FROM finance_approvers a JOIN users u ON u.id=a.user_id WHERE a.step_role='Department Head' AND LOWER(TRIM(a.department))='operations' LIMIT 1").first<Row>();
 if(role==='Procurement Head'){
  const appointed=await env.DB.prepare("SELECT user_id FROM finance_approvers WHERE step_role='Department Head' AND LOWER(TRIM(department))='procurement' LIMIT 1").first<Row>();
  if(appointed?.user_id)return userById(env,appointed.user_id);
  return env.DB.prepare("SELECT id,name,role,app_role,department,status,access_revoked FROM users WHERE app_role='Procurement Head' AND status='approved' AND access_revoked=0 ORDER BY id LIMIT 1").first<Row>();
 }
 if(role==='Finance Officer')return env.DB.prepare("SELECT u.id,u.name,u.role,u.app_role,u.department,u.status,u.access_revoked FROM finance_approvers a JOIN users u ON u.id=a.user_id WHERE a.step_role='Finance Officer' AND a.department='*' LIMIT 1").first<Row>();
 if(role==='Finance Head')return env.DB.prepare("SELECT u.id,u.name,u.role,u.app_role,u.department,u.status,u.access_revoked FROM finance_approvers a JOIN users u ON u.id=a.user_id WHERE a.step_role='Department Head' AND LOWER(TRIM(a.department)) IN ('finance & accounting','finance and accounting','finance') ORDER BY a.updated_at DESC LIMIT 1").first<Row>();
 return null;
}
function validPrincipal(user:Row|null,role:string,department=''):boolean{
 if(!eligible(user))return false;
 if(role==='Operations Head')return ['Employee','Operations Head'].includes(String(user?.app_role))&&match(user?.department,'Operations');
 if(role==='Procurement Head')return user?.app_role==='Procurement Head'&&match(user?.department,'Procurement');
 if(role==='Department Head')return isOrdinaryDepartment(department)&&user?.app_role==='Employee'&&match(user?.department,department);
 return (user?.app_role==='Employee'||user?.app_role===role)&&finance(user?.department);
}
async function validDelegate(env:Context,user:Row|null,role:string,primaryId:string,department=''):Promise<boolean>{
 if(!eligible(user)||user?.id===primaryId)return false;
 if(role==='Operations Head')return user?.app_role==='Operations Officer'&&match(user?.department,'Operations');
 if(role==='Procurement Head')return user?.app_role==='Procurement Officer'&&match(user?.department,'Procurement');
 if(role==='Department Head')return user?.app_role==='Employee'&&isOrdinaryDepartment(department)&&match(user?.department,department);
 if(user?.app_role!=='Employee'||!finance(user?.department))return false;
 // Substitute Finance Officer and Finance Head may not already be appointed to the opposite sign-off.
 const conflictingRole=role==='Finance Head'?'Finance Officer':'Department Head';
 const conflict=await env.DB.prepare('SELECT 1 AS found FROM finance_approvers WHERE user_id=? AND step_role=? LIMIT 1')
  .bind(user.id,conflictingRole).first<Row>();
 return !conflict;
}
async function verifyFinanceSeparation(env:Context,role:string,delegateId:string,startsOn:string,endsOn:string):Promise<string|null>{
 if(role!=='Finance Officer'&&role!=='Finance Head')return null;
 const opposite=role==='Finance Head'?'Finance Officer':'Finance Head';
 const counterpart=await principalFor(env,opposite);
 if(counterpart?.id===delegateId)return 'Finance Head and Finance Officer must be separate people.';
 const other=await env.DB.prepare(`SELECT id FROM approval_delegations WHERE delegate_user_id=? AND step_role=?
    AND review_status='Approved' AND revoked_at IS NULL AND starts_on<=? AND ends_on>=? LIMIT 1`)
  .bind(delegateId,opposite,endsOn,startsOn).first<Row>();
 return other?'Substitute already holds the opposite Finance duty during these dates.':null;
}
async function overlapping(env:Context,role:string,department:string,startsOn:string,endsOn:string,excludeId?:string):Promise<boolean>{
 const found=await env.DB.prepare(`SELECT id FROM approval_delegations WHERE step_role=? AND LOWER(TRIM(department))=LOWER(TRIM(?)) AND revoked_at IS NULL
   AND review_status IN ('Pending','Approved') AND starts_on<=? AND ends_on>=? AND id<>? LIMIT 1`)
   .bind(role,department,endsOn,startsOn,excludeId??'').first<Row>();
 return Boolean(found);
}
/** Prevent cross-role approval cycles (A delegates to B, B to C, C to A), including overlapping pending requests. */
async function createsDelegationCycle(env:Context,primary:string,delegate:string,startsOn:string,endsOn:string,excludeId=''):Promise<boolean>{
 if(primary===delegate)return true;
 const matches=(await env.DB.prepare(`SELECT primary_user_id,delegate_user_id FROM approval_delegations
    WHERE revoked_at IS NULL AND review_status IN ('Pending','Approved')
      AND starts_on<=? AND ends_on>=? AND id<>?`)
  .bind(endsOn,startsOn,excludeId).all<{primary_user_id:string;delegate_user_id:string}>()).results;
 const graph=new Map<string,string[]>();
 for(const edge of matches){
  if(!graph.has(edge.primary_user_id))graph.set(edge.primary_user_id,[]);
  graph.get(edge.primary_user_id)!.push(edge.delegate_user_id);
 }
 // New edge primary -> delegate; if delegate can already reach primary, it forms a cycle.
 const seen=new Set<string>(),queue=[delegate];
 while(queue.length){const next=queue.shift()!;if(next===primary)return true;
  if(seen.has(next))continue;seen.add(next);
  for(const id of graph.get(next)||[])if(!seen.has(id))queue.push(id);
 }
 return false;
}
/** Called at sign-off time: pending/rejected requests NEVER grant approval access. */
export async function actingDelegation(env:Context,user:DelegationUser,role:string,department=''):Promise<Row|null>{
 if(!STEPS.has(role))return null;
 const scope=normalizedScope(role,department);
 if(scope===null)return null;
 const today=philippinesToday();
 const entry=await env.DB.prepare(`SELECT * FROM approval_delegations WHERE step_role=? AND LOWER(TRIM(department))=LOWER(TRIM(?)) AND delegate_user_id=?
  AND review_status='Approved' AND revoked_at IS NULL AND starts_on<=? AND ends_on>=? ORDER BY created_at DESC LIMIT 1`)
  .bind(role,scope,user.id,today,today).first<Row>();
 if(!entry)return null;
 const primary=await principalFor(env,role,scope);
 if(!primary||primary.id!==entry.primary_user_id||!validPrincipal(primary,role,scope))return null;
 const delegate=await userById(env,user.id);
 if(!await validDelegate(env,delegate,role,primary.id,scope))return null;
 if(await verifyFinanceSeparation(env,role,user.id,today,today))return null;
 return entry;
}
export async function handleDelegationRoutes(request:Request,env:Context,user:DelegationUser,cors:HeadersInit):Promise<Response|null>{
 const path=new URL(request.url).pathname;
 if(!path.startsWith('/delegations'))return null;
 const admin=user.role==='admin';
 if(!admin&&!eligible(user))return json({error:'Only active staff approvers or Admin may use approval delegation.'},403,cors);

 // Admin-only account-level access overview. It reports validated, effective
 // responsibilities, NOT a new authorization mechanism. Every sensitive action
 // continues to be checked by its own secured workflow endpoint.
 if(path==='/delegations/effective-access'&&request.method==='GET'){
  if(!admin)return json({error:'Admin access is required.'},403,cors);
  const accounts=(await env.DB.prepare(`SELECT id,username,name,role,app_role,department,status,access_revoked
    FROM users ORDER BY name COLLATE NOCASE`).all<Row>()).results;
  const appointments=(await env.DB.prepare(`SELECT a.user_id,a.step_role,a.department
    FROM finance_approvers a`).all<Row>()).results;
  const today=philippinesToday();
  const candidateDelegations=(await env.DB.prepare(`SELECT id,delegate_user_id,primary_user_id,step_role,department,
    starts_on,ends_on FROM approval_delegations
    WHERE review_status='Approved' AND revoked_at IS NULL AND starts_on<=? AND ends_on>=?`)
    .bind(today,today).all<Row>()).results;
  const active=new Map<string,Row[]>();
  // A date-matching record is not sufficient: the principal must still be
  // appointed, and the substitute must still meet all security rules.
  for(const record of candidateDelegations){
   const target=accounts.find(a=>a.id===record.delegate_user_id);
   if(!target||!eligible(target))continue;
   const scope=record.step_role==='Department Head'?String(record.department):'';
   const valid=await actingDelegation(env,target as DelegationUser,record.step_role,scope);
   if(valid?.id!==record.id)continue;
   const list=active.get(target.id)??[];list.push(record);active.set(target.id,list);
  }
  const describe=(role:string,department:string)=>role==='Department Head'
   ?`Submit requisitions for ${department} only`
   :role==='Operations Head'?'Submit Operations requisitions for the appointed Head; no approval power':role==='Procurement Head'?'Approve the assigned Procurement Head requisition step'
   :role==='Finance Officer'?'Finance Officer requisition review, invoice matching and payment below the Finance Head threshold'
   :'Finance Head sign-off and high-value payment at or above the threshold';
  const result=accounts.map(account=>{
   const usable=account.status==='approved'&&!account.access_revoked;
   const base=account.role==='admin'?'Admin':account.role==='guest'?'Supplier':
     account.app_role==='Procurement Head'?'Procurement Head':
     account.app_role==='Procurement Officer'?'Procurement Officer':account.app_role==='Operations Officer'?'Operations Officer':'Employee';
   const roles:Row[]=[{role:base,source:'Account role',department:account.department??'',startsOn:null,endsOn:null,
     capability:'Permanent account role; detailed rights come from the Access Control matrix.'}];
   if(usable&&account.role==='employee'){
    const mine=appointments.filter(a=>a.user_id===account.id);
    const financeHead=mine.some(a=>a.step_role==='Department Head'&&finance(a.department)&&finance(account.department));
    const financeOfficer=mine.some(a=>a.step_role==='Finance Officer'&&a.department==='*'&&finance(account.department));
    if(account.app_role==='Employee'&&!(financeHead&&financeOfficer)){
     for(const duty of mine){
      let position:string|null=null;
      if(duty.step_role==='Finance Officer'&&financeOfficer)position='Finance Officer';
      else if(duty.step_role==='Department Head'&&finance(duty.department)&&financeHead)position='Finance Head';
      else if(duty.step_role==='Department Head'&&isOrdinaryDepartment(duty.department)&&match(account.department,duty.department))position='Department Head';
      if(position)roles.push({role:position,source:'Staff appointment',department:position==='Department Head'?duty.department:'Finance & Accounting',startsOn:null,endsOn:null,capability:describe(position,duty.department)});
     }
    }
    for(const duty of active.get(account.id)??[])roles.push({role:duty.step_role,source:'Active delegation',department:duty.department??'',startsOn:duty.starts_on,endsOn:duty.ends_on,capability:describe(duty.step_role,duty.department)});
   }
   return {id:account.id,username:account.username,name:account.name,department:account.department,
    accountRole:base,status:account.status,accessRevoked:Boolean(account.access_revoked),
    active:usable,roles:usable?roles:[]};
  });
  return json({asOf:today,accounts:result},200,cors);
 }

 if(path==='/delegations'&&request.method==='GET'){
  const rows=(await env.DB.prepare(`SELECT d.*,p.name AS primary_name,g.name AS delegate_name,
    c.name AS submitted_by_name FROM approval_delegations d
    JOIN users p ON p.id=d.primary_user_id JOIN users g ON g.id=d.delegate_user_id
    LEFT JOIN users c ON c.id=d.created_by ORDER BY d.created_at DESC`).all<Row>()).results;
  const visible=admin?rows:rows.filter(row=>row.primary_user_id===user.id||row.delegate_user_id===user.id);
  const activeRoles:string[]=[];
  for(const role of DELEGABLE_STEPS)if(role!=='Department Head'&&await actingDelegation(env,user,role))activeRoles.push(role);
  const departmentAppointments=(await env.DB.prepare(`SELECT DISTINCT department FROM finance_approvers WHERE step_role='Department Head' ORDER BY department`).all<Row>()).results
    .map(row=>String(row.department)).filter(isOrdinaryDepartment);
  // Include Human Resources in Admin's delegation selector even when its
  // Head has not yet been formally appointed. A missing appointment remains
  // ineligible; the Worker will never create a delegation for a null principal.
  if(admin&&!departmentAppointments.some(name=>match(name,'Human Resources')))
    departmentAppointments.push('Human Resources');
  const activeDepartments:string[]=[];
  for(const department of departmentAppointments.filter(dep=>!match(dep,'Operations')))if(await actingDelegation(env,user,'Department Head',department))activeDepartments.push(department);
  const principalRecords=[...await Promise.all(DELEGABLE_STEPS.filter(role=>role!=='Department Head').map(async role=>({role,department:'',user:await principalFor(env,role)}))),
    ...await Promise.all(departmentAppointments.filter(dep=>!match(dep,'Operations')).map(async department=>({role:'Department Head',department,user:await principalFor(env,'Department Head',department)})))];
  const principals=admin?principalRecords:principalRecords.filter(x=>x.user?.id===user.id);
  const canRequest=admin||principals.length>0;
  const staff=canRequest?(await env.DB.prepare("SELECT id,name,role,app_role,department,status,access_revoked FROM users WHERE status='approved' AND access_revoked=0 AND role='employee' ORDER BY name").all<Row>()).results:[];
  // Use exactly the same eligibility rule as POST /delegations. The old UI
  // independently guessed which accounts qualified and could be misleading.
  // Keep primary/department appointments authoritative and never permit
  // the principal to choose themselves as the substitute.
  const principalsWithEligibility=await Promise.all(principals.map(async assignment=>{
    if(!assignment.user||!validPrincipal(assignment.user,assignment.role,assignment.department))
      return {...assignment,eligibleStaffIds:[] as string[]};
    const ids=await Promise.all(staff.map(async candidate=>(
      await validDelegate(env,candidate,assignment.role,assignment.user!.id,assignment.department)
    )?String(candidate.id):null));
    return {...assignment,eligibleStaffIds:ids.filter((id):id is string=>id!==null)};
  }));
  return json({delegations:visible,activeRoles,activeDepartments,staff,principals:principalsWithEligibility,canRequest},200,cors);
 }

 if(path==='/delegations'&&request.method==='POST'){
  const body=await request.json() as Row;
  if(!STEPS.has(body.stepRole)||!validDate(body.startsOn)||!validDate(body.endsOn)||
   body.startsOn>body.endsOn||body.endsOn<philippinesToday()||
   !['Leave','Delegation'].includes(body.requestKind)||typeof body.delegateUserId!=='string'||
   typeof body.reason!=='string'||body.reason.trim().length<5||body.reason.length>500)
   return json({error:'Select your assigned approval responsibility, leave/delegation type, substitute, valid dates, and a reason (5–500 characters).'},400,cors);
  const scope=normalizedScope(body.stepRole,body.department);
  if(scope===null)return json({error:'Select a valid department-specific delegation responsibility.'},400,cors);
  const primary=await principalFor(env,body.stepRole,scope);
  if(!validPrincipal(primary,body.stepRole,scope))return json({error:'No active, appointed account holds this approval responsibility.'},409,cors);
  // The only non-Admin who can submit is the currently appointed primary approver.
  if(!admin&&primary!.id!==user.id)return json({error:'Only the assigned approver may submit this request. Admin may submit on their behalf.'},403,cors);
  const delegate=await userById(env,body.delegateUserId);
  if(!await validDelegate(env,delegate,body.stepRole,primary!.id,scope))
   return json({error:'Select an eligible substitute for this approval responsibility. Finance sign-offs must stay separate.'},403,cors);
  const conflict=await verifyFinanceSeparation(env,body.stepRole,delegate!.id,body.startsOn,body.endsOn);
  if(conflict)return json({error:conflict},409,cors);
  if(await createsDelegationCycle(env,primary!.id,delegate!.id,body.startsOn,body.endsOn))
   return json({error:'This delegation would create a circular approval chain. Choose another eligible substitute.'},409,cors);
  if(await overlapping(env,body.stepRole,scope,body.startsOn,body.endsOn))
   return json({error:'An overlapping pending or approved delegation exists for these dates. Resolve it before submitting another.'},409,cors);
  const id=crypto.randomUUID(),now=new Date().toISOString();
  const status=admin?'Approved':'Pending';
  // Atomic condition prevents overlapping submissions that arrive concurrently.
  const saved=await env.DB.prepare(`INSERT INTO approval_delegations
   (id,step_role,department,primary_user_id,delegate_user_id,starts_on,ends_on,reason,created_by,created_at,request_kind,review_status,reviewed_by,reviewed_at)
   SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (
     SELECT 1 FROM approval_delegations WHERE step_role=? AND LOWER(TRIM(department))=LOWER(TRIM(?)) AND revoked_at IS NULL
       AND review_status IN ('Pending','Approved') AND starts_on<=? AND ends_on>=?)`)
   .bind(id,body.stepRole,scope,primary!.id,delegate!.id,body.startsOn,body.endsOn,body.reason.trim(),user.id,now,
    body.requestKind,status,admin?user.id:null,admin?now:null,body.stepRole,scope,body.endsOn,body.startsOn).run();
  if(saved.meta.changes!==1)return json({error:'Another delegation was submitted for overlapping dates. Refresh and review the register.'},409,cors);
  await evidenceStatement(env,user,'approval_delegations',id,'Requested',null,{stepRole:body.stepRole,department:scope,primaryId:primary!.id,delegateId:delegate!.id,startsOn:body.startsOn,endsOn:body.endsOn,requestKind:body.requestKind,status}).run();
  return json({ok:true,id,status},201,cors);
 }

 const decision=path.match(/^\/delegations\/([^/]+)\/decision$/);
 if(decision&&request.method==='POST'){
  if(!admin)return json({error:'Only Admin may approve or reject delegation requests.'},403,cors);
  const id=decodeURIComponent(decision[1]);
  const body=await request.json() as Row;
  if(!['approve','reject'].includes(body.decision)||typeof body.note!=='string'||body.note.length>500||
   (body.decision==='reject'&&body.note.trim().length<3))
   return json({error:'Select Approve or Reject and provide a rejection reason (3–500 characters).'},400,cors);
  const entry=await env.DB.prepare('SELECT * FROM approval_delegations WHERE id=?').bind(id).first<Row>();
  if(!entry||entry.review_status!=='Pending'||entry.revoked_at)return json({error:'This request is no longer pending. Refresh the delegation register.'},409,cors);
  const now=new Date().toISOString();
  if(body.decision==='approve'){
   if(entry.ends_on<philippinesToday())return json({error:'The requested dates have passed. Submit a new request.'},409,cors);
   const primary=await principalFor(env,entry.step_role,entry.department);
   if(!validPrincipal(primary,entry.step_role,entry.department)||primary?.id!==entry.primary_user_id)
    return json({error:'The assigned primary approver has changed or is inactive. Submit a new request.'},409,cors);
   const delegate=await userById(env,entry.delegate_user_id);
   if(!await validDelegate(env,delegate,entry.step_role,entry.primary_user_id,entry.department))
    return json({error:'The proposed substitute is no longer eligible.'},409,cors);
   const conflict=await verifyFinanceSeparation(env,entry.step_role,entry.delegate_user_id,entry.starts_on,entry.ends_on);
   if(conflict)return json({error:conflict},409,cors);
   if(await createsDelegationCycle(env,entry.primary_user_id,entry.delegate_user_id,entry.starts_on,entry.ends_on,id))
    return json({error:'Approval would create a circular delegation chain.'},409,cors);
   // The conditional update prevents simultaneously approving overlapping pending requests.
   const saved=await env.DB.prepare(`UPDATE approval_delegations SET review_status='Approved',reviewed_by=?,reviewed_at=?,review_note=?
    WHERE id=? AND review_status='Pending' AND revoked_at IS NULL AND NOT EXISTS (
    SELECT 1 FROM approval_delegations other WHERE other.id<>? AND other.step_role=approval_delegations.step_role
    AND LOWER(TRIM(other.department))=LOWER(TRIM(approval_delegations.department)) AND other.review_status='Approved' AND other.revoked_at IS NULL
    AND other.starts_on<=approval_delegations.ends_on AND other.ends_on>=approval_delegations.starts_on)`)
    .bind(user.id,now,body.note.trim(),id,id).run();
   if(saved.meta.changes!==1)return json({error:'Approval conflict or request already reviewed. Refresh and retry.'},409,cors);
  }else{
   const saved=await env.DB.prepare("UPDATE approval_delegations SET review_status='Rejected',reviewed_by=?,reviewed_at=?,review_note=? WHERE id=? AND review_status='Pending' AND revoked_at IS NULL")
    .bind(user.id,now,body.note.trim(),id).run();
   if(saved.meta.changes!==1)return json({error:'Request already reviewed. Refresh the register.'},409,cors);
  }
  await evidenceStatement(env,user,'approval_delegations',id,body.decision==='approve'?'Approved':'Rejected',
    {status:'Pending',primaryId:entry.primary_user_id,delegateId:entry.delegate_user_id,stepRole:entry.step_role},
    {status:body.decision==='approve'?'Approved':'Rejected',reviewedBy:user.id,reviewedAt:now,note:body.note.trim()}).run();
  return json({ok:true,status:body.decision==='approve'?'Approved':'Rejected'},200,cors);
 }

 const revoke=path.match(/^\/delegations\/([^/]+)\/revoke$/);
 if(revoke&&request.method==='POST'){
  const id=decodeURIComponent(revoke[1]);
  const entry=await env.DB.prepare('SELECT * FROM approval_delegations WHERE id=?').bind(id).first<Row>();
  if(!entry||!['Pending','Approved'].includes(entry.review_status)||entry.revoked_at)
   return json({error:'Request is already closed or not found.'},409,cors);
  if(!admin&&entry.primary_user_id!==user.id)return json({error:'Only Admin or the assigned primary approver can cancel or revoke this delegation.'},403,cors);
  const now=new Date().toISOString();
  const result=entry.review_status==='Pending'
   ?await env.DB.prepare("UPDATE approval_delegations SET review_status='Cancelled',reviewed_at=?,reviewed_by=? WHERE id=? AND review_status='Pending' AND revoked_at IS NULL").bind(now,user.id,id).run()
   :await env.DB.prepare("UPDATE approval_delegations SET revoked_at=?,revoked_by=? WHERE id=? AND review_status='Approved' AND revoked_at IS NULL").bind(now,user.id,id).run();
  if(result.meta.changes!==1)return json({error:'Request changed while you were editing. Refresh and retry.'},409,cors);
  await evidenceStatement(env,user,'approval_delegations',id,entry.review_status==='Pending'?'Cancelled':'Revoked',
    {status:entry.review_status,primaryId:entry.primary_user_id,delegateId:entry.delegate_user_id},
    {status:entry.review_status==='Pending'?'Cancelled':'Revoked',at:now,actor:user.id}).run();
  return json({ok:true,status:entry.review_status==='Pending'?'Cancelled':'Revoked'},200,cors);
 }
 return json({error:'Delegation action not supported.'},404,cors);
}
