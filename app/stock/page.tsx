import { redirect } from "next/navigation";
import type { JSX } from "react";
import { getSessionUser } from "@/lib/auth";
import { readStore } from "@/lib/store";
import { StockForm } from "@/components/stock-form";
import { StockHistoryPanel } from "@/components/stock-history-panel";

export default async function StockPage(): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const [products, movements] = await Promise.all([readStore("products"), readStore("stock-movements")]);
  const inCount = movements.filter((entry) => entry.type === "IN").length;
  const outCount = movements.filter((entry) => entry.type === "OUT").length;
  const adjustCount = movements.filter((entry) => entry.type === "ADJUST").length;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2>Stok Hareketleri</h2>
      <div className="grid-4">
        <div className="card">
          <div className="muted">Toplam Hareket</div>
          <h3>{movements.length}</h3>
        </div>
        <div className="card">
          <div className="muted">Giris</div>
          <h3>{inCount}</h3>
        </div>
        <div className="card">
          <div className="muted">Cikis</div>
          <h3>{outCount}</h3>
        </div>
        <div className="card">
          <div className="muted">Duzeltme</div>
          <h3>{adjustCount}</h3>
        </div>
      </div>
      <StockForm products={products} />
      <StockHistoryPanel products={products} movements={movements} />
    </div>
  );
}
