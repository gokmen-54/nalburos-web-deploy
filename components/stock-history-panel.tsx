"use client";

import { useMemo, useState } from "react";
import type { JSX } from "react";
import type { Product, StockMovement, StockMovementType } from "@/lib/types";

type Props = {
  products: Product[];
  movements: StockMovement[];
};

function movementTypeLabel(type: StockMovementType): string {
  if (type === "IN") {
    return "Giris";
  }
  if (type === "OUT") {
    return "Cikis";
  }
  return "Duzeltme";
}

function movementPurpose(note: string | undefined, type: StockMovementType): string {
  const text = (note ?? "").toLowerCase();
  if (text.includes("acilis")) {
    return "Acilis Stogu";
  }
  if (text.includes("sale")) {
    return "POS Satisi";
  }
  if (type === "ADJUST") {
    return "Stok Duzeltme";
  }
  if (type === "OUT") {
    return "Manuel Cikis";
  }
  return "Manuel Giris";
}

function badgeClass(type: StockMovementType): string {
  if (type === "IN") {
    return "badge badge-in";
  }
  if (type === "OUT") {
    return "badge badge-out";
  }
  return "badge badge-adjust";
}

export function StockHistoryPanel({ products, movements }: Props): JSX.Element {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | StockMovementType>("ALL");

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return movements.filter((entry) => {
      const product = productMap.get(entry.productId);
      const typeOk = typeFilter === "ALL" || typeFilter === entry.type;
      const textOk =
        !text ||
        (product?.name ?? "").toLowerCase().includes(text) ||
        (product?.sku ?? "").toLowerCase().includes(text) ||
        movementPurpose(entry.note, entry.type).toLowerCase().includes(text) ||
        (entry.note ?? "").toLowerCase().includes(text);
      return typeOk && textOk;
    });
  }, [movements, productMap, query, typeFilter]);

  return (
    <div className="card">
      <div className="section-head">
        <h3>Hareket Gecmisi</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Urun, SKU, amac ara" />
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as "ALL" | StockMovementType)}
            style={{ maxWidth: 150 }}
          >
            <option value="ALL">Tum Tipler</option>
            <option value="IN">Giris</option>
            <option value="OUT">Cikis</option>
            <option value="ADJUST">Duzeltme</option>
          </select>
        </div>
      </div>
      <div className="table-scroll stock-history-scroll">
        <table>
          <thead>
            <tr>
              <th>Zaman</th>
              <th>Urun</th>
              <th>Tip</th>
              <th>Miktar</th>
              <th>Birim Maliyet</th>
              <th>Amac</th>
              <th>Kullanici</th>
              <th>Not</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => {
              const product = productMap.get(entry.productId);
              return (
                <tr key={entry.id}>
                  <td>{new Date(entry.createdAt).toLocaleString("tr-TR")}</td>
                  <td>
                    <strong>{product?.name ?? "Silinmis urun"}</strong>
                    <div className="muted">{product?.sku ?? "-"}</div>
                  </td>
                  <td>
                    <span className={badgeClass(entry.type)}>{movementTypeLabel(entry.type)}</span>
                  </td>
                  <td>{entry.quantity}</td>
                  <td>{entry.unitCost ?? "-"}</td>
                  <td>{movementPurpose(entry.note, entry.type)}</td>
                  <td>{entry.createdBy}</td>
                  <td>{entry.note ?? "-"}</td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">
                  Filtreye uygun hareket bulunamadi.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
