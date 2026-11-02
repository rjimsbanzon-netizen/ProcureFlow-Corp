import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import type { User, UserRole, CreateUserInput } from '../types';
import { dataService } from '../db/dataService';

export default function Users() {
  const { user, register } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('employee');

  const load = async () => {
    setLoading(true);
    try {
      const list = await dataService.listUsers();
      setUsers(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (!user || user.role !== 'admin') {
    return (
      <div className="page">
        <header className="page-header">
          <h1>Users</h1>
          <p className="text-muted">Only Admin can manage accounts.</p>
        </header>
      </div>
    );
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const input: CreateUserInput = {
      username: username.trim(),
      password,
      name: name.trim(),
      email: email.trim(),
      role,
    };
    const result = await register(input);
    if (result.ok) {
      setSuccess(`Account "${input.username}" created successfully.`);
      setShowForm(false);
      setUsername('');
      setPassword('');
      setName('');
      setEmail('');
      setRole('employee');
      await load();
    } else {
      setError(result.error ?? 'Could not create account');
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>User Accounts</h1>
          <p className="text-muted">Create and view accounts (stored in Cloudflare D1 or local SQLite)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Create Account'}
        </button>
      </header>

      {error && <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>}
      {success && (
        <div
          className="error-message"
          style={{ marginBottom: '1rem', background: 'rgba(16,185,129,0.15)', color: '#34d399' }}
        >
          {success}
        </div>
      )}

      {showForm && (
        <section className="panel form-panel">
          <h2>Create Account</h2>
          <form onSubmit={(e) => void handleCreate(e)} className="order-form">
            <div className="form-row">
              <div className="form-group">
                <label>Username</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Full Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                <option value="admin">Admin</option>
                <option value="employee">Employee</option>
                <option value="guest">Guest</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary">
              Create Account
            </button>
          </form>
        </section>
      )}

      {loading && <p className="text-muted">Loading users…</p>}

      <div className="table-wrapper panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="mono">{u.username}</td>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <span className={`role-badge ${u.role}`}>{u.role}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
