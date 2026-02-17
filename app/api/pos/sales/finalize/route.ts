import { NextResponse } from "next/server";
import { finalizeSale } from "@/lib/pos";
import { requireUser } from "@/lib/http";
import { hasPermission } from "@/lib/permissions";

type Body = {
  saleId?: string;
  idempotencyKey?: string;
  allowOverLimit?: boolean;
};

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireUser("pos.sell");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.saleId) {
    return NextResponse.json({ error: "saleId zorunlu." }, { status: 400 });
  }

  try {
    if (body.allowOverLimit && !hasPermission(auth.role, "cari.override_limit")) {
      return NextResponse.json({ error: "Limit asimi icin yetkiniz yok." }, { status: 403 });
    }
    const result = await finalizeSale(auth, {
      saleId: body.saleId,
      idempotencyKey: body.idempotencyKey,
      allowOverLimit: Boolean(body.allowOverLimit)
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
