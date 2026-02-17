"use client";

import { FormEvent, useMemo, useState } from "react";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import type { Product, StockMovementType } from "@/lib/types";
import { Field } from "@/components/ui/field";
import { SectionCard } from "@/components/ui/section-card";
import { notify } from "@/lib/toast";

type Props = {
  products: Product[];
};

export function StockForm({ products }: Props): JSX.Element {
  const router = useRouter();
  const [productQuery, setProductQuery] = useState("");
  const [form, setForm] = useState({
    productId: products[0]?.id ?? "",
    type: "IN" as StockMovementType,
    quantity: "1",
    unitCost: "",
    salePrice: "",
    note: ""
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === form.productId),
    [form.productId, products]
  );
  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    if (!query) {
      return products;
    }
    return products.filter((product) => {
      return (
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        (product.barcode ?? "").toLowerCase().includes(query)
      );
    });
  }, [products, productQuery]);

  function movementHint(type: StockMovementType): string {
    if (type === "IN") {
      return "Depoya giren urunler icin kullanilir (alis, iade, acilis stogu).";
    }
    if (type === "OUT") {
      return "Depodan cikan urunler icin kullanilir (fire, zayi, manuel dusum).";
    }
    return "Sayim veya kontrol sonrasi stok farki duzeltmesi icin kullanilir.";
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const quantity = Number(form.quantity);
    const unitCost = form.unitCost.trim() === "" ? undefined : Number(form.unitCost);
    const salePrice = form.salePrice.trim() === "" ? undefined : Number(form.salePrice);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Miktar 0'dan buyuk olmali.");
      notify({ type: "error", message: "Miktar 0'dan buyuk olmali." });
      setLoading(false);
      return;
    }
    if (form.type === "ADJUST" && !form.note.trim()) {
      setError("Duzeltme hareketinde aciklama zorunlu.");
      notify({ type: "error", message: "Duzeltme hareketinde aciklama zorunlu." });
      setLoading(false);
      return;
    }
    if (unitCost !== undefined && (!Number.isFinite(unitCost) || unitCost <= 0)) {
      setError("Alis maliyeti 0'dan buyuk olmali.");
      notify({ type: "error", message: "Alis maliyeti gecersiz." });
      setLoading(false);
      return;
    }
    if (salePrice !== undefined && (!Number.isFinite(salePrice) || salePrice <= 0)) {
      setError("Satis fiyati 0'dan buyuk olmali.");
      notify({ type: "error", message: "Satis fiyati gecersiz." });
      setLoading(false);
      return;
    }

    const response = await fetch("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: form.productId,
        type: form.type,
        quantity,
        unitCost,
        salePrice,
        note: form.note.trim()
      })
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Hareket kaydedilemedi.");
      notify({ type: "error", message: data.error ?? "Stok hareketi kaydedilemedi." });
      setLoading(false);
      return;
    }

    setForm((prev) => ({ ...prev, quantity: "1", unitCost: "", salePrice: "", note: "" }));
    setSuccess("Stok hareketi basariyla kaydedildi.");
    notify({ type: "success", message: "Stok hareketi kaydedildi." });
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <SectionCard title="Yeni Stok Hareketi" subtitle="Stok girisi, cikisi ve duzeltmeyi kontrollu kaydet.">
        <div className="form-grid">
          <Field label="Urun" unit="Secim" required hint="Hareket islenecek urunu secin.">
            <input
              value={productQuery}
              onChange={(event) => setProductQuery(event.target.value)}
              placeholder="Urun ara (SKU, ad, barkod)"
              style={{ marginBottom: 8 }}
            />
            <select value={form.productId} onChange={(event) => setForm((prev) => ({ ...prev, productId: event.target.value }))}>
              {filteredProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} - {product.name}
                </option>
              ))}
              {filteredProducts.length === 0 ? <option value={form.productId}>Sonuc bulunamadi</option> : null}
            </select>
          </Field>

          <Field label="Hareket Tipi" unit="Secim" required hint={movementHint(form.type)}>
            <select
              value={form.type}
              onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as StockMovementType }))}
            >
              <option value="IN">Giris</option>
              <option value="OUT">Cikis</option>
              <option value="ADJUST">Duzeltme</option>
            </select>
          </Field>

          <Field
            label="Miktar"
            unit={selectedProduct?.unit === "piece" ? "Adet" : selectedProduct?.unit ?? "Birim"}
            example="10"
            required
            hint="Her zaman pozitif girin. Tip secimine gore sistem giris/cikis uygular."
          >
            <input
              type="number"
              value={form.quantity}
              onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))}
              placeholder="Miktar"
            />
          </Field>

          <Field label="Birim Maliyet" unit="TL" example="85.50" hint="Opsiyonel. Girersen stok deger analizlerinde kullanilir.">
            <input
              type="number"
              value={form.unitCost}
              onChange={(event) => setForm((prev) => ({ ...prev, unitCost: event.target.value }))}
              placeholder="Alis maliyeti (opsiyonel)"
            />
          </Field>

          <Field
            label="Satis Fiyati Guncelle"
            unit="TL"
            example="129.90"
            hint="Opsiyonel. Girersen urunun satis fiyati da guncellenir."
          >
            <input
              type="number"
              value={form.salePrice}
              onChange={(event) => setForm((prev) => ({ ...prev, salePrice: event.target.value }))}
              placeholder="Satis fiyati (opsiyonel)"
            />
          </Field>

          <Field
            label="Hareket Aciklamasi"
            unit="Metin"
            hint="Ornek: sayim farki, iade girisi, fire, acilis duzeltmesi."
          >
            <input value={form.note} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} placeholder="Aciklama" />
          </Field>
        </div>

        {selectedProduct ? (
          <p className="muted">
            Mevcut Alis: <strong>{selectedProduct.lastCost.toFixed(2)} TL</strong> | Mevcut Satis:{" "}
            <strong>{selectedProduct.salePrice.toFixed(2)} TL</strong>
          </p>
        ) : null}

        {error ? <p className="field-error">{error}</p> : null}
        {success ? <p className="muted">{success}</p> : null}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="submit" disabled={loading || !form.productId}>
            {loading ? "Kaydediliyor..." : "Hareketi Kaydet"}
          </button>
        </div>
      </SectionCard>
    </form>
  );
}
