import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { deleteEstimate, updateEstimateStatus } from "@/lib/estimator";
import { readStore } from "@/lib/store";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Params): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { id } = await context.params;
  const estimates = await readStore("estimates");
  const estimate = estimates.find((entry) => entry.id === id);
  if (!estimate) {
    return NextResponse.json({ error: "Kayit bulunamadi." }, { status: 404 });
  }
  return NextResponse.json({ estimate });
}

type StatusBody = {
  status?: "OPEN" | "WON" | "LOST";
  note?: string;
};

export async function PATCH(request: Request, context: Params): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as StatusBody;
  if (!body.status || !["OPEN", "WON", "LOST"].includes(body.status)) {
    return NextResponse.json({ error: "Gecerli durum zorunlu." }, { status: 400 });
  }
  try {
    const estimate = await updateEstimateStatus(user, id, body.status, body.note);
    return NextResponse.json({ estimate });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: Params): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { id } = await context.params;
  try {
    await deleteEstimate(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
