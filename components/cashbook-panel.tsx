"use client";

import { useState } from "react";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import type { CashbookEntry } from "@/lib/types";
import { Field } from "@/components/ui/field";
import { SectionCard } from "@/components/ui/section-card";

type Props = {
  entries: CashbookEntry[];
};

function money(value: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(value);
}

export function CashbookPanel({ entries }: Props): JSX.Element {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({
    type: "EXPENSE" as "INCOME" | "EXPENSE",
    category: "OTHER",
    amount: 0,
    note: ""
  });

  const now = new Date();
  const sameDay = (iso: string): boolean => {
    const d = new Date(iso);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  };
  const sameMonth = (iso: string): boolean => {
    const d = new Date(iso);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  };

  const dayEntries = entries.filter((entry) => sameDay(entry.createdAt));
  const monthEntries = entries.filter((entry) => sameMonth(entry.createdAt));
  const sum = (list: CashbookEntry[], type: "INCOME" | "EXPENSE"): number => list.filter((e) => e.type === type).reduce((s, e) => s + e.amount, 0);

  const dayIncome = sum(dayEntries, "INCOME");
  const dayExpense = sum(dayEntries, "EXPENSE");
  const monthIncome = sum(monthEntries, "INCOME");
  const monthExpense = sum(monthEntries, "EXPENSE");

  async function addEntry(): Promise<void> {
    setStatus("");
    const response = await fetch("/api/cashbook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setStatus(data.error ?? "Kayit hatasi");
      return;
    }
    setStatus("Kayit eklendi.");
    setForm((prev) => ({ ...prev, amount: 0, note: "" }));
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="grid-4">
        <div className="card">
          <div className="muted">Gunluk Gelir</div>
          <h3>{money(dayIncome)}</h3>
        </div>
        <div className="card">
          <div className="muted">Gunluk Gider</div>
          <h3>{money(dayExpense)}</h3>
        </div>
        <div className="card">
          <div className="muted">Aylik Gelir</div>
          <h3>{money(monthIncome)}</h3>
        </div>
        <div className="card">
          <div className="muted">Aylik Net</div>
          <h3>{money(monthIncome - monthExpense)}</h3>
        </div>
      </div>

      <SectionCard title="Gelir / Gider Kaydi">
        <div className="form-grid">
          <Field label="Kayit Tipi" unit="Secim">
            <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as "INCOME" | "EXPENSE" }))}>
              <option value="INCOME">Gelir</option>
              <option value="EXPENSE">Gider</option>
            </select>
          </Field>
          <Field label="Kategori" unit="Secim">
            <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
              <option value="SALE">Satis</option>
              <option value="COLLECTION">Tahsilat</option>
              <option value="PURCHASE">Alis</option>
              <option value="RENT">Kira</option>
              <option value="SALARY">Maas</option>
              <option value="UTILITY">Fatura</option>
              <option value="OTHER">Diger</option>
            </select>
          </Field>
          <Field label="Tutar" unit="TL" example="2500">
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: Number(e.target.value) }))}
              placeholder="Tutar"
            />
          </Field>
          <Field label="Aciklama" unit="Metin">
            <input value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} placeholder="Aciklama" />
          </Field>
          <button type="button" onClick={() => void addEntry()}>
            Kaydet
          </button>
        </div>
        {status ? <p className="muted">{status}</p> : null}
      </SectionCard>

      <div className="card">
        <h3>Defter Hareketleri</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Tip</th>
                <th>Kategori</th>
                <th>Tutar</th>
                <th>Not</th>
                <th>Kullanici</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.createdAt).toLocaleString("tr-TR")}</td>
                  <td>{entry.type}</td>
                  <td>{entry.category}</td>
                  <td>{money(entry.amount)}</td>
                  <td>{entry.note}</td>
                  <td>{entry.createdBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
