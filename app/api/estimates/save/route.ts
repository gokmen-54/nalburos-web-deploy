import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { saveEstimate } from "@/lib/estimator";
import type { Estimate } from "@/lib/types";

type Body = {
  estimate?: Estimate;
};

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.estimate) {
    return NextResponse.json({ error: "estimate zorunlu." }, { status: 400 });
  }
  try {
    const saved = await saveEstimate(user, body.estimate);
    return NextResponse.json({ estimate: saved }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
