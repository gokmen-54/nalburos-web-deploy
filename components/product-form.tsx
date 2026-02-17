"use client";

import { FormEvent, useState } from "react";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import type { Category, Product } from "@/lib/types";
import { Field } from "@/components/ui/field";
import { SectionCard } from "@/components/ui/section-card";
import { notify } from "@/lib/toast";

type Props = {
  categories: Category[];
};

export function ProductForm({ categories }: Props): JSX.Element {
  const router = useRouter();
  const [form, setForm] = useState({
    sku: "",
    name: "",
    imageUrl: "",
    categoryId: "",
    unit: "piece" as Product["unit"],
    quantity: 0,
    minStock: 0,
    salePrice: 0,
    lastCost: 0,
    vatRate: 20
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageInfo, setImageInfo] = useState("");

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function fileToDataUrl(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
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
    return {
      dataUrl: canvas.toDataURL("image/jpeg", 0.88),
      width,
      height
    };
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Urun eklenemedi.");
      notify({ type: "error", message: data.error ?? "Urun eklenemedi." });
      setLoading(false);
      return;
    }

    setForm({
      sku: "",
      name: "",
      imageUrl: "",
      categoryId: "",
      unit: "piece",
      quantity: 0,
      minStock: 0,
      salePrice: 0,
      lastCost: 0,
      vatRate: 20
    });
    setImageInfo("");
    notify({ type: "success", message: "Urun kaydedildi." });
    router.refresh();
    setLoading(false);
  }

  return (
    <form onSubmit={onSubmit}>
      <SectionCard title="Yeni Urun" subtitle="Zorunlu alanlari doldurup urunu olusturun.">
      <div className="form-grid">
        <Field label="SKU Kodu" unit="Kod" example="VIDA-5X40" required hint="Urunun benzersiz kodu.">
          <input value={form.sku} onChange={(event) => update("sku", event.target.value)} placeholder="Orn: VIDA-5X40" />
        </Field>
        <Field label="Urun Adi" unit="Metin" example="Vida 5x40" required hint="Kasa ve raporda bu ad gorunur.">
          <input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Urun adi" />
        </Field>
        <Field label="Resim URL" unit="Link" example="https://..." hint="Opsiyonel, urun kutusunda gorunur.">
          <input value={form.imageUrl} onChange={(event) => update("imageUrl", event.target.value)} placeholder="Resim URL (opsiyonel)" />
        </Field>
        <Field label="Resim Dosyasi" unit="JPG/PNG" hint="Onerilen olcu: 1200x1200 kare. Dosya secince otomatik optimize edilir.">
          <input
            type="file"
            accept="image/*"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }
              try {
                const result = await fileToDataUrl(file);
                update("imageUrl", result.dataUrl);
                setImageInfo(`${file.name} | ${result.width}x${result.height}px | optimize edildi`);
                notify({ type: "success", message: "Resim dosyasi eklendi." });
              } catch (uploadError) {
                setError((uploadError as Error).message);
                notify({ type: "error", message: (uploadError as Error).message });
              }
            }}
          />
          {imageInfo ? <span className="muted">{imageInfo}</span> : null}
        </Field>
        <Field label="Kategori" unit="Secim" hint="Rapor ve filtrelerde bu kategori kullanilir.">
          <select value={form.categoryId} onChange={(event) => update("categoryId", event.target.value)}>
            <option value="">Seciniz (opsiyonel)</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Satis Birimi" unit="Tur" example="Adet" required hint="Satisin yapilacagi birim.">
          <select value={form.unit} onChange={(event) => update("unit", event.target.value as Product["unit"])}>
            <option value="piece">Adet</option>
            <option value="box">Koli</option>
            <option value="meter">Metre</option>
            <option value="kg">Kg</option>
          </select>
        </Field>
        <Field label="Acilis Stogu" unit={form.unit === "piece" ? "Adet" : form.unit} example="100" hint="Sisteme ilk giris stok miktari.">
          <input type="number" value={form.quantity} onChange={(event) => update("quantity", Number(event.target.value))} placeholder="Miktar" />
        </Field>
        <Field label="Minimum Stok" unit={form.unit === "piece" ? "Adet" : form.unit} example="20" hint="Bu degerin altinda kritik stok uyarisi verir.">
          <input type="number" value={form.minStock} onChange={(event) => update("minStock", Number(event.target.value))} placeholder="Min stok" />
        </Field>
        <Field label="Satis Fiyati" unit="TL" example="129.90" required hint="Kasada kullanilacak birim satis fiyati.">
          <input type="number" value={form.salePrice} onChange={(event) => update("salePrice", Number(event.target.value))} placeholder="Satis fiyati" />
        </Field>
        <Field label="Son Alis Maliyeti" unit="TL" example="95.50" hint="Kar hesaplamasi bu degerle yapilir.">
          <input type="number" value={form.lastCost} onChange={(event) => update("lastCost", Number(event.target.value))} placeholder="Son alis maliyeti" />
        </Field>
        <Field label="KDV Orani" unit="%" example="20" hint="Urun satis satirinda uygulanacak KDV oranidir.">
          <input type="number" value={form.vatRate} onChange={(event) => update("vatRate", Number(event.target.value))} placeholder="KDV %" />
        </Field>
      </div>
      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
      <button type="submit" disabled={loading} style={{ marginTop: 10 }}>
        {loading ? "Kaydediliyor..." : "Urun Ekle"}
      </button>
      </SectionCard>
    </form>
  );
}
