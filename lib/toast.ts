"use client";

export type ToastPayload = {
  type?: "success" | "error" | "info";
  message: string;
};

export function notify(payload: ToastPayload): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent<ToastPayload>("nalburos:toast", { detail: payload }));
}
