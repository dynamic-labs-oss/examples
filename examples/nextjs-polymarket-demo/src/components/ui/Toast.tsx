"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { CheckCircle, XCircle, AlertCircle, X, Loader2 } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "loading";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (toast: Omit<Toast, "id">) => string;
  hideToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<Omit<Toast, "id">>) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...toast, id };

    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss non-loading toasts
    if (toast.type !== "loading") {
      const duration = toast.duration ?? 4000;
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateToast = useCallback(
    (id: string, updates: Partial<Omit<Toast, "id">>) => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );

      // If updating to non-loading, auto-dismiss
      if (updates.type && updates.type !== "loading") {
        const duration = updates.duration ?? 4000;
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast, hideToast, updateToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={hideToast} />
    </ToastContext.Provider>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-[380px]">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-[#3ea34b]" />,
    error: <XCircle className="w-5 h-5 text-[#e64341]" />,
    info: <AlertCircle className="w-5 h-5 text-[#4779FF]" />,
    loading: <Loader2 className="w-5 h-5 text-[#4779FF] animate-spin" />,
  };

  const bgColors = {
    success: "bg-white border-[#DADADA]",
    error: "bg-white border-[#DADADA]",
    info: "bg-white border-[#DADADA]",
    loading: "bg-white border-[#DADADA]",
  };

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-[12px] border shadow-lg animate-in slide-in-from-right-5 fade-in duration-200 ${
        bgColors[toast.type]
      }`}
    >
      <div className="shrink-0 mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] text-[#030303]">
          {toast.title}
        </p>
        {toast.message && (
          <p className="text-[12px] text-[#606060] mt-1">
            {toast.message}
          </p>
        )}
      </div>
      {toast.type !== "loading" && (
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 w-6 h-6 flex items-center justify-center text-[#606060] hover:text-[#030303] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
