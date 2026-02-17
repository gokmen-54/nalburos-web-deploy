import { redirect } from "next/navigation";
import type { JSX } from "react";
import { getSessionUser } from "@/lib/auth";
import { readStore } from "@/lib/store";
import { EstimatorWorkbench } from "@/components/estimator-workbench";

export default async function EstimatorPage(): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  const [templates, customers] = await Promise.all([readStore("recipe-templates"), readStore("customers")]);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2>Metraj ve Sarfiyat Hesap</h2>
      <EstimatorWorkbench templates={templates} customers={customers} />
    </div>
  );
}
