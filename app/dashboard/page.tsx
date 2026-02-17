import { redirect } from "next/navigation";
import type { JSX } from "react";
import { getSessionUser } from "@/lib/auth";
import { readStore } from "@/lib/store";
import { DashboardOverview } from "@/components/dashboard-overview";

export default async function DashboardPage(): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const [products, sales, cashbook] = await Promise.all([
    readStore("products"),
    readStore("sales"),
    readStore("cashbook")
  ]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2>Dashboard</h2>
      <DashboardOverview products={products} sales={sales} cashbook={cashbook} />
    </div>
  );
}
