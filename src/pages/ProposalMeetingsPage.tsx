import { HtmlView } from '../components/HtmlView';
import { renderProposalMeetingsView } from '../views/bidding';

export default function ProposalMeetingsPage() {
  return <div className="space-y-5">
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Proposal Meetings</h2>
      <p className="mt-1 text-sm text-slate-500">Review meeting invitations, scheduling conflicts, supplier responses and reschedule requests.</p>
    </div>
    <HtmlView html={renderProposalMeetingsView()} />
  </div>;
}
