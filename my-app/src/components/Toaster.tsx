"use client";
import { useToastStore } from '@/store/toastStore';
import { useEffect, useState } from 'react';

export default function Toaster() {
  const { toasts, remove } = useToastStore();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
  }, [toasts.length]);

  const colorMap: Record<string, string> = {
    success: 'bg-emerald-600',
    error: 'bg-rose-600',
    info: 'bg-blue-600',
    warning: 'bg-amber-600',
  };

  return (
    <div className="fixed top-4 right-4 z-[1000] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm">
      {toasts.map(t => (
        <div key={t.id} className="shadow-lg rounded-lg overflow-hidden border border-gray-200 bg-white">
          <div className={`px-3 py-2 text-white text-sm font-medium ${colorMap[t.type] || 'bg-gray-800'}`}>
            {t.title || (t.type[0].toUpperCase() + t.type.slice(1))}
          </div>
          <div className="px-3 py-3 text-sm text-gray-800 flex items-start justify-between gap-3">
            <div className="whitespace-pre-wrap break-words">{t.message}</div>
            <button onClick={() => remove(t.id)} className="text-gray-400 hover:text-gray-700">✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}


