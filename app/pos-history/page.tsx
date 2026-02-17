import { redirect } from "next/navigation";
import type { JSX } from "react";
import { getSessionUser } from "@/lib/auth";
import { readStore } from "@/lib/store";

type SearchParams = {
  status?: "ALL" | "DRAFT" | "COMPLETED" | "VOIDED" | "REFUNDED";
  from?: string;
  to?: string;
  q?: string;
};

function money(value: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(value);
}

function csvHref(params: SearchParams): string {
  const search = new URLSearchParams();
  if (params.status && params.status !== "ALL") {
    search.set("status", params.status);
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
  return `/api/export/pos-history.csv${text ? `?${text}` : ""}`;
}

export default async function PosHistoryPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const [sales, payments] = await Promise.all([readStore("sales"), readStore("payments")]);
  const search = (params.q ?? "").trim().toLowerCase();
  const filtered = sales.filter((sale) => {
    const statusOk = !params.status || params.status === "ALL" || sale.status === params.status;
    const created = new Date(sale.createdAt).getTime();
    const fromOk = !params.from || created >= new Date(`${params.from}T00:00:00`).getTime();
    const toOk = !params.to || created <= new Date(`${params.to}T23:59:59`).getTime();
    const textOk =
      !search ||
      sale.id.toLowerCase().includes(search) ||
      sale.customerName.toLowerCase().includes(search) ||
      sale.createdBy.toLowerCase().includes(search);
    return statusOk && fromOk && toOk && textOk;
  });

  const totalNet = filtered.reduce((sum, sale) => sum + sale.netTotal, 0);
  const totalPaid = filtered.reduce((sum, sale) => sum + sale.paidTotal, 0);
  const totalDue = filtered.reduce((sum, sale) => sum + sale.dueTotal, 0);
  const completedCount = filtered.filter((sale) => sale.status === "COMPLETED").length;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2>POS Islem Gecmisi</h2>

      <form className="card form-grid" method="GET">
        <div className="field-wrap">
          <label className="field-label">Durum</label>
          <select name="status" defaultValue={params.status ?? "ALL"}>
            <option value="ALL">Tum Durumlar</option>
            <option value="DRAFT">Taslak</option>
            <option value="COMPLETED">Tamamlandi</option>
            <option value="VOIDED">Iptal</option>
            <option value="REFUNDED">Iade</option>
          </select>
        </div>
        <div className="field-wrap">
          <label className="field-label">Metin Ara</label>
          <input name="q" defaultValue={params.q ?? ""} placeholder="Satis no, musteri, kullanici" />
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
          <div className="help-chip">Kayit: {filtered.length}</div>
          <div className="help-chip">Tamamlanan: {completedCount}</div>
          <div className="help-chip">Net Toplam: {money(totalNet)}</div>
          <div className="help-chip">Odeme Toplami: {money(totalPaid)}</div>
          <div className="help-chip">Kalan Alacak: {money(totalDue)}</div>
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
              <th>Satis No</th>
              <th>Durum</th>
              <th>Musteri</th>
              <th>Kalem</th>
              <th>Net</th>
              <th>Odendi</th>
              <th>Kalan</th>
              <th>Paraustu</th>
              <th>Odeme Yontemleri</th>
              <th>Kullanici</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((sale) => {
              const salePayments = payments.filter((payment) => payment.saleId === sale.id);
              const methods = Array.from(new Set(salePayments.map((payment) => payment.method)));
              return (
                <tr key={sale.id}>
                  <td>{new Date(sale.createdAt).toLocaleString("tr-TR")}</td>
                  <td>{sale.id}</td>
                  <td>{sale.status}</td>
                  <td>{sale.customerName}</td>
                  <td>{sale.lines.length}</td>
                  <td>{money(sale.netTotal)}</td>
                  <td>{money(sale.paidTotal)}</td>
                  <td>{money(sale.dueTotal)}</td>
                  <td>{money(sale.changeTotal ?? Math.max(sale.paidTotal - sale.netTotal, 0))}</td>
                  <td>{methods.length > 0 ? methods.join(", ") : "-"}</td>
                  <td>{sale.createdBy}</td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="muted">
                  Filtreye uygun POS islemi bulunamadi.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
