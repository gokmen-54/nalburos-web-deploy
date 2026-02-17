import { redirect } from "next/navigation";
import type { JSX } from "react";
import { getSessionUser } from "@/lib/auth";
import { readStore } from "@/lib/store";
import { PricingCenter } from "@/components/pricing-center";

export default async function PricingPage(): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  const [products, categories] = await Promise.all([readStore("products"), readStore("categories")]);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2>Fiyat ve KDV Merkezi</h2>
      <PricingCenter products={products} categories={categories} />
    </div>
  );
}
