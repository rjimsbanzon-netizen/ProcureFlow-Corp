import { useState } from 'react';
import { confirmAction } from '../services/actionDialogs';
import type { ChangeEvent } from 'react';
import { cloudRequest } from '../services/cloud';
import { DB } from '../store/state';

type Props = {
  kind: 'PR' | 'PO';
  recordId: string;
  onRestored: () => Promise<void>;
};

type SavedRecord = Record<string, unknown> & { id: string };

/** Only sends the single selected record to Cloudflare, never the whole backup. */
function readFromBackup(value: unknown, kind: 'PR' | 'PO', id: string): SavedRecord | null {
  const collection = kind === 'PR' ? 'requisitions' : 'orders';
  let root: unknown = value;
  if (typeof root === 'string') {
    try { root = JSON.parse(root) as unknown; } catch { return null; }
  }
  if (!root || typeof root !== 'object') return null;
  const object = root as Record<string, unknown>;
  if (object.id === id) return object as SavedRecord;
  let nested: Record<string, unknown> = object;
  if (object.data && typeof object.data === 'object' && !Array.isArray(object.data)) nested = object.data as Record<string, unknown>;
  else if (typeof object.data === 'string') {
    try { nested = JSON.parse(object.data) as Record<string, unknown>; }
    catch { return null; }
  }
  const source = Array.isArray(nested[collection]) ? nested[collection] : [];
  const record = source.find((row: unknown) => Boolean(row && typeof row === 'object' && (row as SavedRecord).id === id));
  return record as SavedRecord | null;
}

export function RestoreMissingRecord({ kind, recordId, onRestored }: Props) {
  const [open, setOpen] = useState(false);
  const [record, setRecord] = useState<SavedRecord | null>(null);
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  if (DB.currentUser?.role !== 'Admin') return null;

  async function loadBackup(event: ChangeEvent<HTMLInputElement>) {
    setRecord(null); setSource(''); setError(''); setSuccess('');
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) { setError('Please choose a JSON backup smaller than 5 MB.'); return; }
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const recovered = readFromBackup(parsed, kind, recordId);
      if (!recovered) throw new Error(`${recordId} was not found in this file.`);
      setRecord(recovered); setSource(file.name);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Invalid JSON backup.'); }
  }

  function loadLocalCache() {
    setRecord(null); setError(''); setSuccess('');
    try {
      const raw = localStorage.getItem('eprocurement_db');
      const recovered = raw ? readFromBackup(raw, kind, recordId) : null;
      if (!recovered) throw new Error(`${recordId} is not in this browser's cached data. Try a backup or a different device.`);
      setRecord(recovered); setSource('This browser’s saved workspace copy');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not read local cache.'); }
  }

  async function restore() {
    if (!record || busy) return;
    if (!await confirmAction({title:'Restore original procurement record',message:`Restore ${recordId} from ${source}? The server will verify its original approval / invoice references before restoring. No approvals will be bypassed.`,tone:'warning',confirmText:'Validate and restore'})) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      await cloudRequest('/finance/admin/restore-record', {
        method: 'POST', body: JSON.stringify({ kind, record })
      });
      // Pull the authoritative cloud arrays. Do not write a stale browser snapshot back.
      const latest = await cloudRequest('/enterprise-state') as {
        data?: { requisitions?: typeof DB.requisitions; orders?: typeof DB.orders };
      };
      if (Array.isArray(latest.data?.requisitions)) DB.requisitions = latest.data.requisitions;
      if (Array.isArray(latest.data?.orders)) DB.orders = latest.data.orders;
      setRecord(null);
      setSuccess(`${recordId} restored. Review its original details before continuing the workflow.`);
      await onRestored();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Restoration failed.'); }
    finally { setBusy(false); }
  }

  return <div className="border-t border-amber-200 pt-2 text-sm">
    <button type="button" className="font-semibold underline text-amber-900" onClick={() => setOpen(value => !value)}>
      {open ? 'Close recovery tools' : `Admin: restore missing ${kind} from backup`}
    </button>
    {open && <div className="mt-3 space-y-3 rounded-lg bg-white p-3 border border-amber-200">
      <p className="text-slate-700">Recover the <strong>original {recordId}</strong> from a saved JSON workspace backup or a browser with its older data. Do not invent missing specifications or use a different record.</p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="file" accept=".json,application/json" className="text-xs max-w-full" onChange={event => void loadBackup(event)} />
        <button type="button" className="border rounded px-3 py-1.5 text-xs" onClick={loadLocalCache}>Check this browser’s cached copy</button>
      </div>
      {record && <div className="border rounded-md p-3 bg-slate-50 text-xs space-y-1">
        <div className="font-semibold">Backup found: {String(record.id)}</div>
        <div>Source: {source}</div>
        <div>Title: {String(record.itemTitle ?? '—')}</div>
        <div>Department: {String(record.department ?? '—')}</div>
        <div>Recorded amount: ₱{Number(record.totalCost ?? 0).toLocaleString('en-PH')}</div>
        <div>Status from backup: {String(record.status ?? '—')}</div>
        <button type="button" disabled={busy} onClick={() => void restore()}
          className="mt-2 rounded bg-[#a64f32] text-white px-3 py-2 font-semibold disabled:opacity-50">
          {busy ? 'Checking original records…' : `Validate & restore ${recordId}`}
        </button>
      </div>}
      {error && <p role="alert" className="text-rose-700 text-xs">{error}</p>}
      {success && <p role="status" className="text-emerald-700 text-xs">{success}</p>}
      <p className="text-xs text-slate-500">If no original copy exists, Cloudflare cannot reconstruct the item title, specifications, quantity or supplier terms from an approval/invoice reference alone. Check previous exports or your D1 backups before restoring.</p>
    </div>}
  </div>;
}
