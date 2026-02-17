import { redirect } from "next/navigation";
import type { JSX } from "react";
import { getSessionUser } from "@/lib/auth";
import { readStore } from "@/lib/store";

type SearchParams = {
  customerId?: string;
  type?: "ALL" | "DEBIT" | "CREDIT";
  from?: string;
  to?: string;
  q?: string;
};

function money(value: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(value);
}

function csvHref(params: SearchParams): string {
  const search = new URLSearchParams();
  if (params.customerId && params.customerId !== "ALL") {
    search.set("customerId", params.customerId);
  }
  if (params.type && params.type !== "ALL") {
    search.set("type", params.type);
  }
  if (params.from) {
    search.set("from", params.from);
  }
  if (params.to) {
    search.set("to", params.to);
  }
  if (params.q) {
    search.set("q", params.q);
  }
  const text = search.toString();
  return `/api/export/ledger-history.csv${text ? `?${text}` : ""}`;
}

export default async function LedgerHistoryPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const [customers, entries] = await Promise.all([readStore("customers"), readStore("account-entries")]);
  const customerMap = new Map(customers.map((customer) => [customer.id, customer]));
  const search = (params.q ?? "").trim().toLowerCase();

  const filtered = entries.filter((entry) => {
    const customerOk = !params.customerId || params.customerId === "ALL" || entry.customerId === params.customerId;
    const typeOk = !params.type || params.type === "ALL" || entry.type === params.type;
    const created = new Date(entry.createdAt).getTime();
    const fromOk = !params.from || created >= new Date(`${params.from}T00:00:00`).getTime();
    const toOk = !params.to || created <= new Date(`${params.to}T23:59:59`).getTime();
    const customer = customerMap.get(entry.customerId);
    const textOk =
      !search ||
      entry.note.toLowerCase().includes(search) ||
      (entry.relatedSaleId ?? "").toLowerCase().includes(search) ||
      (customer?.name ?? "").toLowerCase().includes(search) ||
      (customer?.code ?? "").toLowerCase().includes(search);
    return customerOk && typeOk && fromOk && toOk && textOk;
  });

  const totalDebit = filtered.reduce((sum, entry) => sum + (entry.type === "DEBIT" ? entry.amount : 0), 0);
  const totalCredit = filtered.reduce((sum, entry) => sum + (entry.type === "CREDIT" ? entry.amount : 0), 0);
  const remaining = totalDebit - totalCredit;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2>Cari Islem Gecmisi</h2>

      <form className="card form-grid" method="GET">
        <div className="field-wrap">
          <label className="field-label">Musteri</label>
          <select name="customerId" defaultValue={params.customerId ?? "ALL"}>
            <option value="ALL">Tum Musteriler</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.code} - {customer.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field-wrap">
          <label className="field-label">Hareket Tipi</label>
          <select name="type" defaultValue={params.type ?? "ALL"}>
            <option value="ALL">Tum Hareketler</option>
            <option value="DEBIT">Borclandir</option>
            <option value="CREDIT">Tahsilat</option>
          </select>
        </div>
        <div className="field-wrap">
          <label className="field-label">Metin Ara</label>
          <input name="q" defaultValue={params.q ?? ""} placeholder="Not, satis no veya musteri ara" />
        </div>
        <div className="field-wrap">
          <label className="field-label">Baslangic Tarihi</label>
          <input type="date" name="from" defaultValue={params.from ?? ""} />
        </div>
        <div className="field-wrap">
          <label className="field-label">Bitis Tarihi</label>
          <input type="date" name="to" defaultValue={params.to ?? ""} />
        </div>
        <div className="field-wrap" style={{ alignSelf: "end" }}>
          <button type="submit">Filtre Uygula</button>
        </div>
      </form>

      <div className="card" style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div className="help-chip">Toplam Borclandirilan: {money(totalDebit)}</div>
          <div className="help-chip">Toplam Tahsilat: {money(totalCredit)}</div>
          <div className="help-chip">Kalan Bakiye: {money(remaining)}</div>
          <div className="help-chip">Kayit: {filtered.length}</div>
        </div>
        <div>
          <a href={csvHref(params)} target="_blank">
            <button type="button" className="secondary">
              Excel (CSV) Indir
            </button>
          </a>
        </div>
      </div>

      <div className="card table-scroll">
        <table>
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Musteri</th>
              <th>Tip</th>
              <th>Tutar</th>
              <th>Kalan (Bu Hareket Sonrasi)</th>
              <th>Ilgili Satis</th>
              <th>Not</th>
              <th>Kullanici</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const running = new Map<string, number>();
              const ordered = [...filtered].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
              const rows = ordered.map((entry) => {
                const prev = running.get(entry.customerId) ?? 0;
                const next = entry.type === "DEBIT" ? prev + entry.amount : prev - entry.amount;
                running.set(entry.customerId, next);
                return { entry, next };
              });
              return rows.reverse().map(({ entry, next }) => {
                const customer = customerMap.get(entry.customerId);
                return (
                  <tr key={entry.id}>
                    <td>{new Date(entry.createdAt).toLocaleString("tr-TR")}</td>
                    <td>{customer ? `${customer.code} - ${customer.name}` : entry.customerId}</td>
                    <td>{entry.type === "DEBIT" ? "Borclandir" : "Tahsilat"}</td>
                    <td>{money(entry.amount)}</td>
                    <td>{money(next)}</td>
                    <td>{entry.relatedSaleId ?? "-"}</td>
                    <td>{entry.note || "-"}</td>
                    <td>{entry.createdBy}</td>
                  </tr>
                );
              });
            })()}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">
                  Filtreye uygun cari hareket bulunamadi.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
