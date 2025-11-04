import { create } from 'zustand';
import api from '@/lib/api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'DataEntry';
}

interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (name: string, email: string, password: string, role: string) => Promise<void>;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  
  login: async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    const { token, user } = data;
    
    localStorage.setItem('token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    set({ user, token });
  },
  
  register: async (name: string, email: string, password: string, role: string) => {
    const { data } = await api.post('/auth/register', { name, email, password, role });
    const { token, user } = data;
    
    localStorage.setItem('token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    set({ user, token });
  },
  
  logout: () => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    set({ user: null, token: null });
  },
  
  isAuthenticated: () => {
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem('token');
    }
    return false;
  },
}));

