import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import type { PurchaseOrder } from '../types';
import { dataService } from '../db/dataService';

export default function PurchaseOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('IT Equipment');
  const [supplier, setSupplier] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const list = await dataService.listOrders();
      setOrders(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (!user) return null;

  const isAdmin = user.role === 'admin';
  const isEmployee = user.role === 'employee';
  const canCreate = isAdmin || isEmployee;
  const canApprove = isAdmin;

  const filtered = orders.filter((o) => {
    if (filter === 'all') return true;
    return o.status === filter;
  });

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const newOrder: PurchaseOrder = {
      id: `PO-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      title,
      description,
      amount: parseFloat(amount) || 0,
      status: 'pending',
      requestedBy: user.name,
      requestedAt: new Date().toISOString().slice(0, 10),
      supplier: supplier || undefined,
      category,
    };
    try {
      await dataService.upsertOrder(newOrder);
      await load();
      setShowForm(false);
      setTitle('');
      setDescription('');
      setAmount('');
      setSupplier('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  };

  const updateStatus = async (order: PurchaseOrder, status: PurchaseOrder['status']) => {
    try {
      await dataService.upsertOrder({ ...order, status });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  if (user.role === 'guest') {
    return (
      <div className="page">
        <header className="page-header">
          <h1>Purchase Orders</h1>
          <p className="text-muted">
            Guest accounts have limited visibility. Sign in as Employee or Admin for full access.
          </p>
        </header>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Purchase Orders</h1>
          <p className="text-muted">Create, track and manage procurement requests</p>
        </div>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New Request'}
          </button>
        )}
      </header>

      {error && <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>}

      {showForm && (
        <section className="panel form-panel">
          <h2>New Purchase Request</h2>
          <form onSubmit={(e) => void handleCreate(e)} className="order-form">
            <div className="form-row">
              <div className="form-group">
                <label>Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Brief title" />
              </div>
              <div className="form-group">
                <label>Amount (₱ PHP)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={3}
                placeholder="Detailed description of items or services"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option>IT Equipment</option>
                  <option>Software</option>
                  <option>Raw Materials</option>
                  <option>Safety</option>
                  <option>Furniture</option>
                  <option>Services</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Preferred Supplier (optional)</label>
                <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Supplier name" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">
              Submit Request
            </button>
          </form>
        </section>
      )}

      <div className="filter-bar">
        {['all', 'pending', 'approved', 'rejected', 'completed'].map((f) => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading && <p className="text-muted">Loading orders…</p>}

      <div className="table-wrapper panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Requested By</th>
              <th>Date</th>
              {canApprove && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && !loading ? (
              <tr>
                <td colSpan={canApprove ? 8 : 7} className="empty-cell">
                  No orders match this filter.
                </td>
              </tr>
            ) : (
              filtered.map((order) => (
                <tr key={order.id}>
                  <td className="mono">{order.id}</td>
                  <td>
                    <div className="cell-title">{order.title}</div>
                    <div className="cell-sub">{order.description.slice(0, 60)}…</div>
                  </td>
                  <td>{order.category}</td>
                  <td>₱{order.amount.toLocaleString()}</td>
                  <td>
                    <span className={`status-badge ${order.status}`}>{order.status}</span>
                  </td>
                  <td>{order.requestedBy}</td>
                  <td>{order.requestedAt}</td>
                  {canApprove && (
                    <td>
                      {order.status === 'pending' && (
                        <div className="action-buttons">
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => void updateStatus(order, 'approved')}
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => void updateStatus(order, 'rejected')}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {order.status === 'approved' && (
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => void updateStatus(order, 'completed')}
                        >
                          Mark Complete
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
