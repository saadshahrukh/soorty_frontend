import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export type Toast = {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  timeoutMs?: number;
};

type ToastState = {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => string;
  remove: (id: string) => void;
  clear: () => void;
};

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = Math.random().toString(36).slice(2);
    const timeoutMs = toast.timeoutMs ?? (toast.type === 'error' ? 6000 : 3000);
    const item: Toast = { id, ...toast, timeoutMs };
    set({ toasts: [...get().toasts, item] });
    if (timeoutMs > 0) {
      setTimeout(() => {
        get().remove(id);
      }, timeoutMs);
    }
    return id;
  },
  remove: (id) => set({ toasts: get().toasts.filter(t => t.id !== id) }),
  clear: () => set({ toasts: [] })
}));

export const toast = {
  success: (message: string, title?: string) => useToastStore.getState().push({ type: 'success', message, title }),
  error: (message: string, title?: string) => useToastStore.getState().push({ type: 'error', message, title }),
  info: (message: string, title?: string) => useToastStore.getState().push({ type: 'info', message, title }),
  warning: (message: string, title?: string) => useToastStore.getState().push({ type: 'warning', message, title }),
};


