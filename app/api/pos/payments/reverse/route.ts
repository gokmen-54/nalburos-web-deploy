import { NextResponse } from "next/server";
import { requireUser } from "@/lib/http";
import { reversePayment } from "@/lib/pos";

type Body = {
  paymentId?: string;
  note?: string;
};

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireUser("finance.reverse_payment");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.paymentId) {
    return NextResponse.json({ error: "paymentId zorunlu." }, { status: 400 });
  }

  try {
    const result = await reversePayment(auth, body.paymentId, body.note ?? "");
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
