import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { newId, readStore, withStoreLock, writeStore } from "@/lib/store";

type Body = {
  categoryId?: string;
  vatRate?: number;
};

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Body;
  const vatRate = body.vatRate;
  if (vatRate === undefined || !Number.isFinite(Number(vatRate))) {
    return NextResponse.json({ error: "Toplu islemde sadece gecerli KDV orani girin." }, { status: 400 });
  }

  const result = await withStoreLock(async () => {
    const [products, history, logs] = await Promise.all([
      readStore("products"),
      readStore("price-history"),
      readStore("audit-logs")
    ]);
    let changed = 0;

    for (const product of products) {
      if (body.categoryId && product.categoryId !== body.categoryId) {
        continue;
      }
      product.vatRate = Number(vatRate);
      history.unshift({
        id: newId("pch"),
        productId: product.id,
        oldSalePrice: product.salePrice,
        newSalePrice: product.salePrice,
        oldCost: product.lastCost,
        newCost: product.lastCost,
        reason: `Toplu KDV guncelleme -> %${Number(vatRate)}`,
        changedBy: user.username,
        createdAt: new Date().toISOString()
      });
      changed += 1;
    }

    logs.unshift({
      id: newId("audit"),
      action: "pricing.bulk.vat.adjust",
      username: user.username,
      role: user.role,
      meta: JSON.stringify({ categoryId: body.categoryId ?? "ALL", vatRate, changed }),
      createdAt: new Date().toISOString()
    });

    await Promise.all([
      writeStore("products", products),
      writeStore("price-history", history),
      writeStore("audit-logs", logs)
    ]);

    return { changed };
  });

  return NextResponse.json(result);
}
