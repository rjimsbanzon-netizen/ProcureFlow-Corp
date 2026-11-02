/** Authenticated, server-owned change evidence with Admin-only review and export. */
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
type Row=Record<string,any>;
type Env={DB:D1Database};
type User={id:string;name:string;role:string;app_role:string};
const reply=(value:unknown,status=200,cors:HeadersInit={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors}});
const collections=['stockNeeds','bids','proposalMeetings','requisitions','orders','deliveries','amendments','payments','suppliers','ratings'];
const scrub=(input:unknown):unknown=>{
  if(Array.isArray(input))return input.slice(0,25).map(scrub);
  if(!input||typeof input!=='object')return typeof input==='string'?input.slice(0,600):input;
  return Object.fromEntries(Object.entries(input).filter(([key])=>
    !/password|token|secret|attachment|document|filecontent|blob|base64|authorization|signature|contentdata|resetcode/i.test(key))
    .slice(0,40).map(([key,val])=>[key,scrub(val)]));
};
const serial=(v:unknown)=>v===undefined?null:JSON.stringify(scrub(v)).slice(0,5000);
export function evidenceStatement(env:Env,user:User,entityType:string,entityRef:string,action:string,before:unknown,after:unknown):D1PreparedStatement{
  return env.DB.prepare(`INSERT INTO audit_evidence
    (id,occurred_at,actor_id,actor_name,actor_role,entity_type,entity_ref,action,before_json,after_json)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),new Date().toISOString(),user.id,user.name,user.app_role||user.role,
    entityType.slice(0,80),entityRef.slice(0,160),action.slice(0,80),serial(before),serial(after));
}
/** Bounded per-record audit entries, generated from the persisted data, not client auditLogs. */
export function snapshotEvidence(env:Env,user:User,previous:Row,next:Row):D1PreparedStatement[]{
  const events:D1PreparedStatement[]=[];
  let ignored=0;
  for(const collection of collections){
    const oldList=Array.isArray(previous[collection])?previous[collection] as Row[]:[];
    const newList=Array.isArray(next[collection])?next[collection] as Row[]:[];
    const oldMap=new Map(oldList.filter(row=>row&&row.id).map(row=>[String(row.id),row]));
    const newMap=new Map(newList.filter(row=>row&&row.id).map(row=>[String(row.id),row]));
    const ids=new Set([...oldMap.keys(),...newMap.keys()]);
    for(const id of ids){
      const before=oldMap.get(id),after=newMap.get(id);
      if(before&&after&&JSON.stringify(before)===JSON.stringify(after))continue;
      const action=!before?'Created':!after?'Deleted':'Updated';
      if(events.length>=45){ignored++;continue;}
      events.push(evidenceStatement(env,user,collection,id,action,before,after));
    }
  }
  if(ignored)events.push(evidenceStatement(env,user,'enterprise_state','bulk-update','Additional records changed',null,{omittedChanges:ignored,reason:'Audit detail capped at 45 records per save. See source records for remaining changes.'}));
  return events;
}
export async function handleAuditEvidenceRoutes(request:Request,env:Env,user:User,cors:HeadersInit):Promise<Response|null>{
  const url=new URL(request.url),path=url.pathname;
  if(!path.startsWith('/audit-evidence'))return null;
  if(user.role!=='admin')return reply({error:'Admin access required.'},403,cors);
  if(path==='/audit-evidence'&&request.method==='GET'){
    const q=(url.searchParams.get('q')||'').trim().slice(0,120);
    const status=url.searchParams.get('status')||'All';
    if(!['All','Unreviewed','Reviewed','Flagged'].includes(status))return reply({error:'Invalid review status.'},400,cors);
    const since=url.searchParams.get('from')||'',until=url.searchParams.get('to')||'';
    if((since&&!/^\d{4}-\d{2}-\d{2}$/.test(since))||(until&&!/^\d{4}-\d{2}-\d{2}$/.test(until)))return reply({error:'Invalid date filters.'},400,cors);
    const limit=Math.min(100,Math.max(1,Number(url.searchParams.get('limit'))||50));
    const offset=Math.min(100000,Math.max(0,Number(url.searchParams.get('offset'))||0));
    const terms:string[]=[];const bind:any[]=[];
    if(status!=='All'){terms.push('review_state=?');bind.push(status);}
    if(since){terms.push('occurred_at >= ?');bind.push(since+'T00:00:00');}
    if(until){terms.push('occurred_at < ?');bind.push(new Date(Date.parse(until+'T00:00:00Z')+86400000).toISOString().slice(0,10)+'T00:00:00');}
    if(q){terms.push('(entity_ref LIKE ? OR entity_type LIKE ? OR actor_name LIKE ? OR action LIKE ?)');bind.push(...Array(4).fill('%'+q.replace(/[%_]/g,'')+'%'));}
    const where=terms.length?' WHERE '+terms.join(' AND '):'';
    const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM audit_evidence'+where).bind(...bind).first<{n:number}>();
    const records=(await env.DB.prepare('SELECT * FROM audit_evidence'+where+' ORDER BY occurred_at DESC, id DESC LIMIT ? OFFSET ?').bind(...bind,limit,offset).all<Row>()).results;
    return reply({records,total:count?.n??0,limit,offset},200,cors);
  }
  const match=path.match(/^\/audit-evidence\/([a-f0-9-]+)\/review$/i);
  if(match&&request.method==='PUT'){
    const body=await request.json() as Row;
    if(!['Unreviewed','Reviewed','Flagged'].includes(body.status)||typeof body.note!=='string'||body.note.trim().length>1000||
      (body.status==='Flagged'&&!body.note.trim()))return reply({error:'Choose a review decision and provide a note when flagging an event.'},400,cors);
    const old=await env.DB.prepare('SELECT id,review_state FROM audit_evidence WHERE id=?').bind(match[1]).first<{id:string;review_state:string}>();
    if(!old)return reply({error:'Evidence record not found.'},404,cors);
    const at=new Date().toISOString(),note=body.note.trim();
    const result=await env.DB.batch([
      env.DB.prepare('UPDATE audit_evidence SET review_state=?,review_note=?,reviewer_id=?,reviewed_at=? WHERE id=? AND review_state=?')
        .bind(body.status,note,user.id,at,old.id,old.review_state),
      env.DB.prepare(`INSERT INTO audit_evidence_reviews(id,evidence_id,reviewer_id,old_state,new_state,note,recorded_at)
        SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM audit_evidence WHERE id=? AND reviewed_at=? AND reviewer_id=?)`)
        .bind(crypto.randomUUID(),old.id,user.id,old.review_state,body.status,note,at,old.id,at,user.id)
    ]);
    if(result[0].meta.changes!==1)return reply({error:'This event was just reviewed by another account. Refresh the page.'},409,cors);
    return reply({ok:true},200,cors);
  }
  const history=path.match(/^\/audit-evidence\/([a-f0-9-]+)\/reviews$/i);
  if(history&&request.method==='GET'){
    const records=(await env.DB.prepare('SELECT * FROM audit_evidence_reviews WHERE evidence_id=? ORDER BY recorded_at DESC').bind(history[1]).all<Row>()).results;
    return reply({reviews:records},200,cors);
  }
  return reply({error:'Route not found.'},404,cors);
}
