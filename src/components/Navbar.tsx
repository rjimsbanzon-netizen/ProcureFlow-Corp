import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

export default function Navbar({ activeView, onNavigate }: NavbarProps) {
  const { user, logout} = useAuth();

  if (!user) return null;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'orders', label: 'Purchase Orders' },
    ...(user.role === 'admin' || user.role === 'employee' ? [{ id: 'suppliers', label: 'Suppliers' }] : []),
    ...(user.role === 'admin' ? [{ id: 'users', label: 'Users' }] : []),
  ];

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <div className="logo-mark small">P</div>
        <span>ProcureFlow</span>
      </div>

      <div className="nav-links">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-link ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="nav-user">
        <div className="user-info">
          <span className="user-name">{user.name}</span>
          <span className={`role-badge ${user.role}`}>{user.role}</span>
        </div>
        <button className="btn btn-outline btn-sm" onClick={logout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
