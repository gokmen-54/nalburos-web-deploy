import { redirect } from "next/navigation";
import type { JSX } from "react";
import { getSessionUser } from "@/lib/auth";
import { readStore } from "@/lib/store";
import { CustomerLedger } from "@/components/customer-ledger";

export default async function CustomersPage(): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const [customers, entries] = await Promise.all([readStore("customers"), readStore("account-entries")]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="section-head">
        <h2>Cari Hesap ve Musteri Takibi</h2>
        <a href="/ledger-history">
          <button type="button" className="secondary">
            Ayrintili Cari Gecmisi
          </button>
        </a>
      </div>
      <CustomerLedger customers={customers} entries={entries} />
    </div>
  );
}
