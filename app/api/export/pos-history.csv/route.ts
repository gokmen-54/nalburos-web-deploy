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

export async function GET(request: Request): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  const [sales, payments] = await Promise.all([readStore("sales"), readStore("payments")]);
  const filtered = sales.filter((sale) => {
    const statusOk = !status || status === "ALL" || sale.status === status;
    const created = new Date(sale.createdAt).getTime();
    const fromOk = !from || created >= new Date(`${from}T00:00:00`).getTime();
    const toOk = !to || created <= new Date(`${to}T23:59:59`).getTime();
    const textOk =
      !q ||
      sale.id.toLowerCase().includes(q) ||
      sale.customerName.toLowerCase().includes(q) ||
      sale.createdBy.toLowerCase().includes(q);
    return statusOk && fromOk && toOk && textOk;
  });

  const lines = [
    "tarih,satis_no,durum,musteri,kalem_sayisi,ara_toplam,indirim,kdv,net,odenen,kalan,paraustu,odeme_yontemleri,kullanici",
    ...filtered.map((sale) => {
      const methods = Array.from(new Set(payments.filter((payment) => payment.saleId === sale.id).map((payment) => payment.method)));
      return [
        sale.createdAt,
        sale.id,
        sale.status,
        sale.customerName,
        sale.lines.length,
        sale.subTotal,
        sale.discountTotal,
        sale.taxTotal,
        sale.netTotal,
        sale.paidTotal,
        sale.dueTotal,
        sale.changeTotal ?? Math.max(sale.paidTotal - sale.netTotal, 0),
        methods.join("|"),
        sale.createdBy
      ]
        .map(csvEscape)
        .join(",");
    })
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=pos-history.csv"
    }
  });
}
