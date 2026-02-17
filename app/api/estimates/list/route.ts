import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listEstimates } from "@/lib/estimator";

export async function GET(request: Request): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 100);
  const estimates = await listEstimates(Number.isFinite(limit) ? limit : 100);
  return NextResponse.json({ estimates });
}
