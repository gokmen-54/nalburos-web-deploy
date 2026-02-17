import { redirect } from "next/navigation";
import type { JSX } from "react";
import { getSessionUser } from "@/lib/auth";
import { readStore } from "@/lib/store";
import { CashbookPanel } from "@/components/cashbook-panel";

export default async function CashbookPage(): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  const entries = await readStore("cashbook");
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2>Gelir / Gider Defteri</h2>
      <CashbookPanel entries={entries} />
    </div>
  );
}
