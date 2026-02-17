import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    printer: "connected",
    barcode: "connected",
    scale: "connected",
    cashDrawer: "connected",
    updatedAt: new Date().toISOString()
  });
}
