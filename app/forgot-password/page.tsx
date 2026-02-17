"use client";

import type { JSX } from "react";
import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage(): JSX.Element {
  const [identity, setIdentity] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity })
    });
    const data = (await response.json()) as { error?: string; message?: string; devResetLink?: string };
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Istek basarisiz.");
      return;
    }

    let uiMessage = data.message ?? "Istek alindi.";
    if (data.devResetLink) {
      uiMessage += ` (Gelistirme baglantisi: ${data.devResetLink})`;
    }
    setMessage(uiMessage);
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h2>Sifremi Unuttum</h2>
        <p className="muted">Kullanici adi veya e-posta gir. Hesap varsa sifirlama linki gelir.</p>
        <form onSubmit={onSubmit}>
          <div style={{ display: "grid", gap: 10 }}>
            <input
              value={identity}
              onChange={(event) => setIdentity(event.target.value)}
              placeholder="Kullanici adi veya e-posta"
              autoComplete="username"
            />
            {error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}
            {message ? <div style={{ color: "#065f46" }}>{message}</div> : null}
            <button type="submit" disabled={loading}>
              {loading ? "Gonderiliyor..." : "Sifirlama Maili Gonder"}
            </button>
            <Link href="/login" className="muted" style={{ textAlign: "right", fontSize: 13 }}>
              Giris ekranina don
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
