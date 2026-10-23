"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, X } from "lucide-react";
import { toast, type ToastItem } from "@/lib/toast";

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsub = toast.subscribe(setToasts);
    return () => { unsub(); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg text-sm animate-in slide-in-from-bottom-2 ${
            t.type === "success"
              ? "bg-white border-green-200 text-green-800"
              : "bg-white border-red-200 text-red-700"
          }`}
        >
          {t.type === "success" ? (
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-green-600" />
          ) : (
            <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
          )}
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="shrink-0 text-[#606060] hover:text-[#030303] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
