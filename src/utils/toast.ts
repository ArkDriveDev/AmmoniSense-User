// src/utils/toast.ts
// Centralized notification utility for dispatching IonToast notifications across modals and services.

export interface AppToastOptions {
  message: string;
  color?: 'success' | 'warning' | 'danger' | 'primary' | 'medium';
  duration?: number;
  position?: 'top' | 'bottom' | 'middle';
}

type ToastListener = (options: AppToastOptions) => void;
const listeners = new Set<ToastListener>();

export const showToast = (options: AppToastOptions | string): void => {
  const opt: AppToastOptions = typeof options === 'string' ? { message: options } : options;
  listeners.forEach((listener) => {
    try {
      listener(opt);
    } catch (e) {
      console.error('[showToast] Error in listener:', e);
    }
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app_toast', { detail: opt }));
  }
};

export const subscribeToast = (listener: ToastListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export default showToast;
