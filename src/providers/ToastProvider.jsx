import { createContext, useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils.js";

export const ToastContext = createContext(undefined);

/**
 * Framework-agnostic toast context (content + error tone + duration) — same
 * shape as the reference app's ToastProvider, just rendered with a small
 * fixed-position banner instead of Polaris's <Toast>, since this app has no
 * Polaris <Frame> to host it. Auto-dismisses after `duration`.
 */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ show: false, content: "", error: false, duration: 5000 });

  const showToast = useCallback((content, error = false, duration = 5000) => {
    setToast({ show: true, content, error, duration });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, show: false }));
  }, []);

  useEffect(() => {
    if (!toast.show) return undefined;
    const timer = setTimeout(hideToast, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.show, toast.duration, hideToast]);

  return (
    <ToastContext.Provider value={{ toast, showToast, hideToast }}>
      {children}
      {toast.show && (
        <div
          role="status"
          className={cn(
            "fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm shadow-lg",
            toast.error ? "bg-destructive text-background" : "bg-foreground text-background"
          )}
        >
          <span>{toast.content}</span>
          <button
            type="button"
            onClick={hideToast}
            className="text-current/70 hover:text-current"
            aria-label="Dismiss"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
