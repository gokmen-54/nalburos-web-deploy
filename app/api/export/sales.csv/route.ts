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
  const sales = await readStore("sales");
  const lines = [
    "sale_id,tarih,durum,musteri,ara_toplam,indirim,kdv,net,odenen,kalan",
    ...sales.map((sale) =>
      [
        sale.id,
        sale.createdAt,
        sale.status,
        sale.customerName,
        sale.subTotal,
        sale.discountTotal,
        sale.taxTotal,
        sale.netTotal,
        sale.paidTotal,
        sale.dueTotal
      ]
        .map(csvEscape)
        .join(",")
    )
  ];
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=sales.csv"
    }
  });
}
