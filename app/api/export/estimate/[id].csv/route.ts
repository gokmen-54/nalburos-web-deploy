import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { readStore } from "@/lib/store";

type Params = {
  params: Promise<{ id: string }>;
};

function csvEscape(value: string | number): string {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

export async function GET(_request: Request, context: Params): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { id } = await context.params;
  const estimates = await readStore("estimates");
  const estimate = estimates.find((entry) => entry.id === id);
  if (!estimate) {
    return NextResponse.json({ error: "Kayit bulunamadi." }, { status: 404 });
  }

  const lines = [
    "Kalem,Gerekli Miktar,Gerekli Birim,Satis Miktari,Satis Birimi,Paket,Fiyat,Tutar",
    ...estimate.lines.map((line) =>
      [
        line.productName,
        line.requiredQuantity ?? line.quantity,
        line.requiredUnit ?? line.unit,
        line.quantity,
        line.unit,
        line.packageLabel ?? "-",
        line.salePrice,
        line.totalSale
      ]
        .map(csvEscape)
        .join(",")
    ),
    "",
    ["Toplam", "", "", "", estimate.totalSale].map(csvEscape).join(",")
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=estimate-${estimate.id}.csv`
    }
  });
}
