import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export async function GET(): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const rows = [
    "SKU,FIYAT,KDV",
    "VIDA-5X40,8.75,20",
    "SILIKON-BEYAZ,129.90,20",
    "PPR-DIRSEK-20MM,24.50,20"
  ];

  const csv = `\uFEFF${rows.join("\n")}`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=pricing-import-template.csv"
    }
  });
}
