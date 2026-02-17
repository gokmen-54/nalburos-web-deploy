import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { newId, readStore, withStoreLock, writeStore } from "@/lib/store";
import type { AccountEntry } from "@/lib/types";

type Body = {
  estimateId?: string;
  customerId?: string;
};

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.estimateId || !body.customerId) {
    return NextResponse.json({ error: "estimateId ve customerId zorunlu." }, { status: 400 });
  }

  const estimates = await readStore("estimates");
  const estimate = estimates.find((entry) => entry.id === body.estimateId);
  if (!estimate) {
    return NextResponse.json({ error: "Teklif bulunamadi." }, { status: 404 });
  }

  try {
    await withStoreLock(async () => {
      const [customers, entries] = await Promise.all([readStore("customers"), readStore("account-entries")]);
      const customerIndex = customers.findIndex((entry) => entry.id === body.customerId);
      if (customerIndex < 0) {
        throw new Error("Musteri bulunamadi.");
      }
      customers[customerIndex].balance += estimate.totalSale;

      const record: AccountEntry = {
        id: newId("acc"),
        customerId: body.customerId as string,
        type: "DEBIT",
        amount: estimate.totalSale,
        note: `Metraj teklifi veresiye aktarim: ${estimate.id}`,
        createdAt: new Date().toISOString(),
        createdBy: user.username
      };
      entries.unshift(record);
      await Promise.all([writeStore("customers", customers), writeStore("account-entries", entries)]);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
