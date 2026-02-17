import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { readStore } from "@/lib/store";

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export async function GET(request: Request): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") === "daily" ? "daily" : "monthly";
  const now = new Date();
  const cashbook = await readStore("cashbook");

  const filtered = cashbook.filter((entry) => {
    const d = new Date(entry.createdAt);
    return period === "daily" ? sameDay(d, now) : sameMonth(d, now);
  });
  const income = filtered.filter((e) => e.type === "INCOME").reduce((s, e) => s + e.amount, 0);
  const expense = filtered.filter((e) => e.type === "EXPENSE").reduce((s, e) => s + e.amount, 0);
  return NextResponse.json({
    period,
    income,
    expense,
    net: income - expense
  });
}
