import { NextResponse } from "next/server";
import { requireUser } from "@/lib/http";
import { setSaleManualDiscount } from "@/lib/pos";

type Body = {
  saleId?: string;
  amount?: number;
};

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireUser("pos.sell");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.saleId || typeof body.amount !== "number") {
    return NextResponse.json({ error: "saleId ve amount zorunlu." }, { status: 400 });
  }

  try {
    const sale = await setSaleManualDiscount(auth, {
      saleId: body.saleId,
      amount: body.amount
    });
    return NextResponse.json({ sale });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
