import { redirect } from "next/navigation";
import type { JSX } from "react";
import { getSessionUser } from "@/lib/auth";
import { readStore } from "@/lib/store";
import { PaymentCorrections } from "@/components/payment-corrections";
import type { CashbookEntry, Customer, Product } from "@/lib/types";

type Alert = {
  level: "CRITICAL" | "WARNING";
  area: "CARI" | "STOK" | "FIYAT" | "KASA";
  title: string;
  detail: string;
};

type Recommendation = {
  priority: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  detail: string;
};

function buildAlerts(
  customers: Customer[],
  products: Product[],
  cashbook: CashbookEntry[]
): Alert[] {
  const alerts: Alert[] = [];
  for (const customer of customers) {
    if (customer.creditLimit > 0 && customer.balance > customer.creditLimit) {
      alerts.push({
        level: "CRITICAL",
        area: "CARI",
        title: "Kredi limiti asildi",
        detail: `${customer.name}: ${customer.balance.toFixed(2)}`
      });
    }
  }
  for (const product of products) {
    if (product.salePrice < product.lastCost) {
      alerts.push({
        level: "CRITICAL",
        area: "FIYAT",
        title: "Zararli fiyat",
        detail: `${product.name}: satis ${product.salePrice.toFixed(2)} / maliyet ${product.lastCost.toFixed(2)}`
      });
    }
  }
  const now = new Date();
  const daily = cashbook.filter((entry) => {
    const d = new Date(entry.createdAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  });
  const income = daily.filter((e) => e.type === "INCOME").reduce((s, e) => s + e.amount, 0);
  const expense = daily.filter((e) => e.type === "EXPENSE").reduce((s, e) => s + e.amount, 0);
  if (expense > income) {
    alerts.push({
      level: "WARNING",
      area: "KASA",
      title: "Gunluk nakit eksi",
      detail: `Gelir ${income.toFixed(2)} < Gider ${expense.toFixed(2)}`
    });
  }
  return alerts;
}

function buildRecommendations(customers: Customer[], products: Product[], cashbook: CashbookEntry[]): Recommendation[] {
  const list: Recommendation[] = [];
  const highRiskCustomer = [...customers]
    .filter((entry) => entry.creditLimit > 0 && entry.balance / entry.creditLimit > 0.8)
    .sort((a, b) => b.balance / b.creditLimit - a.balance / a.creditLimit)[0];
  if (highRiskCustomer) {
    list.push({
      priority: "HIGH",
      title: "Tahsilat onceligi",
      detail: `${highRiskCustomer.name} icin tahsilat plani yapin. Bakiye: ${highRiskCustomer.balance.toFixed(2)}`
    });
  }
  const negativeMargin = products.find((entry) => entry.salePrice < entry.lastCost);
  if (negativeMargin) {
    list.push({
      priority: "HIGH",
      title: "Zararli fiyat tespit edildi",
      detail: `${negativeMargin.name} urununde satis fiyati maliyet altinda.`
    });
  }
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const income = cashbook
    .filter((entry) => entry.type === "INCOME" && entry.createdAt.slice(0, 7) === monthKey)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const expense = cashbook
    .filter((entry) => entry.type === "EXPENSE" && entry.createdAt.slice(0, 7) === monthKey)
    .reduce((sum, entry) => sum + entry.amount, 0);
  if (expense > income) {
    list.push({
      priority: "MEDIUM",
      title: "Aylik nakit akis iyilestirmesi",
      detail: "Aylik gider geliri asti. Satin alma ve fiyat simulasyonunu gozden gecirin."
    });
  }
  return list;
}

export default async function ControlPage(): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const [customers, products, cashbook, payments, sales] = await Promise.all([
    readStore("customers"),
    readStore("products"),
    readStore("cashbook"),
    readStore("payments"),
    readStore("sales")
  ]);
  const alerts = buildAlerts(customers, products, cashbook);
  const recommendations = buildRecommendations(customers, products, cashbook);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2>Operasyon Kontrol Merkezi</h2>
      <div className="card">
        <h3>Canli Risk Alarmlari</h3>
        {alerts.length === 0 ? (
          <p className="muted">Kritik alarm yok.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {alerts.map((alert, index) => (
              <div key={`${alert.title}_${index}`} className={alert.level === "CRITICAL" ? "alert-critical" : "alert-warning"}>
                <strong>
                  [{alert.area}] {alert.title}
                </strong>
                <div>{alert.detail}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="card">
        <h3>Aksiyon Onerileri</h3>
        {recommendations.length === 0 ? (
          <p className="muted">Su an icin ek oneri yok.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {recommendations.map((item, index) => (
              <div key={`${item.title}_${index}`} className={item.priority === "HIGH" ? "alert-critical" : "alert-warning"}>
                <strong>[{item.priority}] {item.title}</strong>
                <div>{item.detail}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <PaymentCorrections payments={payments} sales={sales} />
    </div>
  );
}
