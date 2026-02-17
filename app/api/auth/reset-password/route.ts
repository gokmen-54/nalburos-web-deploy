import { NextResponse } from "next/server";
import { resetPassword } from "@/lib/auth";

type Body = {
  token?: string;
  password?: string;
};

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as Body;
  const token = body.token?.trim() ?? "";
  const password = body.password ?? "";

  if (!token || !password) {
    return NextResponse.json({ error: "Token ve yeni sifre zorunlu." }, { status: 400 });
  }

  const result = await resetPassword(token, password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Sifre sifirlama basarisiz." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
