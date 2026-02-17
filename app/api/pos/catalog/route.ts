import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/pos";
import { requireUser } from "@/lib/http";

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireUser("pos.sell");
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId") ?? "br_main";
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const q = searchParams.get("q") ?? undefined;
  const products = await getCatalog(branchId, categoryId, q);
  return NextResponse.json({ products });
}
