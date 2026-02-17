import { NextResponse } from "next/server";
import { createDraftSaleWithCustomer, getOpenDraftSale } from "@/lib/pos";
import { requireUser } from "@/lib/http";

type Body = {
  customerName?: string;
  customerId?: string;
};

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireUser("pos.sell");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const sale = await createDraftSaleWithCustomer(auth, {
    customerName: body.customerName ?? "PERAKENDE SATIS",
    customerId: body.customerId
  });
  return NextResponse.json({ sale }, { status: 201 });
}

export async function GET(): Promise<NextResponse> {
  const auth = await requireUser("pos.sell");
  if (auth instanceof NextResponse) {
    return auth;
  }
  const sale = await getOpenDraftSale(auth);
  return NextResponse.json({ sale });
}
