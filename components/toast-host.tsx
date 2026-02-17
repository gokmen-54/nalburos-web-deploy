"use client";

import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import type { ToastPayload } from "@/lib/toast";

type ToastState = {
  id: string;
  type: "success" | "error" | "info";
  message: string;
};

export function ToastHost(): JSX.Element {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    function onToast(event: Event): void {
      const custom = event as CustomEvent<ToastPayload>;
      const payload = custom.detail;
      if (!payload?.message) {
        return;
      }
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const toast: ToastState = {
        id,
        type: payload.type ?? "info",
        message: payload.message
      };
      setToasts((prev) => [...prev, toast]);
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((entry) => entry.id !== id));
        timers.current.delete(id);
      }, 2000);
      timers.current.set(id, timer);
    }

    window.addEventListener("nalburos:toast", onToast);
    return () => {
      window.removeEventListener("nalburos:toast", onToast);
      for (const timer of timers.current.values()) {
        clearTimeout(timer);
      }
      timers.current.clear();
    };
  }, []);

  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
