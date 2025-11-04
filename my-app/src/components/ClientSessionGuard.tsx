"use client";
import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';

const INACTIVITY_MS = 60_00000000; // 1 minute

export default function ClientSessionGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, logout } = useAuthStore();
  const timerRef = useRef<number | null>(null);

  // Redirect if unauthenticated and trying to access protected routes
  useEffect(() => {
    const authed = isAuthenticated();
    const protectedPaths = ['/dashboard', '/orders', '/logs'];
    if (!authed && protectedPaths.some(p => pathname?.startsWith(p))) {
      router.replace('/login');
    }
  }, [pathname]);

  // Inactivity auto-logout
  useEffect(() => {
    const resetTimer = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        if (isAuthenticated()) {
          logout();
          toast.info('Logged out due to inactivity');
          router.replace('/login');
        }
      }, INACTIVITY_MS);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'visibilitychange'];
    events.forEach(evt => window.addEventListener(evt, resetTimer, { passive: true } as any));
    resetTimer();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      events.forEach(evt => window.removeEventListener(evt, resetTimer));
    };
  }, []);

  return null;
}


