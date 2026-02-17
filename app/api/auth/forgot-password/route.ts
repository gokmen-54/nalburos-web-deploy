import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/auth";

type Body = {
  identity?: string;
};

function getClientIp(request: Request): string | undefined {
  const header = request.headers.get("x-forwarded-for");
  if (!header) {
    return undefined;
  }
  return header.split(",")[0]?.trim();
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as Body;
  const identity = body.identity?.trim() ?? "";

  if (!identity) {
    return NextResponse.json({ error: "Kullanici adi veya e-posta zorunlu." }, { status: 400 });
  }

  const requestUrl = new URL(request.url);
  const baseUrl = process.env.APP_BASE_URL?.trim() || requestUrl.origin;
  const result = await requestPasswordReset(identity, baseUrl, getClientIp(request));

  return NextResponse.json({
    ok: true,
    message: "Hesap varsa sifirlama baglantisi gonderildi.",
    delivered: result.delivered,
    ...(result.devResetLink ? { devResetLink: result.devResetLink } : {})
  });
}
