import { createContext, useContext } from 'react';

export type ToastType = 'error' | 'info' | 'success';

export interface Toast { id: number; message: string; type: ToastType }

export interface ToastCtx {
  showToast: (message: string, type?: ToastType) => void;
  toasts: Toast[];
  dismiss: (id: number) => void;
}

export const ToastContext = createContext<ToastCtx>({
  showToast: () => {},
  toasts: [],
  dismiss: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}
