import { NextResponse } from "next/server";
import { addPayment } from "@/lib/pos";
import { requireUser } from "@/lib/http";
import type { InstallmentPlan, PaymentMethod } from "@/lib/types";

type Body = {
  saleId?: string;
  method?: PaymentMethod;
  amount?: number;
  reference?: string;
  installmentPlan?: InstallmentPlan;
};

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireUser("pos.sell");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.saleId || !body.method || !body.amount) {
    return NextResponse.json({ error: "saleId, method, amount zorunlu." }, { status: 400 });
  }

  try {
    const sale = await addPayment(auth, body.saleId, {
      method: body.method,
      amount: body.amount,
      reference: body.reference,
      installmentPlan: body.installmentPlan
    });
    return NextResponse.json({ sale });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
