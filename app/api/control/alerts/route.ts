import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { readStore } from "@/lib/store";

type Alert = {
  level: "CRITICAL" | "WARNING";
  area: "CARI" | "STOK" | "FIYAT" | "KASA";
  title: string;
  detail: string;
};

export async function GET(): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const [customers, products, cashbook] = await Promise.all([
    readStore("customers"),
    readStore("products"),
    readStore("cashbook")
  ]);

  const alerts: Alert[] = [];

  for (const customer of customers) {
    if (customer.creditLimit > 0 && customer.balance > customer.creditLimit) {
      alerts.push({
        level: "CRITICAL",
        area: "CARI",
        title: "Kredi limiti asildi",
        detail: `${customer.name} bakiye: ${customer.balance.toFixed(2)} / limit: ${customer.creditLimit.toFixed(2)}`
      });
    } else if (customer.creditLimit > 0 && customer.balance > customer.creditLimit * 0.8) {
      alerts.push({
        level: "WARNING",
        area: "CARI",
        title: "Kredi limiti yaklasiyor",
        detail: `${customer.name} bakiye: ${customer.balance.toFixed(2)}`
      });
    }
  }

  for (const product of products) {
    if (product.quantity <= product.minStock) {
      alerts.push({
        level: "WARNING",
        area: "STOK",
        title: "Kritik stok",
        detail: `${product.name} stok: ${product.quantity}, min: ${product.minStock}`
      });
    }
    if (product.salePrice < product.lastCost) {
      alerts.push({
        level: "CRITICAL",
        area: "FIYAT",
        title: "Zararli fiyat",
        detail: `${product.name} satis ${product.salePrice.toFixed(2)} < maliyet ${product.lastCost.toFixed(2)}`
      });
    }
  }

  const now = new Date();
  const daily = cashbook.filter((entry) => {
    const d = new Date(entry.createdAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  });
  const income = daily.filter((e) => e.type === "INCOME").reduce((sum, e) => sum + e.amount, 0);
  const expense = daily.filter((e) => e.type === "EXPENSE").reduce((sum, e) => sum + e.amount, 0);
  if (expense > income) {
    alerts.push({
      level: "WARNING",
      area: "KASA",
      title: "Gunluk nakit eksi",
      detail: `Gelir ${income.toFixed(2)} - Gider ${expense.toFixed(2)}`
    });
  }

  return NextResponse.json({ alerts });
}
