export type UserRole = 'admin' | 'employee' | 'guest';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  email: string;
}

/** Internal user row including password hash (never expose to UI) */
export interface UserRecord extends User {
  passwordHash: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseOrder {
  id: string;
  title: string;
  description: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  requestedBy: string;
  requestedAt: string;
  supplier?: string;
  category: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  category: string;
  rating: number;
  status: 'active' | 'inactive';
}

export interface CreateUserInput {
  username: string;
  password: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isOnline: boolean;
  storageMode: 'cloud' | 'local';
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (input: CreateUserInput) => Promise<{ ok: boolean; error?: string }>;
}
