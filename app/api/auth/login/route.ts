import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authenticate, SESSION_COOKIE, sessionCookieValue } from "@/lib/auth";

type LoginBody = {
  username?: string;
  password?: string;
};

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as LoginBody;
  const username = body.username ?? "";
  const password = body.password ?? "";

  if (!username || !password) {
    return NextResponse.json({ error: "Kullanici adi ve sifre zorunlu." }, { status: 400 });
  }

  const user = await authenticate(username, password);
  if (!user) {
    return NextResponse.json({ error: "Kullanici adi veya sifre hatali." }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionCookieValue(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });

  return NextResponse.json({ ok: true, user });
}
