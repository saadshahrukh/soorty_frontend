"use client";
import { useEffect, useRef } from 'react';
import api from '@/lib/api';
import { toast } from '@/store/toastStore';

// For testing: 1 minute threshold; switch to 7 days later
const THRESHOLD_MS = 604800000; // 7 days
const POLL_MS = 60*1000; // poll every 1 minute

export default function ReminderWatcher() {
  const notifiedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    // Restore previously notified from localStorage (session persistence)
    try {
      const saved = localStorage.getItem('reminder_notified');
      if (saved) notifiedRef.current = new Set(JSON.parse(saved));
    } catch {}

    const poll = async () => {
      try {
        // Skip when not authenticated to avoid toasts after logout
        if (!localStorage.getItem('token')) return;
        const { data } = await api.get('/orders');
        const now = Date.now();
        const pending = (data || []).filter((o: any) => o.paymentStatus !== 'Paid');
        pending.forEach((o: any) => {
          const createdAt = new Date(o.createdAt).getTime();
          if (now - createdAt >= THRESHOLD_MS) {
            if (!notifiedRef.current.has(o._id)) {
              notifiedRef.current.add(o._id);
              try { localStorage.setItem('reminder_notified', JSON.stringify(Array.from(notifiedRef.current))); } catch {}
              const remaining = o.paymentStatus === 'Partial' ? (o.partialRemainingAmount ?? (o.sellingPrice * 0.5)) : o.sellingPrice;
              toast.warning(`Pending payment: ${o.orderId} - ${o.productServiceName}\nAmount: ${remaining}`,'Payment Reminder');
            }
          }
        });
      } catch {}
    };
    const id = setInterval(poll, POLL_MS);
    poll();
    return () => clearInterval(id);
  }, []);
  return null;
}


