import axios from 'axios';
import { toast } from '@/store/toastStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
});

// Add auth token to requests
if (typeof window !== 'undefined') {
  const token = localStorage.getItem('token');
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
}

export default api;

// Global error handler via Axios interceptors
if (typeof window !== 'undefined') {
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error?.response?.status;
      const msg = error?.response?.data?.message || error?.message || 'Request failed';
      const path = error?.config?.url || '';
      try {
        const tokenPresent = !!localStorage.getItem('token');
        const isLoginPath = typeof window !== 'undefined' && window.location?.pathname === '/login';
        // Suppress noisy 401 toasts after logout/inactivity redirect (no token) or on login page
        if (!(status === 401 && !tokenPresent) && !isLoginPath) {
          toast.error(`${msg}${path ? `\n${path}` : ''}`);
        }
      } catch {
        // ignore toast errors
      }
      return Promise.reject(error);
    }
  );
}

