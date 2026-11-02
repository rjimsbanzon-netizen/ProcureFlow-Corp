import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User, AuthState, CreateUserInput } from '../types';
import { dataService, type StorageMode } from '../db/dataService';

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [storageMode, setStorageMode] = useState<StorageMode>('local');

  useEffect(() => {
    const saved = localStorage.getItem('procurement_user');
    void dataService.detectMode().then((mode) => {
      setStorageMode(mode);
      if (!saved) return;
      try {
        const restoredUser = JSON.parse(saved) as User;
        if (mode !== 'cloud' || localStorage.getItem('procurement_cloud_token')) {
          setUser(restoredUser);
        } else {
          localStorage.removeItem('procurement_user');
        }
      } catch {
        localStorage.removeItem('procurement_user');
      }
    });

    const onOnline = () => {
      setIsOnline(true);
      void dataService.detectMode().then(setStorageMode);
    };
    const onOffline = () => {
      setIsOnline(false);
      setStorageMode('local');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    const mode = await dataService.detectMode();
    setStorageMode(mode);
    const found = await dataService.login(username.trim(), password);
    if (found) {
      setUser(found);
      localStorage.setItem('procurement_user', JSON.stringify(found));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('procurement_user');
    void dataService.logout().catch((error: unknown) => {
      console.error('Failed to revoke cloud session', error);
    });
  };

  const register = async (input: CreateUserInput) => {
    const mode = await dataService.detectMode();
    setStorageMode(mode);
    return dataService.register(input);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isOnline,
        storageMode,
        login,
        logout,
        register,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function hasPermission(role: User['role'], action: string): boolean {
  const permissions: Record<User['role'], string[]> = {
    admin: [
      'view_all',
      'approve',
      'reject',
      'manage_users',
      'manage_suppliers',
      'create_po',
      'view_reports',
    ],
    employee: ['create_po', 'view_own', 'track_status'],
    guest: ['view_public', 'view_about'],
  };
  return permissions[role]?.includes(action) ?? false;
}
