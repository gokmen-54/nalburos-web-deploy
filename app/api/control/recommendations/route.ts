import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { readStore } from "@/lib/store";

type Recommendation = {
  priority: "HIGH" | "MEDIUM" | "LOW";
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

  const recommendations: Recommendation[] = [];

  const highRiskCustomer = [...customers]
    .filter((entry) => entry.creditLimit > 0 && entry.balance / entry.creditLimit > 0.8)
    .sort((a, b) => b.balance / b.creditLimit - a.balance / a.creditLimit)[0];
  if (highRiskCustomer) {
    recommendations.push({
      priority: "HIGH",
      title: "Tahsilat Onceligi",
      detail: `${highRiskCustomer.name} icin tahsilat plani olusturun (bakiye ${highRiskCustomer.balance.toFixed(2)}).`
    });
  }

  const negativeMarginProduct = products.find((entry) => entry.salePrice < entry.lastCost);
  if (negativeMarginProduct) {
    recommendations.push({
      priority: "HIGH",
      title: "Zararli Fiyat Duzeltmesi",
      detail: `${negativeMarginProduct.name} urununde satis fiyatini revize edin veya alis maliyetini guncelleyin.`
    });
  }

  const now = new Date();
  const monthlyExpenses = cashbook
    .filter((entry) => entry.type === "EXPENSE")
    .filter((entry) => entry.createdAt.slice(0, 7) === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const monthlyIncome = cashbook
    .filter((entry) => entry.type === "INCOME")
    .filter((entry) => entry.createdAt.slice(0, 7) === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
    .reduce((sum, entry) => sum + entry.amount, 0);
  if (monthlyExpenses > monthlyIncome) {
    recommendations.push({
      priority: "MEDIUM",
      title: "Nakit Akisi Iyilestirme",
      detail: "Bu ay giderler gelirden yuksek. Alis kalemlerini ve stok devir hizini gozden gecirin."
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: "LOW",
      title: "Durum Stabil",
      detail: "Acil finans riski gorunmuyor. Haftalik fiyat simulasyonu ile karlilik kontrolu yapin."
    });
  }

  return NextResponse.json({ recommendations });
}
