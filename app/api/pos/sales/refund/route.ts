import { NextResponse } from "next/server";
import { refundSale } from "@/lib/pos";
import { requireUser } from "@/lib/http";

type Body = { saleId?: string };

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireUser("pos.refund");
  if (auth instanceof NextResponse) {
    return auth;
  }
  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.saleId) {
    return NextResponse.json({ error: "saleId zorunlu." }, { status: 400 });
  }
  try {
    const sale = await refundSale(auth, body.saleId);
    return NextResponse.json({ sale });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
