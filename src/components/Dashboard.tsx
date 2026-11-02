import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import type { PurchaseOrder } from '../types';
import { dataService } from '../db/dataService';

export default function Dashboard() {
  const { user, storageMode, isOnline } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);

  useEffect(() => {
    void dataService.listOrders().then(setOrders).catch(() => setOrders([]));
  }, []);

  if (!user) return null;

  const isAdmin = user.role === 'admin';
  const isEmployee = user.role === 'employee';
  const isGuest = user.role === 'guest';

  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const totalValue = orders.reduce((sum, o) => sum + o.amount, 0);
  const approvedValue = orders
    .filter((o) => o.status === 'approved' || o.status === 'completed')
    .reduce((sum, o) => sum + o.amount, 0);

  return (
    <div className="dashboard">
      <header className="page-header">
        <div>
          <h1>Welcome back, {user.name.split(' ')[0]}</h1>
          <p className="text-muted">
            {isAdmin && 'Full system overview and management controls'}
            {isEmployee && 'Your purchase requests and order tracking'}
            {isGuest && 'Public overview of the procurement platform'}
            {' · '}
            {isOnline ? 'Online' : 'Offline'} / {storageMode === 'cloud' ? 'Cloudflare D1' : 'Local SQLite'}
          </p>
        </div>
      </header>

      {!isGuest && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Pending Approvals</div>
            <div className="stat-value">{pendingCount}</div>
            <div className="stat-hint">Requires attention</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Order Value</div>
            <div className="stat-value">₱{totalValue.toLocaleString()}</div>
            <div className="stat-hint">All open & closed</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Approved Spend</div>
            <div className="stat-value">₱{approvedValue.toLocaleString()}</div>
            <div className="stat-hint">This period</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Storage</div>
            <div className="stat-value" style={{ fontSize: '1.2rem' }}>
              {storageMode === 'cloud' ? 'Cloud' : 'Local'}
            </div>
            <div className="stat-hint">{isOnline ? 'Network available' : 'Working offline'}</div>
          </div>
        </div>
      )}

      {isAdmin && (
        <section className="panel">
          <h2>Admin Quick Actions</h2>
          <div className="action-grid">
            <div className="action-card">
              <h3>Approve Pending Orders</h3>
              <p>{pendingCount} purchase orders awaiting your review.</p>
              <span className="badge warning">Action needed</span>
            </div>
            <div className="action-card">
              <h3>Manage Suppliers</h3>
              <p>Review vendor performance and onboarding requests.</p>
            </div>
            <div className="action-card">
              <h3>User & Role Management</h3>
              <p>Create accounts under the Users tab. Data goes to D1 or local SQLite.</p>
            </div>
            <div className="action-card">
              <h3>Spend Analytics</h3>
              <p>Category breakdowns and budget variance reports.</p>
            </div>
          </div>
        </section>
      )}

      {isEmployee && (
        <section className="panel">
          <h2>Your Recent Requests</h2>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Title</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {orders
                  .filter((o) => o.requestedBy === user.name)
                  .map((order) => (
                    <tr key={order.id}>
                      <td className="mono">{order.id}</td>
                      <td>{order.title}</td>
                      <td>₱{order.amount.toLocaleString()}</td>
                      <td>
                        <span className={`status-badge ${order.status}`}>{order.status}</span>
                      </td>
                      <td>{order.requestedAt}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isGuest && (
        <section className="panel guest-panel">
          <h2>About This Platform</h2>
          <p>
            ProcureCorp is a modern procurement management system designed to streamline purchasing
            workflows, supplier collaboration, and spend control for organizations of all sizes.
          </p>
          <div className="feature-list">
            <div className="feature-item">
              <strong>Role-based access</strong>
              <span>Admins, employees and guests each see tailored views.</span>
            </div>
            <div className="feature-item">
              <strong>Cloudflare D1 + offline SQLite</strong>
              <span>Online data in the cloud; offline data saved locally and exportable as .sqlite.</span>
            </div>
            <div className="feature-item">
              <strong>Supplier directory</strong>
              <span>Centralized vendor information and performance scores.</span>
            </div>
          </div>
          <p className="text-muted mt-4">
            Sign in with an employee or admin account to access full functionality.
          </p>
        </section>
      )}

      {!isGuest && (
        <section className="panel">
          <h2>Recent Purchase Orders</h2>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Requested By</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="mono">{order.id}</td>
                    <td>{order.title}</td>
                    <td>{order.category}</td>
                    <td>₱{order.amount.toLocaleString()}</td>
                    <td>
                      <span className={`status-badge ${order.status}`}>{order.status}</span>
                    </td>
                    <td>{order.requestedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
