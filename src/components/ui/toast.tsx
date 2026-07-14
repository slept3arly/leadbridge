"use client";

import { useEffect, useState } from "react";
import { toast, toastStore, type Toast as ToastData } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "@/components/ui/loading";

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    return toastStore.subscribe((updatedToasts) => {
      setToasts(updatedToasts);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      className="fixed top-4 right-4 z-9999 flex w-full max-w-sm flex-col gap-2 p-4 md:top-6 md:right-6"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

const styles = {
  success: "border-emerald-100 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-50",
  error: "border-rose-100 bg-rose-50 text-rose-900 dark:bg-rose-950 dark:text-rose-50",
  warning: "border-amber-100 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-50",
  info: "border-slate-100 bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-50",
  loading: "border-blue-100 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-50",
};

const icons = {
  success: (
    <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="h-5 w-5 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  info: (
    <svg className="h-5 w-5 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  loading: <LoadingSpinner className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
};

function ToastItem({ toast: t }: { toast: ToastData }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border p-4 shadow-lg transition-all duration-300 animate-slide-in",
        styles[t.type]
      )}
    >
      <div className="shrink-0 mt-0.5">{icons[t.type]}</div>
      <div className="flex-1 text-sm font-medium leading-5">{t.message}</div>
      {t.type !== "loading" && (
        <button
          onClick={() => toast.dismiss(t.id)}
          className="shrink-0 text-slate-400 hover:text-slate-600 transition"
          aria-label="Close notification"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
