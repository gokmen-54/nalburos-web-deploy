import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { newId, readStore, withStoreLock, writeStore } from "@/lib/store";
import type { AccountEntry } from "@/lib/types";

type Body = {
  type?: "DEBIT" | "CREDIT";
  amount?: number;
  note?: string;
};

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Params): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { id } = await context.params;
  const entries = await readStore("account-entries");
  return NextResponse.json({
    entries: entries.filter((entry) => entry.customerId === id)
  });
}

export async function POST(request: Request, context: Params): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.type || !body.amount || body.amount <= 0) {
    return NextResponse.json({ error: "Tip ve tutar zorunlu." }, { status: 400 });
  }

  try {
    const result = await withStoreLock(async () => {
      const [customers, entries] = await Promise.all([readStore("customers"), readStore("account-entries")]);
      const customerIndex = customers.findIndex((entry) => entry.id === id);
      if (customerIndex < 0) {
        throw new Error("Musteri bulunamadi.");
      }
      const amount = Number(body.amount);
      const entryType = body.type as "DEBIT" | "CREDIT";
      if (entryType === "DEBIT") {
        customers[customerIndex].balance += amount;
      } else {
        customers[customerIndex].balance -= amount;
      }

      const record: AccountEntry = {
        id: newId("acc"),
        customerId: id,
        type: entryType,
        amount,
        note: body.note?.trim() || "",
        createdAt: new Date().toISOString(),
        createdBy: user.username
      };
      entries.unshift(record);
      await Promise.all([writeStore("customers", customers), writeStore("account-entries", entries)]);
      return { customer: customers[customerIndex], entry: record };
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
