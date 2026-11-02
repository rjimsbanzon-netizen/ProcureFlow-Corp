import { formatQuantity } from '../../domain/measurementUnits';
import { useState } from 'react';
import { DB, ui } from '../../store/state';
import { getProcurementJourney, getTrackableRequisitions } from './trackingService';
import type { TrackingStage } from './trackingService';

const peso = (value: unknown) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(Number(value || 0));

function StageIcon({ stage }: { stage: TrackingStage }) {
  const style = stage.status === 'complete' ? 'bg-[#355b42] text-white' :
    stage.status === 'blocked' ? 'bg-[#8d452f] text-white' :
    stage.status === 'current' ? 'bg-[#a64f32] text-white' : 'bg-[#e9e4d9] text-slate-500';
  return <div className={`w-9 h-9 flex items-center justify-center rounded-full shrink-0 ${style}`}>
    <i className={`fa-solid ${stage.status === 'complete' ? 'fa-check' : stage.status === 'blocked' ? 'fa-xmark' : stage.status === 'not-recorded' ? 'fa-minus' : 'fa-circle-dot'} text-sm`} />
  </div>;
}

export default function TrackingPage() {
  const [search, setSearch] = useState('');
  const items = getTrackableRequisitions(DB);
  const [selectedId, setSelectedId] = useState<string | null>(() => ui.trackingRecordId || items[0]?.id || null);
  const safeSelectedId = items.some(item => item.id === selectedId) ? selectedId : items[0]?.id || null;
  const journey = safeSelectedId ? getProcurementJourney(safeSelectedId) : null;
  const shown = items.filter(item => `${item.id} ${item.itemTitle} ${item.department}`.toLowerCase().includes(search.toLowerCase()));

  return <section className="space-y-5">
    <div className="bg-white border border-slate-200 rounded-md p-5">
      <h2 className="text-xl font-bold text-slate-900">Procurement Tracking</h2>
      <p className="text-sm text-slate-500 mt-1">Follow each approved purchase request from submission to verified delivery and payment.</p>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-5 items-start">
      <aside className="bg-white rounded-md border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200"><label htmlFor="track-search" className="text-xs font-bold text-slate-600 uppercase tracking-wide">Find a requisition</label>
          <input id="track-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="PR number, item, department" className="mt-2 w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a64f32]"/></div>
        <div className="max-h-[65vh] overflow-y-auto custom-scrollbar">
          {shown.length === 0 ? <p className="p-5 text-sm text-slate-500">No matching requisitions.</p> : shown.map(pr => <button key={pr.id} type="button" onClick={() => { setSelectedId(pr.id); ui.trackingRecordId = pr.id; }}
            className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-[#f7f3ec] transition-colors ${safeSelectedId === pr.id ? 'bg-[#eee7d9] border-l-[3px] border-l-[#a64f32]' : ''}`}>
            <span className="flex justify-between gap-2 items-center"><span className="text-sm font-bold text-[#873e27]">{pr.id}</span><span className="text-xs text-slate-500">{pr.status}</span></span>
            <span className="block mt-1 text-sm font-semibold text-slate-900 line-clamp-2">{pr.itemTitle}</span>
            <span className="block text-xs text-slate-500 mt-1">{pr.department}</span>
          </button>)}
        </div>
      </aside>
      <div className="bg-white rounded-md border border-slate-200 p-5 sm:p-6">
        {!journey ? <div className="text-center p-12 text-slate-500">No transactions available for tracking.</div> : <>
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div><p className="text-xs tracking-widest text-slate-500 font-bold uppercase">Tracking reference</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{journey.pr.id}</h3>
              <p className="text-sm text-slate-700 mt-1">{journey.pr.itemTitle}</p>
              <p className="text-xs text-slate-500 mt-1">{journey.pr.department} · {formatQuantity(journey.pr.quantity, journey.pr.unit)} · {peso(journey.pr.totalCost)}</p>
            </div>
            <span className="rounded-md px-3 py-1.5 text-xs font-bold bg-[#eee7d9] text-[#873e27]">{journey.pr.status}</span>
          </div>
          <div className="mt-6 flex justify-between items-center"><span className="text-sm font-semibold text-slate-700">Overall progress</span><span className="text-lg font-bold text-[#a64f32]">{journey.progress}%</span></div>
          <div className="h-2 rounded-full bg-[#e9e4d9] overflow-hidden mt-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={journey.progress} aria-label="Procurement completion">
            <div className="h-full bg-[#a64f32] rounded-full transition-all" style={{ width: `${journey.progress}%` }}/>
          </div>
          <div className="mt-7">
            {journey.stages.map((stage, index) => <div key={stage.id} className="flex gap-4 min-h-20">
              <div className="flex flex-col items-center"><StageIcon stage={stage}/>
                {index < journey.stages.length - 1 && <div className="w-px flex-1 bg-[#d9d3c5] my-1 min-h-8" />}</div>
              <div className="pb-6 pt-1 min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3"><h4 className="text-sm sm:text-base font-bold text-slate-900">{stage.title}</h4>
                  <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wide whitespace-nowrap ${stage.status === 'blocked' ? 'text-rose-700' : stage.status === 'complete' ? 'text-emerald-700' : 'text-slate-500'}`}>{stage.status.replace('-', ' ')}</span></div>
                <p className="text-sm text-slate-600 mt-1">{stage.detail}</p>
                {(stage.reference || stage.date) && <p className="text-xs text-slate-400 mt-1">{[stage.reference, stage.date].filter(Boolean).join(' · ')}</p>}
              </div>
            </div>)}
          </div>
          <p className="mt-2 text-xs text-slate-500 border-t border-slate-100 pt-4">Progress reflects recorded procurement milestones, not time elapsed. Historical orders without linked bidding records are labeled “not recorded.”</p>
        </>}
      </div>
    </div>
  </section>;
}
