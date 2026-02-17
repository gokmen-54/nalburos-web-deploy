import { NextResponse } from "next/server";
import { syncOfflineEvents } from "@/lib/pos";
import { requireUser } from "@/lib/http";

type Body = {
  eventIds?: string[];
};

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireUser("pos.sell");
  if (auth instanceof NextResponse) {
    return auth;
  }
  const body = (await request.json().catch(() => ({}))) as Body;
  const eventIds = body.eventIds ?? [];
  if (!Array.isArray(eventIds)) {
    return NextResponse.json({ error: "eventIds list olmalidir." }, { status: 400 });
  }
  const result = await syncOfflineEvents(eventIds);
  return NextResponse.json(result);
}
