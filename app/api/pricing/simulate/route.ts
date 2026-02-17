import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { readStore } from "@/lib/store";
import type { Product } from "@/lib/types";

type Scope = "all" | "category" | "sku_list";
type ChangeMode = "percent" | "absolute" | "target_margin";

type Body = {
  scope?: Scope;
  categoryId?: string;
  skus?: string[];
  change_mode?: ChangeMode;
  value?: number;
  vat_override?: number;
};

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function findDemandQty(product: Product, sales: Awaited<ReturnType<typeof readStore<"sales">>>): number {
  const qty = sales
    .filter((sale) => sale.status === "COMPLETED")
    .flatMap((sale) => sale.lines)
    .filter((line) => line.productId === product.id)
    .reduce((sum, line) => sum + line.quantity, 0);
  return qty > 0 ? qty : 1;
}

function nextPrice(product: Product, mode: ChangeMode, value: number): number {
  if (mode === "percent") {
    return round2(product.salePrice * (1 + value / 100));
  }
  if (mode === "absolute") {
    return round2(product.salePrice + value);
  }
  const targetMargin = value / 100;
  if (targetMargin >= 0.99) {
    return product.salePrice;
  }
  return round2(product.lastCost / (1 - targetMargin));
}

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const scope = body.scope ?? "all";
  const mode = body.change_mode ?? "percent";
  const value = Number(body.value ?? 0);
  if (!Number.isFinite(value)) {
    return NextResponse.json({ error: "Gecerli value girin." }, { status: 400 });
  }

  const [products, sales] = await Promise.all([readStore("products"), readStore("sales")]);

  const selected = products.filter((product) => {
    if (scope === "all") {
      return true;
    }
    if (scope === "category") {
      return product.categoryId === body.categoryId;
    }
    const skuSet = new Set((body.skus ?? []).map((sku) => sku.toLowerCase()));
    return skuSet.has(product.sku.toLowerCase());
  });

  let beforeRevenue = 0;
  let beforeCost = 0;
  let beforeVat = 0;
  let afterRevenue = 0;
  let afterCost = 0;
  let afterVat = 0;

  const impacted = selected.map((product) => {
    const qty = findDemandQty(product, sales);
    const oldPrice = product.salePrice;
    const newPrice = Math.max(nextPrice(product, mode, value), 0);
    const vatRateBefore = product.vatRate ?? 20;
    const vatRateAfter = body.vat_override !== undefined ? Number(body.vat_override) : vatRateBefore;

    const oldRevenue = oldPrice * qty;
    const newRevenue = newPrice * qty;
    const cost = product.lastCost * qty;
    const oldVat = oldRevenue * (vatRateBefore / 100);
    const newVat = newRevenue * (vatRateAfter / 100);

    beforeRevenue += oldRevenue;
    beforeCost += cost;
    beforeVat += oldVat;
    afterRevenue += newRevenue;
    afterCost += cost;
    afterVat += newVat;

    return {
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      qtyBasis: qty,
      oldPrice,
      newPrice,
      priceDelta: round2(newPrice - oldPrice),
      oldMargin: round2(oldPrice - product.lastCost),
      newMargin: round2(newPrice - product.lastCost),
      revenueDelta: round2(newRevenue - oldRevenue)
    };
  });

  const beforeGrossProfit = beforeRevenue - beforeCost;
  const afterGrossProfit = afterRevenue - afterCost;
  const deltaRevenue = afterRevenue - beforeRevenue;
  const deltaGrossProfit = afterGrossProfit - beforeGrossProfit;
  const deltaVat = afterVat - beforeVat;

  return NextResponse.json({
    before: {
      revenue: round2(beforeRevenue),
      cost: round2(beforeCost),
      grossProfit: round2(beforeGrossProfit),
      vat: round2(beforeVat)
    },
    after: {
      revenue: round2(afterRevenue),
      cost: round2(afterCost),
      grossProfit: round2(afterGrossProfit),
      vat: round2(afterVat)
    },
    delta: {
      revenue: round2(deltaRevenue),
      grossProfit: round2(deltaGrossProfit),
      vat: round2(deltaVat),
      revenuePct: beforeRevenue > 0 ? round2((deltaRevenue / beforeRevenue) * 100) : 0,
      grossProfitPct: beforeGrossProfit > 0 ? round2((deltaGrossProfit / beforeGrossProfit) * 100) : 0
    },
    top_impacted_products: impacted
      .sort((a, b) => Math.abs(b.revenueDelta) - Math.abs(a.revenueDelta))
      .slice(0, 20)
  });
}
