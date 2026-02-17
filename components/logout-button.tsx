"use client";

import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton(): JSX.Element {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLogout(): Promise<void> {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
    setLoading(false);
  }

  return (
    <button className="secondary logout-btn" onClick={onLogout} disabled={loading}>
      {loading ? "Cikis..." : "Cikis"}
    </button>
  );
}
