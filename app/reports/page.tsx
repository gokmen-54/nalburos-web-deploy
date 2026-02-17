import { redirect } from "next/navigation";
import type { JSX } from "react";
import { getSessionUser } from "@/lib/auth";
import { readStore } from "@/lib/store";

function money(value: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(value);
}

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default async function ReportsPage(): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const [sales, products, priceHistory, customers, cashbook] = await Promise.all([
    readStore("sales"),
    readStore("products"),
    readStore("price-history"),
    readStore("customers"),
    readStore("cashbook")
  ]);

  const completed = sales.filter((sale) => sale.status === "COMPLETED");
  const totalRevenue = completed.reduce((sum, sale) => sum + sale.netTotal, 0);
  const totalCost = completed.reduce((sum, sale) => {
    const lineCost = sale.lines.reduce((lineSum, line) => {
      const product = products.find((item) => item.id === line.productId);
      return lineSum + line.quantity * (product?.lastCost ?? 0);
    }, 0);
    return sum + lineCost;
  }, 0);
  const grossProfit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const topProducts = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const sale of completed) {
    for (const line of sale.lines) {
      const current = topProducts.get(line.productId) ?? { name: line.productName, qty: 0, revenue: 0 };
      current.qty += line.quantity;
      current.revenue += line.lineTotal;
      topProducts.set(line.productId, current);
    }
  }
  const topList = Array.from(topProducts.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  const maxRevenue = topList[0]?.revenue ?? 1;
  const highBalances = [...customers].sort((a, b) => b.balance - a.balance).slice(0, 8);
  const now = new Date();
  const months = Array.from({ length: 6 }).map((_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { key, label: d.toLocaleString("tr-TR", { month: "short", year: "numeric" }) };
  });
  const monthlyTrend = months.map((m) => {
    const revenue = completed
      .filter((sale) => sale.createdAt.slice(0, 7) === m.key)
      .reduce((sum, sale) => sum + sale.netTotal, 0);
    const expense = cashbook
      .filter((entry) => entry.type === "EXPENSE" && entry.createdAt.slice(0, 7) === m.key)
      .reduce((sum, entry) => sum + entry.amount, 0);
    return { ...m, revenue, expense, net: revenue - expense };
  });
  const maxNet = Math.max(...monthlyTrend.map((t) => Math.max(t.net, 1)), 1);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2>Satis ve Kar Analizi</h2>

      <div className="card" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <a href="/api/export/sales.csv" target="_blank">
          <button type="button" className="secondary">
            Satis CSV
          </button>
        </a>
        <a href="/api/export/customers.csv" target="_blank">
          <button type="button" className="secondary">
            Cari CSV
          </button>
        </a>
        <a href="/api/export/price-history.csv" target="_blank">
          <button type="button" className="secondary">
            Fiyat Gecmisi CSV
          </button>
        </a>
      </div>

      <div className="grid-4">
        <div className="card">
          <div className="muted">Toplam Satis</div>
          <h3>{money(totalRevenue)}</h3>
        </div>
        <div className="card">
          <div className="muted">Tahmini Maliyet</div>
          <h3>{money(totalCost)}</h3>
        </div>
        <div className="card">
          <div className="muted">Brut Kar</div>
          <h3>{money(grossProfit)}</h3>
        </div>
        <div className="card">
          <div className="muted">Kar Marji</div>
          <h3>{pct(margin)}</h3>
        </div>
      </div>

      <div className="card">
        <h3>En Cok Satis Yapan Urunler</h3>
        <div className="bar-list">
          {topList.length === 0 ? (
            <p className="muted">Henuz satis verisi yok.</p>
          ) : (
            topList.map((item) => (
              <div key={item.name} className="bar-row">
                <div className="bar-head">
                  <strong>{item.name}</strong>
                  <span>{money(item.revenue)}</span>
                </div>
                <div className="bar-bg">
                  <div className="bar-fill" style={{ width: `${(item.revenue / maxRevenue) * 100}%` }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card">
        <h3>Aylik Net Trend (Satis - Gider)</h3>
        <div className="bar-list">
          {monthlyTrend.map((item) => (
            <div key={item.key} className="bar-row">
              <div className="bar-head">
                <strong>{item.label}</strong>
                <span>{money(item.net)}</span>
              </div>
              <div className="bar-bg">
                <div className="bar-fill" style={{ width: `${(Math.max(item.net, 0) / maxNet) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Riskli Cari Bakiyeler</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Kod</th>
                <th>Musteri</th>
                <th>Bakiye</th>
                <th>Kredi Limiti</th>
              </tr>
            </thead>
            <tbody>
              {highBalances.map((item) => (
                <tr key={item.id}>
                  <td>{item.code}</td>
                  <td>{item.name}</td>
                  <td>{money(item.balance)}</td>
                  <td>{money(item.creditLimit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>Fiyat Degisim Gecmisi</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Urun</th>
                <th>Satis Eski</th>
                <th>Satis Yeni</th>
                <th>Maliyet Eski</th>
                <th>Maliyet Yeni</th>
                <th>Neden</th>
                <th>Kullanici</th>
              </tr>
            </thead>
            <tbody>
              {priceHistory.map((item) => {
                const product = products.find((entry) => entry.id === item.productId);
                return (
                  <tr key={item.id}>
                    <td>{new Date(item.createdAt).toLocaleString("tr-TR")}</td>
                    <td>{product?.name ?? item.productId}</td>
                    <td>{money(item.oldSalePrice)}</td>
                    <td>{money(item.newSalePrice)}</td>
                    <td>{money(item.oldCost)}</td>
                    <td>{money(item.newCost)}</td>
                    <td>{item.reason ?? "-"}</td>
                    <td>{item.changedBy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
