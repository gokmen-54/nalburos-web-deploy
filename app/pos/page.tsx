import { redirect } from "next/navigation";
import type { JSX } from "react";
import { getSessionUser } from "@/lib/auth";
import { readStore } from "@/lib/store";
import { PosTerminal } from "@/components/pos-terminal";

export default async function PosPage(): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const [categories, products, customers] = await Promise.all([
    readStore("categories"),
    readStore("products"),
    readStore("customers")
  ]);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="section-head">
        <h2>Perakende Satis Terminali</h2>
        <a href="/pos-history">
          <button type="button" className="secondary">
            POS Islem Gecmisi
          </button>
        </a>
      </div>
      <PosTerminal categories={categories} initialProducts={products} customers={customers} />
    </div>
  );
}
