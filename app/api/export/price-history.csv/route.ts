import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { readStore } from "@/lib/store";

function csvEscape(value: string | number): string {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

export async function GET(): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const [history, products] = await Promise.all([readStore("price-history"), readStore("products")]);
  const lines = [
    "tarih,urun,eski_fiyat,yeni_fiyat,eski_maliyet,yeni_maliyet,neden,degistiren",
    ...history.map((entry) => {
      const product = products.find((p) => p.id === entry.productId);
      return [
        entry.createdAt,
        product?.name ?? entry.productId,
        entry.oldSalePrice,
        entry.newSalePrice,
        entry.oldCost,
        entry.newCost,
        entry.reason ?? "",
        entry.changedBy
      ]
        .map(csvEscape)
        .join(",");
    })
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=price-history.csv"
    }
  });
}
