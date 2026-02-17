import { NextResponse } from "next/server";
import { addLineToSale, updateSaleLine } from "@/lib/pos";
import { requireUser } from "@/lib/http";

type Body = {
  saleId?: string;
  productId?: string;
  quantity?: number;
  unitPrice?: number;
  discountRate?: number;
  lineId?: string;
  mode?: "DECREASE_ONE" | "REMOVE";
};

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireUser("pos.sell");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.saleId || !body.productId || !body.quantity) {
    return NextResponse.json({ error: "saleId, productId, quantity zorunlu." }, { status: 400 });
  }

  try {
    const sale = await addLineToSale(auth, {
      saleId: body.saleId,
      productId: body.productId,
      quantity: body.quantity,
      unitPrice: body.unitPrice,
      discountRate: body.discountRate
    });
    return NextResponse.json({ sale });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const auth = await requireUser("pos.sell");
  if (auth instanceof NextResponse) {
    return auth;
  }
  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.saleId || !body.lineId || !body.mode) {
    return NextResponse.json({ error: "saleId, lineId, mode zorunlu." }, { status: 400 });
  }
  try {
    const sale = await updateSaleLine(auth, {
      saleId: body.saleId,
      lineId: body.lineId,
      mode: body.mode
    });
    return NextResponse.json({ sale });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
