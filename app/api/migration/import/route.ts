import { NextResponse } from "next/server";
import { requireUser } from "@/lib/http";
import { newId, readStore, withStoreLock, writeStore } from "@/lib/store";
import type { Category, Product } from "@/lib/types";

type ImportProduct = {
  sku: string;
  name: string;
  category?: string;
  barcode?: string;
  unit?: Product["unit"];
  quantity?: number;
  minStock?: number;
  salePrice?: number;
  lastCost?: number;
};

type Body = {
  products?: ImportProduct[];
};

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireUser("pos.sell");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const incoming = body.products ?? [];
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return NextResponse.json({ error: "products listesi zorunlu." }, { status: 400 });
  }

  const result = await withStoreLock(async () => {
    const [products, categories, logs] = await Promise.all([
      readStore("products"),
      readStore("categories"),
      readStore("audit-logs")
    ]);

    let inserted = 0;
    let updated = 0;
    const categoryMap = new Map(categories.map((cat) => [cat.name.toLowerCase(), cat.id]));

    for (const item of incoming) {
      if (!item.sku || !item.name) {
        continue;
      }
      let categoryId: string | undefined;
      const categoryName = item.category?.trim();
      if (categoryName) {
        const existingId = categoryMap.get(categoryName.toLowerCase());
        if (existingId) {
          categoryId = existingId;
        } else {
          const category: Category = {
            id: newId("cat"),
            name: categoryName,
            hotkey: "",
            createdAt: new Date().toISOString()
          };
          categories.push(category);
          categoryMap.set(categoryName.toLowerCase(), category.id);
          categoryId = category.id;
        }
      }

      const index = products.findIndex((product) => product.sku.toLowerCase() === item.sku.toLowerCase());
      if (index >= 0) {
        products[index] = {
          ...products[index],
          name: item.name,
          categoryId: categoryId ?? products[index].categoryId,
          barcode: item.barcode ?? products[index].barcode,
          unit: item.unit ?? products[index].unit,
          quantity: Number(item.quantity ?? products[index].quantity),
          minStock: Number(item.minStock ?? products[index].minStock),
          salePrice: Number(item.salePrice ?? products[index].salePrice),
          lastCost: Number(item.lastCost ?? products[index].lastCost)
        };
        updated += 1;
      } else {
        products.push({
          id: newId("prd"),
          branchId: "br_main",
          categoryId,
          sku: item.sku,
          barcode: item.barcode,
          name: item.name,
          unit: item.unit ?? "piece",
          quantity: Number(item.quantity ?? 0),
          minStock: Number(item.minStock ?? 0),
          salePrice: Number(item.salePrice ?? 0),
          lastCost: Number(item.lastCost ?? 0),
          createdAt: new Date().toISOString()
        });
        inserted += 1;
      }
    }

    logs.unshift({
      id: newId("audit"),
      action: "migration.import.products",
      username: auth.username,
      role: auth.role,
      meta: JSON.stringify({ inserted, updated, totalIncoming: incoming.length }),
      createdAt: new Date().toISOString()
    });

    await Promise.all([
      writeStore("products", products),
      writeStore("categories", categories),
      writeStore("audit-logs", logs)
    ]);

    return { inserted, updated, totalIncoming: incoming.length };
  });

  return NextResponse.json(result);
}
