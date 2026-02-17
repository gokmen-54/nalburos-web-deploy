"use client";

import { useMemo, useState } from "react";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import type { Category, Product } from "@/lib/types";
import { Field } from "@/components/ui/field";
import { SectionCard } from "@/components/ui/section-card";
import { notify } from "@/lib/toast";

type Props = {
  products: Product[];
  categories: Category[];
};

type ParsedRow = {
  sku: string;
  salePrice: number;
  vatRate?: number;
};

type SimResult = {
  before: { revenue: number; cost: number; grossProfit: number; vat: number };
  after: { revenue: number; cost: number; grossProfit: number; vat: number };
  delta: { revenue: number; grossProfit: number; vat: number; revenuePct: number; grossProfitPct: number };
  top_impacted_products: Array<{
    productId: string;
    sku: string;
    productName: string;
    qtyBasis: number;
    oldPrice: number;
    newPrice: number;
    priceDelta: number;
    oldMargin: number;
    newMargin: number;
    revenueDelta: number;
  }>;
};

function money(value: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(value);
}

function parseRows(input: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  for (const line of input.split("\n")) {
    const clean = line.trim();
    if (!clean) {
      continue;
    }
    const [skuRaw, priceRaw, vatRaw] = clean.split(",").map((cell) => cell.trim());
    const salePrice = Number(priceRaw);
    if (!skuRaw || !Number.isFinite(salePrice)) {
      continue;
    }
    const vat = vatRaw ? Number(vatRaw) : undefined;
    rows.push({
      sku: skuRaw,
      salePrice,
      vatRate: Number.isFinite(vat ?? NaN) ? vat : undefined
    });
  }
  return rows;
}

export function PricingCenter({ products, categories }: Props): JSX.Element {
  const router = useRouter();
  const [tab, setTab] = useState<"operations" | "simulate">("operations");
  const [vatRate, setVatRate] = useState(20);
  const [categoryId, setCategoryId] = useState("ALL");
  const [listText, setListText] = useState("");
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [tableQuery, setTableQuery] = useState("");
  const [tableCategory, setTableCategory] = useState("ALL");
  const [simScope, setSimScope] = useState<"all" | "category" | "sku_list">("all");
  const [simCategoryId, setSimCategoryId] = useState("ALL");
  const [simChangeMode, setSimChangeMode] = useState<"percent" | "absolute" | "target_margin">("percent");
  const [simValue, setSimValue] = useState(10);
  const [simVat, setSimVat] = useState<number | "">("");
  const [simSkus, setSimSkus] = useState("");

  const filteredProducts = useMemo(() => {
    const text = tableQuery.trim().toLowerCase();
    return products.filter((product) => {
      const categoryOk = tableCategory === "ALL" || product.categoryId === tableCategory;
      const textOk = !text || product.name.toLowerCase().includes(text) || product.sku.toLowerCase().includes(text);
      return categoryOk && textOk;
    });
  }, [products, tableCategory, tableQuery]);

  const negativeMargins = useMemo(() => products.filter((product) => product.salePrice < product.lastCost).length, [products]);

  async function bulkVatApply(): Promise<void> {
    if (!Number.isFinite(vatRate) || vatRate <= 0) {
      notify({ type: "error", message: "KDV orani gecersiz." });
      return;
    }
    setLoading(true);
    const response = await fetch("/api/pricing/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vatRate,
        categoryId: categoryId === "ALL" ? undefined : categoryId
      })
    });
    const data = (await response.json()) as { error?: string; changed?: number };
    setLoading(false);
    if (!response.ok) {
      notify({ type: "error", message: data.error ?? "KDV guncellemesi basarisiz." });
      return;
    }
    notify({ type: "success", message: `KDV guncellendi. Etkilenen urun: ${data.changed ?? 0}` });
    router.refresh();
  }

  async function importPriceList(): Promise<void> {
    const rows = parseRows(listText);
    if (rows.length === 0) {
      notify({ type: "error", message: "Gecerli satir bulunamadi. Format: SKU,FIYAT,KDV" });
      return;
    }
    setLoading(true);
    const response = await fetch("/api/pricing/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows })
    });
    const data = (await response.json()) as { error?: string; updated?: number; skipped?: number };
    setLoading(false);
    if (!response.ok) {
      notify({ type: "error", message: data.error ?? "Fiyat listesi yuklenemedi." });
      return;
    }
    notify({ type: "success", message: `Fiyat listesi islendi. Guncellendi: ${data.updated ?? 0}, Atlandi: ${data.skipped ?? 0}` });
    router.refresh();
  }

  async function simulate(): Promise<void> {
    setLoading(true);
    const response = await fetch("/api/pricing/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: simScope,
        categoryId: simCategoryId === "ALL" ? undefined : simCategoryId,
        skus: simScope === "sku_list" ? simSkus.split(",").map((v) => v.trim()).filter(Boolean) : undefined,
        change_mode: simChangeMode,
        value: simValue,
        vat_override: simVat === "" ? undefined : Number(simVat)
      })
    });
    const data = (await response.json()) as SimResult & { error?: string };
    setLoading(false);
    if (!response.ok) {
      notify({ type: "error", message: data.error ?? "Simulasyon hatasi." });
      return;
    }
    setSimResult(data);
    notify({ type: "success", message: "Simulasyon hazirlandi." });
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="grid-4">
        <div className="card">
          <div className="muted">Toplam Urun</div>
          <h3>{products.length}</h3>
        </div>
        <div className="card">
          <div className="muted">Negatif Marjli</div>
          <h3>{negativeMargins}</h3>
        </div>
        <div className="card">
          <div className="muted">Ortalama KDV</div>
          <h3>%{(products.reduce((sum, p) => sum + (p.vatRate ?? 20), 0) / Math.max(products.length, 1)).toFixed(1)}</h3>
        </div>
        <div className="card">
          <div className="muted">Filtre Sonucu</div>
          <h3>{filteredProducts.length}</h3>
        </div>
      </div>

      <div className="card" style={{ display: "flex", gap: 8 }}>
        <button type="button" className={tab === "operations" ? "secondary" : ""} onClick={() => setTab("operations")}>
          Fiyat/KDV Islemleri
        </button>
        <button type="button" className={tab === "simulate" ? "secondary" : ""} onClick={() => setTab("simulate")}>
          Zam Simulasyonu
        </button>
      </div>

      {tab === "operations" ? (
        <>
          <SectionCard title="Toplu KDV Guncelleme" subtitle="Toplu degisiklik sadece KDV icin uygulanir.">
            <div className="form-grid">
              <Field label="Yeni KDV" unit="%" required>
                <input type="number" value={vatRate} onChange={(event) => setVatRate(Number(event.target.value))} />
              </Field>
              <Field label="Kategori" unit="Secim">
                <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                  <option value="ALL">Tum Kategoriler</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div style={{ display: "grid", alignItems: "end" }}>
                <button type="button" onClick={() => void bulkVatApply()} disabled={loading}>
                  {loading ? "Isleniyor..." : "KDV Uygula"}
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Fiyat Listesi Import" subtitle="Format: SKU,FIYAT,KDV (satir satir).">
            <div className="card" style={{ background: "#f8fbff", borderStyle: "dashed" }}>
              <strong>Nasil Kullanilir?</strong>
              <ol style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                <li>Excel'den `SKU,FIYAT,KDV` kolonlarini kopyala.</li>
                <li>Asagidaki alana satir satir yapistir.</li>
                <li>`Fiyat Listesini Uygula` ile sadece listelenen urunler guncellenir.</li>
              </ol>
            </div>
            <Field label="Import Metni">
              <textarea
                rows={8}
                value={listText}
                onChange={(event) => setListText(event.target.value)}
                placeholder={"VIDA-5X40,8.75,20\nSILIKON-BEYAZ,129.9,20"}
              />
            </Field>
            <p className="muted">Not: Ilk satir baslik olabilir (`SKU,FIYAT,KDV`), sistem otomatik yok sayar.</p>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <a href="/api/export/templates/pricing-import" target="_blank">
                <button type="button" className="secondary">
                  Excel/CSV Sablon Indir
                </button>
              </a>
              <button type="button" className="ghost" onClick={() => setListText("SKU,FIYAT,KDV\nVIDA-5X40,8.75,20")}>
                Ornek Doldur
              </button>
              <button type="button" onClick={() => void importPriceList()} disabled={loading}>
                {loading ? "Isleniyor..." : "Fiyat Listesini Uygula"}
              </button>
            </div>
          </SectionCard>
        </>
      ) : (
        <>
          <SectionCard title="Zam Senaryosu">
            <div className="form-grid">
              <Field label="Kapsam">
                <select value={simScope} onChange={(event) => setSimScope(event.target.value as "all" | "category" | "sku_list")}>
                  <option value="all">Tum Urunler</option>
                  <option value="category">Kategori</option>
                  <option value="sku_list">SKU Listesi</option>
                </select>
              </Field>
              <Field label="Degisim Modu">
                <select
                  value={simChangeMode}
                  onChange={(event) => setSimChangeMode(event.target.value as "percent" | "absolute" | "target_margin")}
                >
                  <option value="percent">Yuzde</option>
                  <option value="absolute">Sabit Tutar</option>
                  <option value="target_margin">Hedef Marj</option>
                </select>
              </Field>
              <Field label="Deger" unit={simChangeMode === "absolute" ? "TL" : "%"}>
                <input type="number" value={simValue} onChange={(event) => setSimValue(Number(event.target.value))} />
              </Field>
              <Field label="Kategori">
                <select value={simCategoryId} onChange={(event) => setSimCategoryId(event.target.value)}>
                  <option value="ALL">Tum Kategoriler</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="SKU Listesi">
                <input value={simSkus} onChange={(event) => setSimSkus(event.target.value)} placeholder="VIDA-5X40,SILIKON-BEYAZ" />
              </Field>
              <Field label="KDV Override" unit="%">
                <input value={simVat} onChange={(event) => setSimVat(event.target.value === "" ? "" : Number(event.target.value))} />
              </Field>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => void simulate()} disabled={loading}>
                {loading ? "Hesaplaniyor..." : "Simule Et"}
              </button>
            </div>
          </SectionCard>
          {simResult ? (
            <div className="grid-4">
              <div className="card">
                <div className="muted">Once Gelir</div>
                <h3>{money(simResult.before.revenue)}</h3>
              </div>
              <div className="card">
                <div className="muted">Sonra Gelir</div>
                <h3>{money(simResult.after.revenue)}</h3>
              </div>
              <div className="card">
                <div className="muted">Gelir Farki</div>
                <h3>{money(simResult.delta.revenue)}</h3>
              </div>
              <div className="card">
                <div className="muted">Kar Farki</div>
                <h3>{money(simResult.delta.grossProfit)}</h3>
              </div>
            </div>
          ) : null}
        </>
      )}

      <SectionCard title="Guncel Fiyat/KDV Tablosu">
        <div className="section-head">
          <div style={{ display: "flex", gap: 8 }}>
            <input value={tableQuery} onChange={(event) => setTableQuery(event.target.value)} placeholder="SKU veya urun ara" />
            <select value={tableCategory} onChange={(event) => setTableCategory(event.target.value)} style={{ maxWidth: 180 }}>
              <option value="ALL">Tum Kategoriler</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Urun</th>
                <th>Satis</th>
                <th>Maliyet</th>
                <th>KDV</th>
                <th>Marj</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const margin = product.salePrice - product.lastCost;
                return (
                  <tr key={product.id}>
                    <td>{product.sku}</td>
                    <td>{product.name}</td>
                    <td>{money(product.salePrice)}</td>
                    <td>{money(product.lastCost)}</td>
                    <td>%{product.vatRate ?? 20}</td>
                    <td className={margin < 0 ? "profit-neg" : "profit-pos"}>{money(margin)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
