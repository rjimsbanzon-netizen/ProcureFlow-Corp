import {useEffect,useState} from 'react';
import {HtmlView} from '../components/HtmlView';
import {renderBidComparisonView} from '../views/bidding';
import {DB} from '../store/state';
import {CLOUD_API_BASE,cloudRequest} from '../services/cloud';

/** Use submitted bids confirmed in D1, not a stale browser snapshot.
 * Never persist this read-only refresh through /enterprise-state. */
export default function BidComparisonPage(){
  const [,render]=useState(0);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    if(!CLOUD_API_BASE||!['Admin','Procurement Head'].includes(DB.currentUser?.role||''))return;
    let active=true;
    const sync=async()=>{
      try{
        const response=await cloudRequest('/sourcing/bids',{cache:'no-store'}) as {bids:typeof DB.bids};
        if(!active)return;
        if(!Array.isArray(response.bids))throw new Error('Cloud did not return a valid bid list.');
        DB.bids=response.bids;
        setError('');render(x=>x+1);
      }catch(cause){if(active)setError(cause instanceof Error?cause.message:String(cause));}
      finally{if(active)setRefreshing(false);}
    };
    void sync();
    const onFocus=()=>{if(document.visibilityState==='visible')void sync();};
    document.addEventListener('visibilitychange',onFocus);
    const interval=window.setInterval(()=>{void sync();},15_000);
    return()=>{active=false;window.clearInterval(interval);document.removeEventListener('visibilitychange',onFocus);};
  },[]);
  const reload=()=>{setRefreshing(true);void cloudRequest('/sourcing/bids',{cache:'no-store'}).then((data)=>{
    const res=data as {bids:typeof DB.bids};
    if(Array.isArray(res.bids)){DB.bids=res.bids;render(x=>x+1);setError('');}
  }).catch(e=>setError(e instanceof Error?e.message:String(e))).finally(()=>setRefreshing(false));};
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div><h2 className="text-lg font-bold text-slate-900">Submitted Vendor Bids &amp; Comparison</h2>
        <p className="mt-1 text-sm text-slate-500">Confirmed supplier bids are refreshed from Cloudflare D1 every 15 seconds.</p></div>
      <button type="button" onClick={reload} disabled={refreshing} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">{refreshing?'Refreshing…':'Refresh bids'}</button>
    </div>
    {error&&<p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Could not synchronize submitted bids: {error}</p>}
    <HtmlView html={renderBidComparisonView()}/>
  </div>;
}
