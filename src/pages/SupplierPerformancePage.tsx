import { LoadingState } from '../components/FeedbackState';
import {useEffect,useMemo,useState} from 'react';
import {cloudRequest,CLOUD_API_BASE} from '../services/cloud';
import {getCurrentPermissionRole} from '../domain/permissions';
import {showToast} from '../services/toast';

type Price={id:string;date:string;item:string;price:number;source:string};
type Supplier={id:string;name:string;orderCount:number;inspectedCount:number;rejectedCount:number;verifiedCount:number;datedCount:number;onTimeCount:number;onTimeRate:number|null;rejectionRate:number|null;avgRating:number|null;ratingCount:number;priceHistory:Price[]};
type Payload={suppliers:Supplier[];definitions:{onTime:string;rejection:string;pricing:string}};
const fmt=(x:number)=>`₱${x.toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const pct=(n:number|null)=>n===null?'Insufficient data':`${n.toFixed(1)}%`;
const safe=(v:unknown)=>String(v??'').replace(/^[=+@\-]/,'\'$&');
function saveCsv(supplier:Supplier,rows:Price[]){
 const table=[['Supplier','Date','Item / Requirement','Type','Reference','Unit price (PHP)'],...rows.map(p=>[supplier.name,p.date,p.item,p.source,p.id,p.price.toFixed(2)])];
 const csv='\uFEFF'+table.map(line=>line.map(value=>'"'+safe(value).replaceAll('"','""')+'"').join(',')).join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download='supplier-price-history.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function PriceTrend({rows}:{rows:Price[]}){
 if(rows.length===0)return <div className="p-8 text-center text-slate-500 text-sm">No recorded prices for this item and price type.</div>;
 if(rows.length===1)return <div className="p-8 text-center text-slate-600 text-sm">Only one data point: <strong>{fmt(rows[0].price)}</strong> on {rows[0].date}. Add later transactions to see a trend.</div>;
 const width=650,height=190,left=55,top=18,area=height-42;
 const amounts=rows.map(p=>p.price),min=Math.min(...amounts),max=Math.max(...amounts),span=max-min||1;
 const points=rows.map((p,i)=>[left+i*(width-left-20)/(rows.length-1),top+(max-p.price)/span*(area-20)] as const);
 return <div className="w-full overflow-x-auto"><svg role="img" aria-label="Recorded prices over time; individual values are listed below" viewBox={`0 0 ${width} ${height}`} className="min-w-[360px] w-full h-auto">
   {[0,0.5,1].map((v,i)=><g key={i}><line x1={left} x2={width-20} y1={top+v*(area-20)} y2={top+v*(area-20)} stroke="#e2e8f0"/><text x={left-6} y={top+v*(area-20)+4} textAnchor="end" fontSize="10" fill="#64748b">{fmt(max-v*span)}</text></g>)}
   <polyline fill="none" stroke="#a64f32" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={points.map(p=>p.join(',')).join(' ')}/>
   {points.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="4" fill="#a64f32"><title>{rows[i].date}: {fmt(rows[i].price)} · {rows[i].id}</title></circle>)}
   <text x={left} y={height-6} fill="#64748b" fontSize="11">{rows[0].date}</text><text x={width-20} y={height-6} fill="#64748b" fontSize="11" textAnchor="end">{rows.at(-1)?.date}</text>
 </svg></div>;
}
export default function SupplierPerformancePage(){
 const [data,setData]=useState<Payload|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [selected,setSelected]=useState(''),[item,setItem]=useState(''),[kind,setKind]=useState('Awarded PO');
 const load=async()=>{setLoading(true);setError('');try{
  if(!CLOUD_API_BASE)throw new Error('Supplier performance requires a connection to the Cloudflare API.');
  const result=await cloudRequest('/analytics/suppliers') as Payload;
  setData(result);setSelected(old=>result.suppliers.some(s=>s.id===old)?old:(result.suppliers[0]?.id||''));
 }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setLoading(false)}};
 useEffect(()=>{void load()},[]);
 const supplier=data?.suppliers.find(s=>s.id===selected)||null;
 const totalOrders=data?.suppliers.reduce((sum,s)=>sum+s.orderCount,0)||0;
 const items=useMemo(()=>[...new Set(supplier?.priceHistory.map(p=>p.item)||[])].sort(),[supplier]);
 const rows=useMemo(()=>supplier?.priceHistory.filter(p=>(!item||p.item===item)&&p.source===kind)||[],[supplier,item,kind]);
 const role=getCurrentPermissionRole();
 const canCompare=['Admin','Procurement Head','Procurement Officer'].includes(role||'');
 return <section className="mx-auto max-w-7xl space-y-5">
 <header className="bg-white border rounded-xl p-5 flex justify-between gap-3 items-start flex-wrap"><div><h2 className="text-xl font-bold text-slate-900">Supplier Performance Analytics</h2><p className="text-sm text-slate-500 mt-1">Delivery reliability, inspected quality, supplier ratings and recorded pricing over time</p></div><button onClick={()=>void load()} disabled={loading} className="border rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60">{loading?'Loading…':'Refresh analytics'}</button></header>
 {error&&<p className="border border-rose-200 bg-rose-50 p-4 rounded-lg text-rose-800" role="alert">{error}</p>}
 {loading && !data && !error && <LoadingState title="Loading supplier performance" description="Calculating delivery reliability, quality rejection rates, and pricing history…" />}
 {data&&<>
 {canCompare&&<div className="grid grid-cols-2 lg:grid-cols-3 gap-3" aria-label="Supplier analytics summary"><div className="bg-white border rounded-xl p-4"><p className="text-xs text-slate-500">Suppliers with activity</p><p className="text-xl md:text-2xl font-bold text-slate-900 mt-1">{data.suppliers.length}</p></div><div className="bg-white border rounded-xl p-4"><p className="text-xs text-slate-500">Recorded purchase orders</p><p className="text-xl md:text-2xl font-bold text-slate-900 mt-1">{totalOrders}</p></div><div className="col-span-2 lg:col-span-1 bg-white border rounded-xl p-4"><p className="text-xs text-slate-500">Measurement coverage</p><p className="text-sm font-semibold mt-1 text-slate-800">Rates use inspected or dated deliveries only</p></div></div>}
 {canCompare&&<label className="md:hidden block bg-white border rounded-xl p-4 text-sm font-semibold text-slate-700">Choose supplier for mobile review<select value={selected} onChange={e=>{setSelected(e.target.value);setItem('')}} className="block mt-2 w-full border rounded-lg px-3 py-3 bg-white text-base font-normal">{data.suppliers.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>}
 {canCompare&&<div className="bg-white border rounded-xl overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{['Supplier','Purchase orders','On-time deliveries','Quality rejection rate','Verified deliveries','Average rating'].map(h=><th key={h} className="p-3 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{data.suppliers.map(s=><tr key={s.id} onClick={()=>{setSelected(s.id);setItem('')}} className={`cursor-pointer border-t hover:bg-[#fdf7f3] ${selected===s.id?'bg-orange-50':''}`}><td className="p-3 font-semibold">{s.name}</td><td className="p-3">{s.orderCount}</td><td className="p-3">{pct(s.onTimeRate)} <span className="text-xs text-slate-400">({s.onTimeCount}/{s.datedCount})</span></td><td className="p-3">{pct(s.rejectionRate)} <span className="text-xs text-slate-400">({s.rejectedCount}/{s.inspectedCount})</span></td><td className="p-3">{s.verifiedCount}</td><td className="p-3">{s.avgRating===null?'Not rated':`${s.avgRating.toFixed(1)} / 5`} </td></tr>)}</tbody></table>{!data.suppliers.length&&<p className="p-5 text-slate-500">No supplier transactions recorded.</p>}</div>}
 {supplier&&<><div className="rounded-xl bg-[#fff8f2] border border-[#ead5c9] px-4 py-3 text-sm text-[#873e27]">{supplier.name} has {supplier.orderCount} recorded purchase orders, {supplier.inspectedCount} inspected deliveries and {supplier.ratingCount} ratings. Percentages are based only on records with enough data.</div><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[['Purchase orders',String(supplier.orderCount)],['On-time rate',pct(supplier.onTimeRate)],['Quality rejection rate',pct(supplier.rejectionRate)],['Average supplier rating',supplier.avgRating===null?'Not rated':`${supplier.avgRating.toFixed(1)} / 5`]].map(([label,value])=><div key={label} className="bg-white border rounded-xl p-4"><p className="text-xs text-slate-500">{label}</p><p className="text-lg font-bold mt-2 text-slate-900">{value}</p></div>)}</div>
 <section className="bg-white border rounded-xl p-5 space-y-4"><div className="flex justify-between flex-wrap gap-2 items-start"><div><h3 className="font-bold text-slate-900">Pricing history · {supplier.name}</h3><p className="text-xs text-slate-500">Filter by an individual item and quotation type for meaningful price comparisons.</p></div><button type="button" onClick={()=>{saveCsv(supplier,rows);showToast('Filtered pricing history downloaded.','success')}} className="border rounded-lg px-3 py-2 text-sm font-semibold"><i className="fa-solid fa-file-csv mr-2"/>Export CSV</button></div>
 <div className="grid sm:grid-cols-2 gap-3"><label className="text-sm font-semibold text-slate-700">Item / Requirement<select value={item} onChange={e=>setItem(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal"><option value="">All items (not comparable)</option>{items.map(v=><option key={v} value={v}>{v}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Price type<select value={kind} onChange={e=>setKind(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal"><option>Awarded PO</option><option>Submitted bid</option></select></label></div>
 {item?<PriceTrend rows={rows}/>:<div className="p-5 rounded-lg bg-amber-50 text-amber-900 text-sm">Select a specific item to compare its prices over time. The table below shows all {kind.toLowerCase()} records.</div>}
 <div className="overflow-x-auto max-h-72"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{['Date','Reference','Item','Source','Unit price'].map(h=><th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{rows.map(p=><tr key={p.source+p.id} className="border-t"><td className="p-3 whitespace-nowrap">{p.date}</td><td className="p-3 font-semibold">{p.id}</td><td className="p-3">{p.item}</td><td className="p-3">{p.source}</td><td className="p-3 whitespace-nowrap">{fmt(p.price)}</td></tr>)}</tbody></table>{!rows.length&&<p className="p-5 text-slate-500 text-sm">No matching recorded prices.</p>}</div></section></>}
 <p className="text-xs leading-relaxed text-slate-500">Methodology: {data.definitions.onTime} {data.definitions.rejection} {data.definitions.pricing} Rates are N/A when there are no qualifying records.</p>
 </>}
 </section>;
}
