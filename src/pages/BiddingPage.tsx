import { useEffect, useState } from 'react';
import { HtmlView } from '../components/HtmlView';
import { renderStockNeedsView } from '../views/bidding';
import { CLOUD_API_BASE } from '../services/cloud';
import { loadDeadlines } from '../services/sourcing';
import { LoadingState } from '../components/FeedbackState';

/** Supplier opportunities must still load enforced deadlines after the sections are split. */
export default function BiddingPage() {
  const [, refresh] = useState(0);
  const [loading, setLoading] = useState(Boolean(CLOUD_API_BASE));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!CLOUD_API_BASE) return;
    let active = true;
    const syncDeadlines = async () => {
      try {
        await loadDeadlines();
        if (active) { setError(''); refresh(n => n + 1); }
      } catch (cause) {
        if (active) setError(`Bidding deadline status could not be refreshed: ${(cause as Error).message}`);
      } finally {
        if (active) setLoading(false);
      }
    };
    void syncDeadlines();
    const timer = window.setInterval(() => void syncDeadlines(), 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  return <div className="space-y-4">
    {loading ? <LoadingState title="Loading published stock needs" description="Checking bidding deadlines before showing opportunities…" /> :
      <>{error && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}
        <HtmlView html={renderStockNeedsView()} /></>}
  </div>;
}
