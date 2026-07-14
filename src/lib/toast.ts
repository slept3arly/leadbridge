"use client";

type ToastType = "success" | "error" | "warning" | "info" | "loading";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

type Listener = (toasts: Toast[]) => void;
let toasts: Toast[] = [];
const listeners = new Set<Listener>();

export const toastStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    // Trigger initial notification
    listener(toasts);
    return () => {
      listeners.delete(listener);
    };
  },
  getToasts() {
    return toasts;
  },
  add(toast: Omit<Toast, "id"> & { id?: string }) {
    const id = toast.id || Math.random().toString(36).substring(2, 9);
    const existingIndex = toasts.findIndex((t) => t.id === id);
    const newToast = { ...toast, id };

    if (existingIndex > -1) {
      toasts = [...toasts];
      toasts[existingIndex] = newToast;
    } else {
      toasts = [...toasts, newToast];
    }

    this.notify();

    // Only set auto-dismiss timer for non-loading toasts
    if (toast.type !== "loading" && toast.duration !== 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, toast.duration || 4000);
    }

    return id;
  },
  dismiss(id: string) {
    toasts = toasts.filter((t) => t.id !== id);
    this.notify();
  },
  notify() {
    for (const listener of listeners) {
      listener(toasts);
    }
  },
};

export const toast = {
  show(message: string, type: ToastType = "info", options?: { id?: string; duration?: number }) {
    return toastStore.add({ message, type, ...options });
  },
  success(message: string, options?: { id?: string; duration?: number }) {
    return this.show(message, "success", options);
  },
  error(message: string, options?: { id?: string; duration?: number }) {
    return this.show(message, "error", options);
  },
  warning(message: string, options?: { id?: string; duration?: number }) {
    return this.show(message, "warning", options);
  },
  info(message: string, options?: { id?: string; duration?: number }) {
    return this.show(message, "info", options);
  },
  loading(message: string, options?: { id?: string }) {
    return this.show(message, "loading", { ...options, duration: 0 });
  },
  dismiss(id: string) {
    toastStore.dismiss(id);
  },
};
