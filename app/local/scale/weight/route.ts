import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    unit: "kg",
    weight: 0,
    updatedAt: new Date().toISOString()
  });
}
