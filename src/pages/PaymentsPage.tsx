import { useCallback, useEffect, useState } from 'react';
import { HtmlView } from '../components/HtmlView';
import { renderPaymentsView } from '../views/payments';
import { CLOUD_API_BASE } from '../services/cloud';
import { financeAPI, type FinanceSettings } from '../services/finance';
import { DB } from '../store/state';

type PaymentAuthority = Awaited<ReturnType<typeof financeAPI.paymentAuthority>>;

/** Display the Worker's per-PO decision for both assigned and acting Finance staff. */
export default function PaymentsPage() {
  const [settings,setSettings] = useState<FinanceSettings|null>(null);
  const [authorities,setAuthorities] = useState<Record<string,PaymentAuthority>>({});
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const accountId = DB.currentUser?.id;
  const fetchAuthority = useCallback(async () => {
    if (!CLOUD_API_BASE || !accountId || DB.currentUser?.role === 'Supplier') return;
    setLoading(true);
    try {
      const config = await financeAPI.settings();
      const ids = [...new Set(DB.payments.filter(p => p.status !== 'Paid').map(p => p.poId))];
      // Each result is a protected server decision: no role or threshold is guessed by the browser.
      const responses = await Promise.all(ids.map(async id => {
        try { return [id,await financeAPI.paymentAuthority(id)] as const; }
        catch { return null; }
      }));
      const mapped:Record<string,PaymentAuthority> = {};
      for (const response of responses) if (response) mapped[response[0]]=response[1];
      setSettings(config);
      setAuthorities(mapped);
      setError('');
    } catch (e) {
      setSettings(null);
      setAuthorities({});
      setError(e instanceof Error?e.message:String(e));
    } finally { setLoading(false); }
  }, [accountId]);
  useEffect(() => {
    void fetchAuthority();
    const timer = window.setInterval(() => { void fetchAuthority(); }, 60_000);
    return () => window.clearInterval(timer);
  }, [fetchAuthority]);

  return <>
    {error && <p role="alert" className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Payment assignments unavailable: {error}. Processing is disabled until the server confirms authority.</p>}
    {loading && <div role="status" className="mb-3 text-xs text-slate-500">Checking assigned and temporary Finance payment authority…</div>}
    <HtmlView html={renderPaymentsView(settings,authorities)} />
  </>;
}
