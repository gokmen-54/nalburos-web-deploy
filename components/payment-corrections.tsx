"use client";

import { useState } from "react";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import type { Payment, Sale } from "@/lib/types";

type Props = {
  payments: Payment[];
  sales: Sale[];
};

function money(value: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(value);
}

export function PaymentCorrections({ payments, sales }: Props): JSX.Element {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState("");

  async function reverse(paymentId: string): Promise<void> {
    setLoading(paymentId);
    setStatus("");
    const response = await fetch("/api/pos/payments/reverse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, note })
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setStatus(data.error ?? "Duzeltme basarisiz.");
      setLoading("");
      return;
    }
    setStatus("Odeme ters kayitlandi.");
    setLoading("");
    router.refresh();
  }

  return (
    <div className="card">
      <h3>Yanlis Odeme Duzeltme</h3>
      <div className="form-grid">
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Duzeltme aciklamasi" />
      </div>
      {status ? <p className="muted">{status}</p> : null}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Odeme ID</th>
              <th>Satis</th>
              <th>Tip</th>
              <th>Tutar</th>
              <th>Tarih</th>
              <th>Islem</th>
            </tr>
          </thead>
          <tbody>
            {payments.slice(0, 40).map((payment) => {
              const sale = sales.find((entry) => entry.id === payment.saleId);
              return (
                <tr key={payment.id}>
                  <td>{payment.id}</td>
                  <td>{sale?.customerName ?? payment.saleId}</td>
                  <td>{payment.method}</td>
                  <td>{money(payment.amount)}</td>
                  <td>{new Date(payment.createdAt).toLocaleString("tr-TR")}</td>
                  <td>
                    <button
                      className="danger"
                      type="button"
                      onClick={() => void reverse(payment.id)}
                      disabled={loading === payment.id}
                    >
                      {loading === payment.id ? "Isleniyor..." : "Ters Kayit"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
