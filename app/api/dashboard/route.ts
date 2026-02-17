import { NextResponse } from "next/server";
import type { DashboardKpi } from "@/lib/types";
import { getSessionUser } from "@/lib/auth";
import { readStore } from "@/lib/store";

export async function GET(): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const products = await readStore("products");

  const kpi: DashboardKpi = {
    totalProducts: products.length,
    lowStockProducts: products.filter((entry) => entry.quantity <= entry.minStock).length,
    stockValue: products.reduce((sum, entry) => sum + entry.quantity * entry.lastCost, 0),
    totalStockUnits: products.reduce((sum, entry) => sum + entry.quantity, 0)
  };

  return NextResponse.json({ kpi });
}
