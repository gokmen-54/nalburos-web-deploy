import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import type { Permission, SessionUser } from "@/lib/types";

export async function requireUser(permission?: Permission): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  if (permission && !hasPermission(user.role, permission)) {
    return NextResponse.json({ error: "Bu islem icin yetkiniz yok." }, { status: 403 });
  }
  return user;
}
