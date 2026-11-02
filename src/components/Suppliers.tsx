import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Supplier } from '../types';
import { dataService } from '../db/dataService';

const CATEGORIES = [
  'IT Equipment',
  'Software',
  'Raw Materials',
  'Safety',
  'Furniture',
  'Logistics',
  'Services',
  'Other',
];

interface SupplierFormState {
  name: string;
  contact: string;
  category: string;
  rating: string;
  status: 'active' | 'inactive';
}

const emptyForm: SupplierFormState = {
  name: '',
  contact: '',
  category: 'IT Equipment',
  rating: '4.0',
  status: 'active',
};

export default function Suppliers() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState<SupplierFormState>(emptyForm);
  const [error, setError] = useState('');

  const modalOpen = isAdding || !!editingId;

  const load = async () => {
    setLoading(true);
    try {
      const list = await dataService.listSuppliers();
      setSuppliers(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeForm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  useEffect(() => {
    document.body.style.overflow = modalOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [modalOpen]);

  if (!user) return null;

  if (user.role === 'guest') {
    return (
      <div className="page">
        <header className="page-header">
          <h1>Suppliers</h1>
          <p className="text-muted">Supplier directory is restricted to authenticated staff.</p>
        </header>
      </div>
    );
  }

  const isAdmin = user.role === 'admin';

  const openEdit = (s: Supplier) => {
    setEditingId(s.id);
    setIsAdding(false);
    setForm({
      name: s.name,
      contact: s.contact,
      category: s.category,
      rating: String(s.rating),
      status: s.status,
    });
  };

  const openAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setForm(emptyForm);
  };

  const closeForm = () => {
    setEditingId(null);
    setIsAdding(false);
    setForm(emptyForm);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const ratingNum = Math.min(5, Math.max(0, parseFloat(form.rating) || 0));
    const payload: Supplier = {
      id: isAdding ? `SUP-${crypto.randomUUID().slice(0, 8).toUpperCase()}` : (editingId as string),
      name: form.name.trim(),
      contact: form.contact.trim(),
      category: form.category,
      rating: ratingNum,
      status: form.status,
    };
    try {
      await dataService.upsertSupplier(payload);
      await load();
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const toggleStatus = async (s: Supplier) => {
    try {
      await dataService.upsertSupplier({
        ...s,
        status: s.status === 'active' ? 'inactive' : 'active',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Supplier Directory</h1>
          <p className="text-muted">Verified partners and performance overview</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={openAdd}>
            + Add Supplier
          </button>
        )}
      </header>

      {error && <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>}
      {loading && <p className="text-muted">Loading suppliers…</p>}

      <div className="suppliers-grid">
        {suppliers.map((s) => (
          <div key={s.id} className={`supplier-card ${s.status}`}>
            <div className="supplier-header">
              <h3>{s.name}</h3>
              <span className={`status-badge ${s.status}`}>{s.status}</span>
            </div>
            <div className="supplier-meta">
              <div>
                <span className="label">Category</span>
                <span>{s.category}</span>
              </div>
              <div>
                <span className="label">Contact</span>
                <span className="mono">{s.contact}</span>
              </div>
              <div>
                <span className="label">Rating</span>
                <span className="rating">
                  {'★'.repeat(Math.floor(s.rating))}
                  <span className="rating-num">{s.rating.toFixed(1)}</span>
                </span>
              </div>
            </div>
            {isAdmin && (
              <div className="supplier-actions">
                <button className="btn btn-sm btn-outline" onClick={() => openEdit(s)}>
                  Edit
                </button>
                <button className="btn btn-sm btn-outline" onClick={() => void toggleStatus(s)}>
                  {s.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {modalOpen && isAdmin && (
        <div className="modal-overlay" onClick={closeForm} role="presentation">
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="supplier-modal-title"
          >
            <div className="modal-header">
              <h2 id="supplier-modal-title">{isAdding ? 'Add New Supplier' : 'Edit Supplier'}</h2>
              <button type="button" className="modal-close" onClick={closeForm} aria-label="Close">
                ×
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="modal-body">
              <div className="form-group">
                <label>Supplier Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="Company name"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Contact Email</label>
                <input
                  type="email"
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  required
                  placeholder="email@supplier.com"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Rating (0–5)</label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={form.rating}
                    onChange={(e) => setForm({ ...form, rating: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as 'active' | 'inactive' })
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {isAdding ? 'Add Supplier' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
