import BiddingDeadlinesPanel from './BiddingDeadlinesPanel';

export default function BiddingDeadlinesPage() {
  return <div className="space-y-5">
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Bidding Deadlines</h2>
      <p className="mt-1 text-sm text-slate-500">Control quotation deadlines for published stock needs. Supplier submissions remain enforced by the secure endpoint.</p>
    </div>
    <BiddingDeadlinesPanel />
  </div>;
}
