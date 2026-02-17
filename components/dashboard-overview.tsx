"use client";

import { useMemo, useState } from "react";
import type { JSX } from "react";
import type { CashbookEntry, Product, Sale } from "@/lib/types";

type Props = {
  sales: Sale[];
  products: Product[];
  cashbook: CashbookEntry[];
};

function money(value: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(value);
}

type Period = "daily" | "monthly" | "yearly";

export function DashboardOverview({ sales, products, cashbook }: Props): JSX.Element {
  const [period, setPeriod] = useState<Period>("daily");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [day, setDay] = useState<number>(new Date().getDate());

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      if (sale.status !== "COMPLETED") {
        return false;
      }
      const d = new Date(sale.createdAt);
      if (period === "daily") {
        return d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === day;
      }
      if (period === "monthly") {
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      }
      return d.getFullYear() === year;
    });
  }, [sales, period, year, month, day]);

  const filteredCashbook = useMemo(() => {
    return cashbook.filter((entry) => {
      const d = new Date(entry.createdAt);
      if (period === "daily") {
        return d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === day;
      }
      if (period === "monthly") {
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      }
      return d.getFullYear() === year;
    });
  }, [cashbook, period, year, month, day]);

  const totalSales = filteredSales.reduce((sum, sale) => sum + sale.netTotal, 0);
  const totalCost = filteredSales.reduce((sum, sale) => {
    return (
      sum +
      sale.lines.reduce((lineSum, line) => {
        const product = products.find((entry) => entry.id === line.productId);
        return lineSum + line.quantity * (product?.lastCost ?? 0);
      }, 0)
    );
  }, 0);
  const grossProfit = totalSales - totalCost;

  const income = filteredCashbook.filter((entry) => entry.type === "INCOME").reduce((sum, entry) => sum + entry.amount, 0);
  const expense = filteredCashbook.filter((entry) => entry.type === "EXPENSE").reduce((sum, entry) => sum + entry.amount, 0);

  const lowStock = products.filter((entry) => entry.quantity <= entry.minStock);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="card">
        <div className="form-grid">
          <label className="field-wrap">
            <span className="field-label">Donem</span>
            <select value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
              <option value="daily">Gunluk</option>
              <option value="monthly">Aylik</option>
              <option value="yearly">Yillik</option>
            </select>
          </label>
          <label className="field-wrap">
            <span className="field-label">Yil</span>
            <input type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} />
          </label>
          {period !== "yearly" ? (
            <label className="field-wrap">
              <span className="field-label">Ay</span>
              <input type="number" min={1} max={12} value={month} onChange={(event) => setMonth(Number(event.target.value))} />
            </label>
          ) : (
            <div />
          )}
          {period === "daily" ? (
            <label className="field-wrap">
              <span className="field-label">Gun</span>
              <input type="number" min={1} max={31} value={day} onChange={(event) => setDay(Number(event.target.value))} />
            </label>
          ) : (
            <div />
          )}
        </div>
      </div>

      <div className="grid-4">
        <div className="card">
          <div className="muted">Donem Satisi</div>
          <h3>{money(totalSales)}</h3>
        </div>
        <div className="card">
          <div className="muted">Donem Brut Kar</div>
          <h3>{money(grossProfit)}</h3>
        </div>
        <div className="card">
          <div className="muted">Donem Gelir</div>
          <h3>{money(income)}</h3>
        </div>
        <div className="card">
          <div className="muted">Donem Net Kasa</div>
          <h3>{money(income - expense)}</h3>
        </div>
      </div>

      <div className="card">
        <h3>Kritik Stok Listesi</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Urun</th>
                <th>Stok</th>
                <th>Min</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.sku}</td>
                  <td>{entry.name}</td>
                  <td>{entry.quantity}</td>
                  <td>{entry.minStock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
