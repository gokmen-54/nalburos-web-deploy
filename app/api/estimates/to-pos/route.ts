import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { addLineToSale, createDraftSaleWithCustomer } from "@/lib/pos";
import { readStore } from "@/lib/store";

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
  if (!body.estimateId) {
    return NextResponse.json({ error: "estimateId zorunlu." }, { status: 400 });
  }

  const estimates = await readStore("estimates");
  const estimate = estimates.find((entry) => entry.id === body.estimateId);
  if (!estimate) {
    return NextResponse.json({ error: "Teklif bulunamadi." }, { status: 404 });
  }

  const sale = await createDraftSaleWithCustomer(user, {
    customerId: body.customerId,
    customerName: estimate.customerName ?? "PERAKENDE SATIS"
  });

  for (const line of estimate.lines) {
    if (!line.productId || line.quantity <= 0) {
      continue;
    }
    await addLineToSale(user, {
      saleId: sale.id,
      productId: line.productId,
      quantity: line.quantity
    });
  }

  return NextResponse.json({ saleId: sale.id });
}
