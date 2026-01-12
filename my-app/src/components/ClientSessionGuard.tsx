"use client";
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function ClientSessionGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, initializeAuth } = useAuthStore();

  // Initialize auth on app load and protect routes
  useEffect(() => {
    const setupAuth = async () => {
      // Initialize auth from localStorage
      await initializeAuth();
      
      const authed = isAuthenticated();
      const protectedPaths = ['/dashboard', '/orders', '/logs', '/products', '/customers', '/expenses', '/ledger', '/preview-slip', '/reminders'];
      
      // If not authenticated and accessing protected route, redirect to login
      if (!authed && protectedPaths.some(p => pathname?.startsWith(p))) {
        router.replace('/login');
      }
    };

    setupAuth();
  }, [pathname, isAuthenticated, initializeAuth, router]);

  return null;
}


