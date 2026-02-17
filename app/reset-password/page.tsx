"use client";

import type { JSX } from "react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function ResetPasswordPage(): JSX.Element {
  const params = useSearchParams();
  const token = useMemo(() => params.get("token") ?? "", [params]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("Sifirlama tokeni bulunamadi.");
      return;
    }
    if (password !== confirm) {
      setError("Sifre tekrar alani eslesmiyor.");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password })
    });
    const data = (await response.json()) as { error?: string };
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Sifre yenilenemedi.");
      return;
    }

    setMessage("Sifre basariyla guncellendi. Simdi giris yapabilirsin.");
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h2>Yeni Sifre Belirle</h2>
        <p className="muted">En az 8 karakter, buyuk-kucuk harf ve rakam kullan.</p>
        <form onSubmit={onSubmit}>
          <div style={{ display: "grid", gap: 10 }}>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Yeni sifre"
              autoComplete="new-password"
            />
            <input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Yeni sifre (tekrar)"
              autoComplete="new-password"
            />
            {error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}
            {message ? <div style={{ color: "#065f46" }}>{message}</div> : null}
            <button type="submit" disabled={loading}>
              {loading ? "Kaydediliyor..." : "Sifreyi Guncelle"}
            </button>
            <Link href="/login" className="muted" style={{ textAlign: "right", fontSize: 13 }}>
              Giris ekranina git
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
