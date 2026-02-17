import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { newId, readStore, writeStore } from "@/lib/store";
import type { CashbookCategory, CashbookEntry, CashbookType } from "@/lib/types";

type Body = {
  type?: CashbookType;
  category?: CashbookCategory;
  amount?: number;
  note?: string;
};

export async function GET(): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const entries = await readStore("cashbook");
  return NextResponse.json({ entries });
}

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.type || !body.category || !body.amount || body.amount <= 0) {
    return NextResponse.json({ error: "Tip, kategori ve tutar zorunlu." }, { status: 400 });
  }
  const entries = await readStore("cashbook");
  const entry: CashbookEntry = {
    id: newId("cb"),
    type: body.type,
    category: body.category,
    amount: Number(body.amount),
    note: body.note?.trim() || "",
    createdAt: new Date().toISOString(),
    createdBy: user.username
  };
  entries.unshift(entry);
  await writeStore("cashbook", entries);
  return NextResponse.json({ entry }, { status: 201 });
}
