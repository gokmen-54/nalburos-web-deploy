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
  const customerId = url.searchParams.get("customerId");
  const type = url.searchParams.get("type");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  const [customers, entries] = await Promise.all([readStore("customers"), readStore("account-entries")]);
  const customerMap = new Map(customers.map((customer) => [customer.id, customer]));

  const filtered = entries.filter((entry) => {
    const customerOk = !customerId || customerId === "ALL" || entry.customerId === customerId;
    const typeOk = !type || type === "ALL" || entry.type === type;
    const created = new Date(entry.createdAt).getTime();
    const fromOk = !from || created >= new Date(`${from}T00:00:00`).getTime();
    const toOk = !to || created <= new Date(`${to}T23:59:59`).getTime();
    const customer = customerMap.get(entry.customerId);
    const textOk =
      !q ||
      entry.note.toLowerCase().includes(q) ||
      (entry.relatedSaleId ?? "").toLowerCase().includes(q) ||
      (customer?.name ?? "").toLowerCase().includes(q) ||
      (customer?.code ?? "").toLowerCase().includes(q);
    return customerOk && typeOk && fromOk && toOk && textOk;
  });

  const lines = [
    "tarih,musteri_kod,musteri,tip,tutar,satis_no,not,kullanici",
    ...filtered.map((entry) => {
      const customer = customerMap.get(entry.customerId);
      return [
        entry.createdAt,
        customer?.code ?? "",
        customer?.name ?? "",
        entry.type,
        entry.amount,
        entry.relatedSaleId ?? "",
        entry.note ?? "",
        entry.createdBy
      ]
        .map(csvEscape)
        .join(",");
    })
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=ledger-history.csv"
    }
  });
}
