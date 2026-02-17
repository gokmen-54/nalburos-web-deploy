import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { newId, readStore, withStoreLock, writeStore } from "@/lib/store";
import type { PriceChange } from "@/lib/types";

type Body = {
  name?: string;
  imageUrl?: string;
  categoryId?: string;
  salePrice?: number;
  lastCost?: number;
  minStock?: number;
  vatRate?: number;
  changeReason?: string;
};

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Params): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Body;

  try {
    const result = await withStoreLock(async () => {
      const [products, history, logs] = await Promise.all([
        readStore("products"),
        readStore("price-history"),
        readStore("audit-logs")
      ]);

      const index = products.findIndex((product) => product.id === id);
      if (index < 0) {
        throw new Error("Urun bulunamadi.");
      }
      const product = products[index];

      const nextSalePrice = body.salePrice === undefined ? product.salePrice : Number(body.salePrice);
      const nextCost = body.lastCost === undefined ? product.lastCost : Number(body.lastCost);
      const hasPriceChange = nextSalePrice !== product.salePrice || nextCost !== product.lastCost;
      const changeReason = body.changeReason?.trim();
      if (hasPriceChange && !changeReason) {
        throw new Error("Fiyat veya maliyet degisiyorsa degisim nedeni zorunlu.");
      }

      products[index] = {
        ...product,
        name: body.name?.trim() || product.name,
        imageUrl: body.imageUrl?.trim() ?? product.imageUrl,
        categoryId: body.categoryId ?? product.categoryId,
        minStock: body.minStock === undefined ? product.minStock : Number(body.minStock),
        salePrice: nextSalePrice,
        lastCost: nextCost,
        vatRate: body.vatRate === undefined ? product.vatRate : Number(body.vatRate)
      };

      if (hasPriceChange) {
        const record: PriceChange = {
          id: newId("pch"),
          productId: product.id,
          oldSalePrice: product.salePrice,
          newSalePrice: nextSalePrice,
          oldCost: product.lastCost,
          newCost: nextCost,
          reason: changeReason,
          changedBy: user.username,
          createdAt: new Date().toISOString()
        };
        history.unshift(record);
      }

      logs.unshift({
        id: newId("audit"),
        action: "products.update",
        username: user.username,
        role: user.role,
        meta: JSON.stringify({ productId: id, changeReason }),
        createdAt: new Date().toISOString()
      });

      await Promise.all([
        writeStore("products", products),
        writeStore("price-history", history),
        writeStore("audit-logs", logs)
      ]);

      return products[index];
    });

    return NextResponse.json({ product: result });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: Params): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    await withStoreLock(async () => {
      const [products, stockMovements, logs] = await Promise.all([
        readStore("products"),
        readStore("stock-movements"),
        readStore("audit-logs")
      ]);
      const product = products.find((entry) => entry.id === id);
      if (!product) {
        throw new Error("Urun bulunamadi.");
      }
      const nextProducts = products.filter((entry) => entry.id !== id);
      const nextMovements = stockMovements.filter((entry) => entry.productId !== id);
      logs.unshift({
        id: newId("audit"),
        action: "products.delete",
        username: user.username,
        role: user.role,
        meta: JSON.stringify({ productId: id, sku: product.sku }),
        createdAt: new Date().toISOString()
      });
      await Promise.all([
        writeStore("products", nextProducts),
        writeStore("stock-movements", nextMovements),
        writeStore("audit-logs", logs)
      ]);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
