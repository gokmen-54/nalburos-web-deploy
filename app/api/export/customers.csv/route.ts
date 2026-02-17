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
  const customers = await readStore("customers");
  const lines = [
    "id,kod,isim,telefon,adres,kredi_limiti,bakiye",
    ...customers.map((customer) =>
      [
        customer.id,
        customer.code,
        customer.name,
        customer.phone ?? "",
        customer.address ?? "",
        customer.creditLimit,
        customer.balance
      ]
        .map(csvEscape)
        .join(",")
    )
  ];
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=customers.csv"
    }
  });
}
