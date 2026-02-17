"use client";

import { FormEvent, useState } from "react";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Giris basarisiz");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h2>NalburOS Giris</h2>
        <p className="muted">Tek panel, mobil ve masaustu takip.</p>
        <form onSubmit={onSubmit}>
          <div style={{ display: "grid", gap: 10 }}>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Kullanici adi"
              autoComplete="username"
            />
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Sifre"
              type="password"
              autoComplete="current-password"
            />
            {error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}
            <button type="submit" disabled={loading}>
              {loading ? "Giris yapiliyor..." : "Giris Yap"}
            </button>
            <Link href="/forgot-password" className="muted" style={{ textAlign: "right", fontSize: 13 }}>
              Sifremi unuttum
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
