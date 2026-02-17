import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { newId, readStore, withStoreLock, writeStore } from "@/lib/store";

type Row = {
  sku?: string;
  salePrice?: number;
  vatRate?: number;
};

type Body = {
  rows?: Row[];
};

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Body;
  const rows = body.rows ?? [];
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "rows zorunlu." }, { status: 400 });
  }

  const result = await withStoreLock(async () => {
    const [products, history, logs] = await Promise.all([
      readStore("products"),
      readStore("price-history"),
      readStore("audit-logs")
    ]);
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const sku = row.sku?.trim();
      const price = Number(row.salePrice ?? NaN);
      if (!sku || !Number.isFinite(price) || price <= 0) {
        skipped += 1;
        continue;
      }
      const product = products.find((entry) => entry.sku.toLowerCase() === sku.toLowerCase());
      if (!product) {
        skipped += 1;
        continue;
      }
      const oldSale = product.salePrice;
      const oldCost = product.lastCost;
      product.salePrice = Number(price.toFixed(2));
      if (row.vatRate !== undefined && Number.isFinite(Number(row.vatRate))) {
        product.vatRate = Number(row.vatRate);
      }
      history.unshift({
        id: newId("pch"),
        productId: product.id,
        oldSalePrice: oldSale,
        newSalePrice: product.salePrice,
        oldCost,
        newCost: oldCost,
        reason: "Fiyat listesi import",
        changedBy: user.username,
        createdAt: new Date().toISOString()
      });
      updated += 1;
    }

    logs.unshift({
      id: newId("audit"),
      action: "pricing.import",
      username: user.username,
      role: user.role,
      meta: JSON.stringify({ updated, skipped, total: rows.length }),
      createdAt: new Date().toISOString()
    });

    await Promise.all([
      writeStore("products", products),
      writeStore("price-history", history),
      writeStore("audit-logs", logs)
    ]);
    return { updated, skipped, total: rows.length };
  });

  return NextResponse.json(result);
}
