import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { newId, readStore, withStoreLock, writeStore } from "@/lib/store";
import type { Customer } from "@/lib/types";

type Body = {
  code?: string;
  name?: string;
  phone?: string;
  address?: string;
  creditLimit?: number;
};

export async function GET(): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const customers = await readStore("customers");
  return NextResponse.json({ customers });
}

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Body;
  const code = body.code?.trim();
  const name = body.name?.trim();
  if (!code || !name) {
    return NextResponse.json({ error: "Kod ve isim zorunlu." }, { status: 400 });
  }

  const customer = await withStoreLock(async () => {
    const customers = await readStore("customers");
    if (customers.some((entry) => entry.code.toLowerCase() === code.toLowerCase())) {
      throw new Error("Ayni kodla musteri var.");
    }
    const row: Customer = {
      id: newId("cus"),
      code,
      name,
      phone: body.phone?.trim() || "",
      address: body.address?.trim() || "",
      creditLimit: Number(body.creditLimit ?? 0),
      balance: 0,
      createdAt: new Date().toISOString()
    };
    customers.unshift(row);
    await writeStore("customers", customers);
    return row;
  });

  return NextResponse.json({ customer }, { status: 201 });
}
