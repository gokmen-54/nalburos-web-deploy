"use client";

import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import type { Category, Customer, PaymentMethod, Product, Sale, SaleLine } from "@/lib/types";

type Props = {
  categories: Category[];
  initialProducts: Product[];
  customers: Customer[];
};

type PendingSync = {
  eventId: string;
};

const MULTIPLIERS = [1, 2, 3, 4, 5];

function money(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2
  }).format(value);
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "API error");
  }
  return data;
}

function readQueue(): PendingSync[] {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = window.localStorage.getItem("nalburos_sync_queue");
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw) as PendingSync[];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingSync[]): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem("nalburos_sync_queue", JSON.stringify(queue));
}

export function PosTerminal({ categories, initialProducts, customers }: Props): JSX.Element {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [sale, setSale] = useState<Sale | null>(null);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [multiplier, setMultiplier] = useState<number>(1);
  const [customMultiplier, setCustomMultiplier] = useState<string>("10");
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [installmentCount, setInstallmentCount] = useState<number>(1);
  const [installmentDays, setInstallmentDays] = useState<number>(30);
  const [manualDiscountInput, setManualDiscountInput] = useState<string>("0");
  const [pendingSync, setPendingSync] = useState<number>(0);
  const [status, setStatus] = useState<string>("Hazir");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id ?? "cus_cash");
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const selectedCustomer = customers.find((entry) => entry.id === selectedCustomerId);

  const filteredProducts = useMemo(() => {
    const text = query.trim().toLowerCase();
    return products.filter((entry) => {
      const categoryOk = selectedCategory === "ALL" || entry.categoryId === selectedCategory;
      const textOk =
        !text ||
        entry.name.toLowerCase().includes(text) ||
        entry.sku.toLowerCase().includes(text) ||
        (entry.barcode ?? "").toLowerCase().includes(text);
      return categoryOk && textOk;
    });
  }, [products, query, selectedCategory]);

  const quickMatches = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) {
      return [];
    }
    return filteredProducts.slice(0, 8);
  }, [filteredProducts, query]);

  useEffect(() => {
    setPendingSync(readQueue().length);
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const data = await api<{ sale: Sale | null }>("/api/pos/sales/draft");
        if (!mounted || !data.sale) {
          return;
        }
        setSale(data.sale);
        if (data.sale.customerId) {
          setSelectedCustomerId(data.sale.customerId);
        }
        setStatus("Taslak fis geri yuklendi.");
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!sale) {
      return;
    }
    setManualDiscountInput(String(sale.manualDiscountTotal ?? 0));
  }, [sale]);

  useEffect(() => {
    function onKeydown(event: KeyboardEvent): void {
      if (event.key === "F1") {
        event.preventDefault();
        setMultiplier(1);
      } else if (event.key === "F2") {
        event.preventDefault();
        setMultiplier(2);
      } else if (event.key === "F3") {
        event.preventDefault();
        setMultiplier(3);
      } else if (event.key === "F4") {
        event.preventDefault();
        void finalizeCurrentSale();
      }
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  });

  async function ensureDraft(): Promise<Sale> {
    if (sale && sale.status === "DRAFT") {
      return sale;
    }
    const data = await api<{ sale: Sale }>("/api/pos/sales/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: selectedCustomerId,
        customerName: selectedCustomer?.name ?? "PERAKENDE SATIS"
      })
    });
    setSale(data.sale);
    return data.sale;
  }

  async function refreshCatalog(): Promise<void> {
    const data = await api<{ products: Product[] }>(
      `/api/pos/catalog?branchId=br_main${selectedCategory !== "ALL" ? `&categoryId=${selectedCategory}` : ""}&q=${encodeURIComponent(query)}`
    );
    setProducts(data.products);
  }

  async function addProduct(product: Product): Promise<void> {
    try {
      const draft = await ensureDraft();
      const data = await api<{ sale: Sale }>("/api/pos/sales/line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: draft.id,
          productId: product.id,
          quantity: multiplier
        })
      });
      setSale(data.sale);
      if (product.salePrice < product.lastCost) {
        window.alert(
          `Uyari: ${product.name} urununde satis fiyati maliyetin altinda. (Satis: ${product.salePrice}, Maliyet: ${product.lastCost})`
        );
      }
      setStatus(`${product.name} eklendi x${multiplier}`);
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function addPaymentToSale(): Promise<void> {
    if (!sale) {
      setStatus("Odeme once sepet olusturulmali.");
      return;
    }
    try {
      const data = await api<{ sale: Sale }>("/api/pos/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: sale.id,
          method: paymentMethod,
          amount: paymentAmount,
          installmentPlan: paymentMethod === "CREDIT" ? { count: installmentCount, intervalDays: installmentDays } : undefined
        })
      });
      setSale(data.sale);
      setStatus("Odeme eklendi.");
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function applyManualDiscount(): Promise<void> {
    const amount = Number(manualDiscountInput);
    if (!sale) {
      setStatus("Indirim icin once urun ekleyin.");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setStatus("Indirim tutari gecersiz.");
      return;
    }
    try {
      const data = await api<{ sale: Sale }>("/api/pos/sales/discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: sale.id,
          amount
        })
      });
      setSale(data.sale);
      setStatus(`Indirim guncellendi: ${money(amount)}`);
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function updateLine(lineId: string, mode: "DECREASE_ONE" | "REMOVE"): Promise<void> {
    if (!sale) {
      return;
    }
    try {
      const data = await api<{ sale: Sale }>("/api/pos/sales/line", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: sale.id,
          lineId,
          mode
        })
      });
      setSale(data.sale);
      setStatus(mode === "REMOVE" ? "Urun sepetten silindi." : "Urun miktari azaltildi.");
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function finalizeCurrentSale(): Promise<void> {
    if (!sale) {
      return;
    }
    const idempotencyKey = `${sale.id}_${Date.now()}`;
    try {
      const data = await api<{ sale: Sale; syncEventId: string }>("/api/pos/sales/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: sale.id,
          idempotencyKey
        })
      });
      const queue = readQueue();
      if (data.syncEventId) {
        queue.push({ eventId: data.syncEventId });
      }
      writeQueue(queue);
      setPendingSync(queue.length);
      setSale(null);
      setPaymentAmount(0);
      setManualDiscountInput("0");
      setSelectedCustomerId(customers[0]?.id ?? "cus_cash");
      await refreshCatalog();
      await api("/local/print/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId: data.sale.id })
      });
      await api("/local/cashdrawer/open", { method: "POST" });
      setStatus("Satis tamamlandi.");
    } catch (error) {
      const message = (error as Error).message;
      if (message.toLowerCase().includes("kredi limiti")) {
        const ok = window.confirm("Musteri kredi limiti asiliyor. Yonetici onayi ile yine de tamamla?");
        if (ok) {
          try {
            const retry = await api<{ sale: Sale; syncEventId: string }>("/api/pos/sales/finalize", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                saleId: sale.id,
                idempotencyKey: `${idempotencyKey}_ovr`,
                allowOverLimit: true
              })
            });
            const queue = readQueue();
            if (retry.syncEventId) {
              queue.push({ eventId: retry.syncEventId });
            }
            writeQueue(queue);
            setPendingSync(queue.length);
            setSale(null);
            await refreshCatalog();
            setStatus("Satis yonetici onayi ile tamamlandi.");
            return;
          } catch (retryError) {
            setStatus((retryError as Error).message);
            return;
          }
        }
      }
      setStatus(message);
    }
  }

  async function syncPending(): Promise<void> {
    const queue = readQueue();
    if (queue.length === 0) {
      setStatus("Senkron bekleyen islem yok.");
      return;
    }
    try {
      const response = await api<{ synced: number; failed: number }>("/api/pos/offline/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds: queue.map((entry) => entry.eventId) })
      });
      if (response.failed === 0) {
        writeQueue([]);
        setPendingSync(0);
      }
      setStatus(`Senkron tamamlandi. Basarili: ${response.synced}, Hatali: ${response.failed}`);
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function holdSale(): Promise<void> {
    if (!sale) {
      return;
    }
    window.sessionStorage.setItem("nalburos_hold_sale", JSON.stringify(sale));
    setSale(null);
    setStatus("Fis beklemeye alindi.");
  }

  function recallSale(): void {
    const raw = window.sessionStorage.getItem("nalburos_hold_sale");
    if (!raw) {
      setStatus("Bekleyen fis bulunamadi.");
      return;
    }
    try {
      const held = JSON.parse(raw) as Sale;
      setSale(held);
      setStatus("Bekleyen fis geri cagildi.");
    } catch {
      setStatus("Bekleyen fis okunamadi.");
    }
  }

  async function refundCurrent(): Promise<void> {
    if (!sale) {
      return;
    }
    try {
      await api("/api/pos/sales/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId: sale.id })
      });
      setStatus("Iade kaydedildi.");
      setSale(null);
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  const lines: SaleLine[] = sale?.lines ?? [];

  return (
    <div className="pos-root">
      <div className="pos-left">
        <div className="pos-title-row">
          <h3 className="pos-title">Hizli Satis</h3>
          <span className="pos-kbd-help">F1-F3 Carpan, F4 Tahsilat</span>
        </div>

        <div className="pos-card">
          <div className="pos-row">
            <strong>Musteri</strong>
            <select
              value={selectedCustomerId}
              onChange={(event) => setSelectedCustomerId(event.target.value)}
              disabled={Boolean(sale)}
              title={sale ? "Yeni musteri secmek icin once satisi tamamlayin veya bekletin." : ""}
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.code} - {customer.name}
                </option>
              ))}
            </select>
            <span className="muted">
              {sale?.customerName ?? selectedCustomer?.name ?? "PERAKENDE SATIS"}
              {selectedCustomer ? ` | Bakiye: ${money(selectedCustomer.balance)}` : ""}
            </span>
          </div>
          <div className="pos-row">
            <strong>Barkod / Arama</strong>
            <div className="pos-search-row">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (quickMatches.length > 0) {
                      void addProduct(quickMatches[0]);
                      setQuery("");
                      return;
                    }
                    void refreshCatalog();
                  }
                }}
                placeholder="Barkod veya urun adi"
              />
              <button type="button" className="ghost" onClick={() => setQuery("")}>
                Temizle
              </button>
            </div>
            {quickMatches.length > 0 ? (
              <div className="pos-quick-list">
                {quickMatches.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="pos-quick-item"
                    onClick={() => {
                      void addProduct(product);
                      setQuery("");
                    }}
                  >
                    <span>{product.name}</span>
                    <span className="muted">
                      {product.sku} | {money(product.salePrice)}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="pos-multiplier-row">
            {MULTIPLIERS.map((value) => (
              <button
                key={value}
                className={value === multiplier ? "secondary active-multiplier" : "ghost"}
                type="button"
                onClick={() => setMultiplier(value)}
              >
                {value}x
              </button>
            ))}
          </div>
          <div className="pos-custom-multiplier-row">
            <span className="muted">Ozel carpan</span>
            <div className="pos-custom-multiplier">
              <input
                type="number"
                value={customMultiplier}
                onChange={(event) => setCustomMultiplier(event.target.value)}
                min={1}
                placeholder="Adet"
              />
              <button
                type="button"
                className={multiplier === Number(customMultiplier || 0) ? "secondary active-multiplier" : "ghost"}
                onClick={() => {
                  const value = Number(customMultiplier);
                  if (!Number.isFinite(value) || value <= 0) {
                    setStatus("Gecerli bir carpan girin.");
                    return;
                  }
                  setMultiplier(Math.round(value));
                }}
              >
                Uygula
              </button>
            </div>
          </div>
        </div>

        <div className="pos-card pos-lines">
          <table>
            <thead>
              <tr>
                <th>Urun</th>
                <th>Miktar</th>
                <th>Tutar</th>
                <th>Islem</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <td>
                    {line.sku}
                    <br />
                    <span className="muted">{line.productName}</span>
                  </td>
                  <td>{line.quantity}</td>
                  <td>{money(line.lineTotal)}</td>
                  <td>
                    <div className="pos-line-actions">
                      <button type="button" className="ghost" onClick={() => void updateLine(line.id, "DECREASE_ONE")}>
                        -1
                      </button>
                      <button type="button" className="danger" onClick={() => void updateLine(line.id, "REMOVE")}>
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    Sepet bos. Urun kartina tiklayarak veya barkodla urun ekleyin.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="pos-card pos-summary-card">
          <div className="pos-total">
            <span>Ara Toplam</span>
            <strong>{money(sale?.subTotal ?? 0)}</strong>
          </div>
          <div className="pos-total">
            <span>Indirim</span>
            <strong>{money(sale?.discountTotal ?? 0)}</strong>
          </div>
          <div className="pos-total">
            <span>KDV</span>
            <strong>{money(sale?.taxTotal ?? 0)}</strong>
          </div>
          <div className="pos-total pos-total-net">
            <span>Net</span>
            <strong>{money(sale?.netTotal ?? 0)}</strong>
          </div>
          <div className="pos-total">
            <span>Odendi</span>
            <strong>{money(sale?.paidTotal ?? 0)}</strong>
          </div>
          <div className="pos-total">
            <span>Kalan</span>
            <strong>{money(sale?.dueTotal ?? 0)}</strong>
          </div>
          <div className="pos-total">
            <span>Para Ustu</span>
            <strong>{money(sale?.changeTotal ?? 0)}</strong>
          </div>
        </div>

        <div className="pos-card pos-payment-card">
          <div className="pos-row">
            <strong>TL Indirim</strong>
            <div className="pos-search-row">
              <input
                type="number"
                min={0}
                value={manualDiscountInput}
                onChange={(event) => setManualDiscountInput(event.target.value)}
                placeholder="Indirim tutari (TL)"
              />
              <button type="button" className="ghost" onClick={() => void applyManualDiscount()}>
                Indirim Uygula
              </button>
            </div>
          </div>
          <div className="pos-row">
            <strong>Odeme</strong>
            <span className="muted">Nakit, kart, havale veya taksit girip fis uzerine ekleyin.</span>
          </div>
          <div className="pos-payment-grid">
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
              aria-label="Odeme yontemi"
            >
              <option value="CASH">Nakit</option>
              <option value="CARD">Kart</option>
              <option value="TRANSFER">Havale</option>
              <option value="CREDIT">Taksit</option>
            </select>
            <input
              type="number"
              value={paymentAmount}
              onChange={(event) => setPaymentAmount(Number(event.target.value))}
              placeholder="Odeme tutari"
            />
            <button type="button" className="secondary" onClick={() => void addPaymentToSale()}>
              Odeme Ekle
            </button>
            {paymentMethod === "CREDIT" ? (
              <>
                <input
                  type="number"
                  value={installmentCount}
                  onChange={(event) => setInstallmentCount(Number(event.target.value))}
                  placeholder="Taksit adedi"
                />
                <input
                  type="number"
                  value={installmentDays}
                  onChange={(event) => setInstallmentDays(Number(event.target.value))}
                  placeholder="Taksit araligi (gun)"
                />
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="pos-right">
        <div className="pos-tabs-wrap">
          <div className="pos-tabs">
            <button
              className={selectedCategory === "ALL" ? "secondary" : "ghost"}
              type="button"
              onClick={() => setSelectedCategory("ALL")}
            >
              HEPSI
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                className={selectedCategory === category.id ? "secondary" : "ghost"}
                type="button"
                onClick={() => setSelectedCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>
          <div className="pos-product-count muted">Toplam gosterilen urun: {filteredProducts.length}</div>
        </div>
        <div className="pos-product-grid">
          {filteredProducts.map((product) => (
            <button key={product.id} className="pos-product-tile" type="button" onClick={() => void addProduct(product)}>
              <div className="pos-product-media">
                {product.imageUrl && !brokenImages[product.id] ? (
                  <img
                    className="pos-product-image"
                    src={product.imageUrl}
                    alt={product.name}
                    loading="lazy"
                    onError={() => setBrokenImages((prev) => ({ ...prev, [product.id]: true }))}
                  />
                ) : (
                  <div className="pos-product-placeholder">RESIM YOK</div>
                )}
              </div>
              <div className="pos-product-name">{product.name}</div>
              <div className="muted">{product.sku}</div>
              <div>{money(product.salePrice)}</div>
              <div className="muted">Stok: {product.quantity}</div>
            </button>
          ))}
          {filteredProducts.length === 0 ? (
            <div className="pos-empty">Filtreye uygun urun bulunamadi.</div>
          ) : null}
        </div>
      </div>

      <div className="pos-actions">
        <button type="button" onClick={() => void finalizeCurrentSale()}>
          Tahsilat / Tamamla (F4)
        </button>
        <button type="button" className="secondary" onClick={() => void holdSale()}>
          Beklet
        </button>
        <button type="button" className="secondary" onClick={recallSale}>
          Geri Cagir
        </button>
        <button type="button" className="danger" onClick={() => void refundCurrent()}>
          Iade
        </button>
        <button type="button" className="secondary" onClick={() => void syncPending()}>
          Senkron ({pendingSync})
        </button>
      </div>
      <div className="pos-status">{status}</div>
    </div>
  );
}
