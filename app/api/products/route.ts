import { NextResponse } from "next/server";
import type { Product } from "@/lib/types";
import { newId, readStore, writeStore } from "@/lib/store";
import { getSessionUser } from "@/lib/auth";

type ProductBody = {
  sku?: string;
  name?: string;
  imageUrl?: string;
  categoryId?: string;
  vatRate?: number;
  unit?: Product["unit"];
  quantity?: number;
  minStock?: number;
  salePrice?: number;
  lastCost?: number;
};

export async function GET(): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const products = await readStore("products");
  return NextResponse.json({ products });
}

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const body = (await request.json()) as ProductBody;
  const sku = body.sku?.trim();
  const name = body.name?.trim();
  const unit = body.unit;

  if (!sku || !name || !unit) {
    return NextResponse.json({ error: "SKU, ad ve birim zorunlu." }, { status: 400 });
  }

  const products = await readStore("products");
  if (products.some((product) => product.sku.toLowerCase() === sku.toLowerCase())) {
    return NextResponse.json({ error: "Bu SKU zaten var." }, { status: 409 });
  }

  const newProduct: Product = {
    id: newId("prd"),
    branchId: "br_main",
    categoryId: body.categoryId?.trim() || undefined,
    sku,
    barcode: undefined,
    name,
    imageUrl: body.imageUrl?.trim() || undefined,
    unit,
    quantity: Number(body.quantity ?? 0),
    minStock: Number(body.minStock ?? 0),
    salePrice: Number(body.salePrice ?? 0),
    lastCost: Number(body.lastCost ?? 0),
    vatRate: Number(body.vatRate ?? 20),
    createdAt: new Date().toISOString()
  };

  products.unshift(newProduct);
  await writeStore("products", products);
  return NextResponse.json({ product: newProduct }, { status: 201 });
}
