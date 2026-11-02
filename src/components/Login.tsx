import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { isCloudConfigured } from '../db/cloudApi';

interface LoginProps {
  onSuccess: () => void;
}

export default function Login({ onSuccess }: LoginProps) {
  const { login, storageMode, isOnline } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const success = await login(username.trim(), password);
      if (success) {
        onSuccess();
      } else {
        setError('Invalid username or password. Try the demo credentials below.');
      }
    } catch {
      setError('Login failed. Check connection or try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    setError('');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="logo-mark"></div>
          <h1>ProcureFlow</h1>
          <p className="subtitle">Enterprise Procurement System</p>
          <p className="storage-badge">
            {isOnline ? 'Online' : 'Offline'} · {storageMode === 'cloud' ? 'Cloudflare D1' : 'Local SQLite'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {isCloudConfigured() ? (
          <p className="demo-credentials">
            Sign in with an account created by Admin.
          </p>
        ) : (
          <div className="demo-credentials">
            <p className="demo-title">Demo Accounts</p>
            <div className="demo-buttons">
              <button type="button" className="demo-btn admin" onClick={() => fillDemo('admin', 'admin123')}>
                <span className="role-badge admin">Admin</span>
                <span>admin / admin123</span>
              </button>
              <button type="button" className="demo-btn employee" onClick={() => fillDemo('employee', 'emp123')}>
                <span className="role-badge employee">Employee</span>
                <span>employee / emp123</span>
              </button>
              <button type="button" className="demo-btn guest" onClick={() => fillDemo('guest', 'guest123')}>
                <span className="role-badge guest">Guest</span>
                <span>guest / guest123</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
