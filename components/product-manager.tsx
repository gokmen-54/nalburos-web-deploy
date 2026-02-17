"use client";

import { useMemo, useState } from "react";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types";
import { notify } from "@/lib/toast";

type Props = {
  products: Product[];
};

type EditState = Record<
  string,
  {
    name: string;
    imageUrl: string;
    salePrice: number;
    lastCost: number;
    minStock: number;
    vatRate: number;
    changeReason: string;
  }
>;

function money(value: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(value);
}

export function ProductManager({ products }: Props): JSX.Element {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState("");
  const [status, setStatus] = useState("");
  const [edits, setEdits] = useState<EditState>(() =>
    Object.fromEntries(
      products.map((product) => [
        product.id,
        {
          name: product.name,
          imageUrl: product.imageUrl ?? "",
          salePrice: product.salePrice,
          lastCost: product.lastCost,
          minStock: product.minStock,
          vatRate: product.vatRate ?? 20,
          changeReason: ""
        }
      ])
    )
  );

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) {
      return products;
    }
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(text) ||
        product.sku.toLowerCase().includes(text) ||
        (product.barcode ?? "").toLowerCase().includes(text)
    );
  }, [products, query]);

  function update<K extends keyof EditState[string]>(id: string, key: K, value: EditState[string][K]): void {
    setEdits((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [key]: value
      }
    }));
  }

  async function fileToDataUrl(file: File): Promise<string> {
    const rawData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Dosya okunamadi."));
      reader.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Gorsel yuklenemedi."));
      image.src = rawData;
    });
    const MAX_SIZE = 1200;
    const scale = Math.min(1, MAX_SIZE / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas kullanilamadi.");
    }
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.88);
  }

  async function save(id: string): Promise<void> {
    setSavingId(id);
    setStatus("");
    const payload = edits[id];
    const response = await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setStatus(data.error ?? "Kaydetme hatasi");
      notify({ type: "error", message: data.error ?? "Urun guncellenemedi." });
      setSavingId("");
      return;
    }
    setStatus("Urun guncellendi.");
    notify({ type: "success", message: "Urun guncellendi." });
    setSavingId("");
    router.refresh();
  }

  async function removeProduct(id: string): Promise<void> {
    const ok = window.confirm("Bu urunu silmek istiyor musunuz? Stok hareketleri de kaldirilir.");
    if (!ok) {
      return;
    }
    setSavingId(id);
    const response = await fetch(`/api/products/${id}`, { method: "DELETE" });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setStatus(data.error ?? "Silme hatasi");
      notify({ type: "error", message: data.error ?? "Urun silinemedi." });
      setSavingId("");
      return;
    }
    notify({ type: "success", message: "Urun silindi." });
    setSavingId("");
    router.refresh();
  }

  return (
    <div className="card">
      <div className="section-head product-manager-head">
        <h3>Gorsel Urun Yonetimi</h3>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="SKU, urun veya barkod ara" />
      </div>
      {status ? <p className="muted">{status}</p> : null}

      <div className="product-card-grid">
        {filtered.map((product) => {
          const edit = edits[product.id];
          const margin = edit.salePrice - edit.lastCost;

          return (
            <div className="product-card product-card-compact" key={product.id}>
              <div className="product-image-wrap">
                {edit.imageUrl ? (
                  <img src={edit.imageUrl} alt={edit.name} className="product-image" />
                ) : (
                  <div className="product-image-placeholder">Resim Yok</div>
                )}
              </div>

              <div className="product-card-meta">
                <strong className="product-sku">{product.sku}</strong>
                <span className="help-chip">Stok: {product.quantity}</span>
              </div>

              <input value={edit.name} onChange={(event) => update(product.id, "name", event.target.value)} placeholder="Urun adi" />

              <div className="product-quick-actions">
                <button
                  className="secondary"
                  type="button"
                  onClick={() => window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(edit.name)}`, "_blank")}
                >
                  Netten Ara
                </button>
                <button className="ghost" type="button" onClick={() => update(product.id, "imageUrl", "")}>Resmi Temizle</button>
              </div>

              <div className="product-card-fields">
                <label className="field-wrap">
                  <span className="field-label">Satis Fiyati (TL)</span>
                  <input
                    type="number"
                    value={edit.salePrice}
                    onChange={(event) => update(product.id, "salePrice", Number(event.target.value))}
                    placeholder="Satis"
                  />
                </label>
                <label className="field-wrap">
                  <span className="field-label">Maliyet (TL)</span>
                  <input
                    type="number"
                    value={edit.lastCost}
                    onChange={(event) => update(product.id, "lastCost", Number(event.target.value))}
                    placeholder="Maliyet"
                  />
                </label>
                <label className="field-wrap">
                  <span className="field-label">Minimum Stok</span>
                  <input
                    type="number"
                    value={edit.minStock}
                    onChange={(event) => update(product.id, "minStock", Number(event.target.value))}
                    placeholder="Min stok"
                  />
                </label>
                <label className="field-wrap">
                  <span className="field-label">KDV (%)</span>
                  <input
                    type="number"
                    value={edit.vatRate}
                    onChange={(event) => update(product.id, "vatRate", Number(event.target.value))}
                    placeholder="KDV %"
                  />
                </label>
              </div>

              <details className="product-advanced">
                <summary>Gorsel ve Aciklama Ayarlari</summary>
                <div className="product-advanced-grid">
                  <input value={edit.imageUrl} onChange={(event) => update(product.id, "imageUrl", event.target.value)} placeholder="Resim URL" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) {
                        return;
                      }
                      try {
                        const dataUrl = await fileToDataUrl(file);
                        update(product.id, "imageUrl", dataUrl);
                        notify({ type: "success", message: `${product.name} resmi guncellendi.` });
                      } catch (fileError) {
                        notify({ type: "error", message: (fileError as Error).message });
                      }
                    }}
                  />
                  <input
                    value={edit.changeReason}
                    onChange={(event) => update(product.id, "changeReason", event.target.value)}
                    placeholder="Degisim nedeni (fiyat/maliyet degisirse zorunlu)"
                  />
                  <span className="muted" style={{ fontSize: 12 }}>
                    Oneri: 1200x1200. Farkli oranlar otomatik sigdirilir.
                  </span>
                </div>
              </details>

              <div className="product-card-footer">
                <span className={margin >= 0 ? "profit-pos" : "profit-neg"}>Birim Kar: {money(margin)}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => void save(product.id)} disabled={savingId === product.id}>
                    {savingId === product.id ? "Kaydediliyor..." : "Kaydet"}
                  </button>
                  <button className="danger" type="button" onClick={() => void removeProduct(product.id)} disabled={savingId === product.id}>
                    Sil
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
