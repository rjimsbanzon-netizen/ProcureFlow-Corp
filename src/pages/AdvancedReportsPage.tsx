import {useCallback,useEffect,useState} from 'react';
import {cloudRequest} from '../services/cloud';
import {downloadReportCsv,downloadReportPdf} from '../services/reportExports';
import type {ReportExport,ReportCell} from '../services/reportExports';

type Spend={department:string;paid:number;paidOrders:number};
type Supplier={supplier:string;orders:number;verifiedDeliveries:number;inspectedDeliveries:number;onTime:number;datedDeliveries:number;discrepancies:number;ratingCount:number;averageRating:number|null;onTimeRate:number|null;verificationRate:number|null};
type Lead={poId:string;prId:string;department:string;itemTitle:string;supplier:string;prToPoDays:number|null;prToVerifiedDays:number|null};
type Report={paidByDepartment:Spend[];supplierPerformance:Supplier[];leadTime:Lead[];summary:{totalPaid:number;paidOrders:number;supplierCount:number;averagePrToPoDays:number|null}};
const php=(n:number)=>`₱${n.toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
function ExportButtons({report}:{report:ReportExport}){
  return <div className="flex flex-wrap gap-2" aria-label={`Export ${report.title}`}>
    <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-[#a64f32] hover:bg-[#fdf7f3]" onClick={()=>downloadReportCsv(report)} title="Download structured, Excel-compatible CSV data">
      <i className="fa-solid fa-file-csv text-emerald-700" aria-hidden="true"/> CSV
    </button>
    <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-[#a64f32] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#884029]" onClick={()=>downloadReportPdf(report)} title="Download professionally formatted PDF with tables and page numbers">
      <i className="fa-solid fa-file-pdf" aria-hidden="true"/> Download PDF
    </button>
  </div>;
}
export default function AdvancedReportsPage(){
  const [data,setData]=useState<Report|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const load=useCallback(async()=>{setBusy(true);setError('');try{const r=await cloudRequest('/operations/reports') as Report;setData(r);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false)}},[]);
  useEffect(()=>{void load()},[load]);
  const spendRows:ReportCell[][]=data?.paidByDepartment.map(d=>[d.department,d.paid,d.paidOrders])??[];
  const supplierRows:ReportCell[][]=data?.supplierPerformance.map(s=>[s.supplier,s.orders,s.averageRating,s.ratingCount,s.verifiedDeliveries,s.discrepancies,s.onTimeRate])??[];
  const leadRows:ReportCell[][]=data?.leadTime.map(x=>[x.prId,x.poId,x.department,x.supplier,x.prToPoDays,x.prToVerifiedDays])??[];
  const totalVerified=data?.supplierPerformance.reduce((sum,s)=>sum+s.verifiedDeliveries,0)??0;
  const totalIssues=data?.supplierPerformance.reduce((sum,s)=>sum+s.discrepancies,0)??0;
  const measuredLeadTimes=data?.leadTime.filter(row=>row.prToPoDays!==null)??[];
  const verifiedLeadTimes=data?.leadTime.filter(row=>row.prToVerifiedDays!==null)??[];
  const averageVerifiedDays=verifiedLeadTimes.length?verifiedLeadTimes.reduce((sum,row)=>sum+Number(row.prToVerifiedDays),0)/verifiedLeadTimes.length:null;
  const spendReport:ReportExport={
    fileName:'procureflow-spend-by-department',title:'Spend by Department',
    subtitle:'Confirmed expenditure from paid purchase orders',
    columns:[{heading:'Department',weight:42},{heading:'Paid amount (PHP)',weight:35,align:'right',kind:'currency'},{heading:'Paid orders',weight:23,align:'right',kind:'number'}],
    rows:spendRows,
    kpis:[{label:'Total paid',value:php(data?.summary.totalPaid??0)},
      {label:'Paid orders',value:String(data?.summary.paidOrders??0)},
      {label:'Departments',value:String(data?.paidByDepartment.length??0)},
      {label:'Largest department',value:data?.paidByDepartment.length?data.paidByDepartment.reduce((top,row)=>row.paid>top.paid?row:top).department:'N/A'}],
    barChart:data?.paidByDepartment.map(d=>({label:d.department,value:d.paid})),
    totalRow:['TOTAL',data?.summary.totalPaid??0,data?.summary.paidOrders??0],
    note:'Source: recorded paid orders. Amounts are shown in Philippine pesos (PHP).'
  };
  const supplierReport:ReportExport={
    fileName:'procureflow-supplier-performance',title:'Supplier Performance',
    subtitle:'Supplier evaluations, verification outcomes and delivery timeliness',
    columns:[{heading:'Supplier',weight:70},{heading:'Orders',weight:22,align:'right',kind:'number'},
      {heading:'Avg. rating / 5',weight:31,align:'right',kind:'rating'},{heading:'Ratings',weight:23,align:'right',kind:'number'},
      {heading:'Verified',weight:37,align:'right',kind:'number'},{heading:'Issues',weight:30,align:'right',kind:'number'},
      {heading:'On-time (%)',weight:45,align:'right',kind:'percent'}],
    rows:supplierRows,
    kpis:[{label:'Suppliers',value:String(data?.summary.supplierCount??0)},
      {label:'Total POs',value:String(data?.supplierPerformance.reduce((sum,s)=>sum+s.orders,0)??0)},
      {label:'Verified deliveries',value:String(totalVerified)},
      {label:'Flagged deliveries',value:String(totalIssues)}],
    note:'On-time percentages use deliveries with known expected and actual dates; unrated suppliers display N/A.'
  };
  const leadReport:ReportExport={
    fileName:'procureflow-procurement-lead-time',title:'Procurement Lead Time',
    subtitle:'Elapsed calendar days from requisition to order and verified receipt',
    columns:[{heading:'PR reference',weight:30},{heading:'PO reference',weight:30},
      {heading:'Department',weight:56},{heading:'Supplier',weight:64},
      {heading:'PR to PO (days)',weight:42,align:'right',kind:'days'},
      {heading:'PR to verified (days)',weight:45,align:'right',kind:'days'}],
    rows:leadRows,
    kpis:[{label:'Purchase orders',value:String(data?.leadTime.length??0)},
      {label:'Measured PR to PO',value:String(measuredLeadTimes.length)},
      {label:'Average PR to PO',value:data?.summary.averagePrToPoDays==null?'N/A':`${data.summary.averagePrToPoDays} days`},
      {label:'Average to verified',value:averageVerifiedDays===null?'N/A':`${averageVerifiedDays.toFixed(1)} days`}],
    note:'N/A indicates a missing date or a delivery that has not passed final verification.'
  };
  const maxSpend=Math.max(1,...(data?.paidByDepartment.map(s=>s.paid)??[]));
  return <section className="mx-auto max-w-7xl space-y-5">
    <header className="rounded-xl border bg-white p-5 flex flex-wrap justify-between gap-4 items-center"><div><h2 className="text-xl font-bold text-slate-900">Advanced Procurement Reports</h2><p className="text-sm text-slate-500 mt-1">Paid orders, supplier evaluations, and PR-to-PO processing time. Figures reflect recorded transactions.</p></div><button onClick={()=>void load()} disabled={busy} className="border rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy?'Loading…':'Refresh reports'}</button></header>
    {error&&<p role="alert" className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-sm text-rose-700">{error}</p>}
    {data&&<>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[["Paid expenditure",php(data.summary.totalPaid)],["Paid purchase orders",String(data.summary.paidOrders)],["Suppliers with orders",String(data.summary.supplierCount)],["Average PR → PO",data.summary.averagePrToPoDays===null?'No dates':`${data.summary.averagePrToPoDays} days`]].map(([label,value])=><div key={label} className="bg-white border rounded-xl p-4"><p className="text-xs text-slate-500">{label}</p><p className="text-lg font-bold mt-2 text-slate-900">{value}</p></div>)}
      </div>
      <article className="bg-white border rounded-xl p-5 space-y-4"><div className="flex justify-between items-center flex-wrap gap-3"><h3 className="font-bold text-lg">Spend by department</h3><ExportButtons report={spendReport}/></div>
        {data.paidByDepartment.length===0?<p className="text-sm text-slate-500">No paid transactions available.</p>:data.paidByDepartment.map(d=><div key={d.department} className="space-y-1"><div className="flex justify-between gap-4 text-sm"><span className="font-medium">{d.department}</span><span className="font-semibold">{php(d.paid)} · {d.paidOrders} orders</span></div><div className="h-2.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-[#ae5837]" style={{width:`${100*d.paid/maxSpend}%`}}/></div></div>)}
      </article>
      <article className="bg-white border rounded-xl overflow-hidden"><div className="p-5 flex justify-between items-center flex-wrap gap-3"><div><h3 className="font-bold text-lg">Supplier performance</h3><p className="text-xs text-slate-500 mt-1">On-time rate uses deliveries with both expected and actual dates; unrated suppliers remain visible.</p></div><ExportButtons report={supplierReport}/></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 border-y text-slate-600"><tr>{['Supplier','Orders','Avg. rating','Verified','Issues','On time'].map(h=><th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{data.supplierPerformance.map(s=><tr key={s.supplier} className="border-b last:border-0"><td className="p-3 font-semibold">{s.supplier}</td><td className="p-3">{s.orders}</td><td className="p-3">{s.averageRating===null?'Not rated':`${s.averageRating.toFixed(1)} / 5`}</td><td className="p-3">{s.verifiedDeliveries}</td><td className="p-3">{s.discrepancies}</td><td className="p-3">{s.onTimeRate===null?'N/A':`${s.onTimeRate}%`}</td></tr>)}</tbody></table>{data.supplierPerformance.length===0&&<p className="p-4 text-slate-500 text-sm">No supplier orders recorded.</p>}</div></article>
      <article className="bg-white border rounded-xl overflow-hidden"><div className="p-5 flex justify-between items-center flex-wrap gap-3"><div><h3 className="font-bold text-lg">Procurement lead time</h3><p className="text-xs text-slate-500 mt-1">Days from PR creation to PO date, and to last verified delivery where available.</p></div><ExportButtons report={leadReport}/></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 border-y text-slate-600"><tr>{['PR','PO','Department','Supplier','PR → PO','PR → verified'].map(h=><th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{data.leadTime.map(p=><tr key={p.poId} className="border-b last:border-0"><td className="p-3">{p.prId}</td><td className="p-3 font-semibold">{p.poId}</td><td className="p-3">{p.department}</td><td className="p-3">{p.supplier}</td><td className="p-3">{p.prToPoDays===null?'N/A':`${p.prToPoDays} days`}</td><td className="p-3">{p.prToVerifiedDays===null?'N/A':`${p.prToVerifiedDays} days`}</td></tr>)}</tbody></table>{data.leadTime.length===0&&<p className="p-4 text-sm text-slate-500">No orders available.</p>}</div></article>
    </>}
  </section>;
}
