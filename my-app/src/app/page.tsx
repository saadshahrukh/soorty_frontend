'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    const userJson = localStorage.getItem('token');
    // We don’t decode token here; rely on /login redirect pages using store.
    // Redirect to orders for DataEntry by default.
    try {
      const user = (window as any).__AUTH_USER__ || null;
      if (user?.role === 'DataEntry') {
        router.push('/orders');
      } else {
        router.push('/dashboard');
      }
    } catch {
      router.push('/dashboard');
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-xl">Redirecting...</div>
    </div>
  );
}
