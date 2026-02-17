import { NextResponse } from "next/server";
import type { StockMovement, StockMovementType } from "@/lib/types";
import { newId, readStore, withStoreLock, writeStore } from "@/lib/store";
import { getSessionUser } from "@/lib/auth";

type StockBody = {
  productId?: string;
  type?: StockMovementType;
  quantity?: number;
  unitCost?: number;
  salePrice?: number;
  note?: string;
};

export async function GET(): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const movements = await readStore("stock-movements");
  return NextResponse.json({ movements });
}

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const body = (await request.json()) as StockBody;
  const productId = body.productId?.trim();
  const type = body.type;
  const quantity = Number(body.quantity ?? 0);

  if (!productId || !type || Number.isNaN(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Gecerli urun, tip ve miktar zorunlu." }, { status: 400 });
  }

  const unitCost = body.unitCost === undefined ? undefined : Number(body.unitCost);
  const salePrice = body.salePrice === undefined ? undefined : Number(body.salePrice);
  if (unitCost !== undefined && (!Number.isFinite(unitCost) || unitCost <= 0)) {
    return NextResponse.json({ error: "Gecerli alis maliyeti girin." }, { status: 400 });
  }
  if (salePrice !== undefined && (!Number.isFinite(salePrice) || salePrice <= 0)) {
    return NextResponse.json({ error: "Gecerli satis fiyati girin." }, { status: 400 });
  }

  try {
    const movement = await withStoreLock(async () => {
      const [products, movements, priceHistory] = await Promise.all([
        readStore("products"),
        readStore("stock-movements"),
        readStore("price-history")
      ]);
      const productIndex = products.findIndex((product) => product.id === productId);
      if (productIndex === -1) {
        throw new Error("Urun bulunamadi.");
      }

      const product = products[productIndex];
      if (type === "OUT" && product.quantity < quantity) {
        throw new Error("Yetersiz stok.");
      }

      if (type === "IN") {
        product.quantity += quantity;
      } else if (type === "OUT") {
        product.quantity -= quantity;
      } else {
        product.quantity += quantity;
      }

      const oldCost = product.lastCost;
      const oldSalePrice = product.salePrice;
      if (unitCost !== undefined) {
        product.lastCost = Number(unitCost.toFixed(2));
      }
      if (salePrice !== undefined) {
        product.salePrice = Number(salePrice.toFixed(2));
      }

      if (oldCost !== product.lastCost || oldSalePrice !== product.salePrice) {
        priceHistory.unshift({
          id: newId("pch"),
          productId: product.id,
          oldSalePrice,
          newSalePrice: product.salePrice,
          oldCost,
          newCost: product.lastCost,
          reason: `Stok hareketi fiyat guncelleme (${type})`,
          changedBy: user.username,
          createdAt: new Date().toISOString()
        });
      }

      const movementRecord: StockMovement = {
        id: newId("mov"),
        productId,
        type,
        quantity,
        unitCost: unitCost !== undefined ? Number(unitCost.toFixed(2)) : undefined,
        note: body.note?.trim(),
        createdAt: new Date().toISOString(),
        createdBy: user.username
      };
      movements.unshift(movementRecord);

      await Promise.all([
        writeStore("products", products),
        writeStore("stock-movements", movements),
        writeStore("price-history", priceHistory)
      ]);
      return movementRecord;
    });

    return NextResponse.json({ movement }, { status: 201 });
  } catch (error) {
    const message = (error as Error).message || "Stok hareketi kaydedilemedi.";
    const status = message === "Urun bulunamadi." ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
