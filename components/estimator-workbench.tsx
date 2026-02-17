"use client";

import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import type { Customer, Estimate, Product, RecipeTemplate } from "@/lib/types";
import { Field } from "@/components/ui/field";
import { SectionCard } from "@/components/ui/section-card";
import { notify } from "@/lib/toast";

type Props = {
  templates: RecipeTemplate[];
  customers: Customer[];
};

type EstimateStatus = "OPEN" | "WON" | "LOST";

type EstimateDraft = {
  id: string;
  title: string;
  customerName: string;
  customerPhone: string;
  templateId: string;
  areaValue: number;
  thicknessCm: number;
  wastePercent: number;
  customInputs?: Record<string, number>;
  estimate?: Estimate;
  createdAt: string;
};

const DRAFT_STORAGE_KEY = "nalburos_estimate_drafts";

function money(value: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(value);
}

function dateTime(value: string): string {
  return new Date(value).toLocaleString("tr-TR");
}

function statusLabel(status: EstimateStatus): string {
  if (status === "WON") {
    return "Kabul";
  }
  if (status === "LOST") {
    return "Vazgecti";
  }
  return "Bekliyor";
}

function readDrafts(): EstimateDraft[] {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw) as EstimateDraft[];
  } catch {
    return [];
  }
}

function writeDrafts(drafts: EstimateDraft[]): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
}

function recalcEstimateTotals(source: Estimate): Estimate {
  const lines = source.lines.map((line) => ({
    ...line,
    totalSale: Number((line.quantity * line.salePrice).toFixed(2)),
    totalCost: Number((line.quantity * line.costPrice).toFixed(2))
  }));
  const totalSale = Number(lines.reduce((sum, line) => sum + line.totalSale, 0).toFixed(2));
  const totalCost = Number(lines.reduce((sum, line) => sum + line.totalCost, 0).toFixed(2));
  const grossProfit = Number((totalSale - totalCost).toFixed(2));
  const grossMarginPercent = totalSale > 0 ? Number(((grossProfit / totalSale) * 100).toFixed(2)) : 0;
  return { ...source, lines, totalSale, totalCost, grossProfit, grossMarginPercent };
}

function normalizeEstimate(source: Estimate): Estimate {
  return recalcEstimateTotals({
    ...source,
    lines: source.lines.map((line) => ({
      ...line,
      requiredQuantity: line.requiredQuantity ?? line.quantity,
      requiredUnit: line.requiredUnit ?? line.unit
    }))
  });
}

export function EstimatorWorkbench({ templates, customers }: Props): JSX.Element {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [areaValue, setAreaValue] = useState(100);
  const [thicknessCm, setThicknessCm] = useState(1);
  const [wastePercent, setWastePercent] = useState(8);
  const [customInputs, setCustomInputs] = useState<Record<string, number>>({});
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [savedEstimateId, setSavedEstimateId] = useState("");
  const [savedEstimates, setSavedEstimates] = useState<Estimate[]>([]);
  const [transferCustomerId, setTransferCustomerId] = useState(customers[0]?.id ?? "");
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [manualProductId, setManualProductId] = useState("");
  const [manualQty, setManualQty] = useState("1");
  const [drafts, setDrafts] = useState<EstimateDraft[]>([]);
  const [historyFilter, setHistoryFilter] = useState<"ALL" | EstimateStatus>("ALL");
  const [status, setStatus] = useState("");

  const template = useMemo(() => templates.find((entry) => entry.id === templateId), [templates, templateId]);

  function defaultsForTemplate(nextTemplate: RecipeTemplate | undefined): Record<string, number> {
    if (!nextTemplate?.customInputs?.length) {
      return {};
    }
    return Object.fromEntries(nextTemplate.customInputs.map((entry) => [entry.key, Number(entry.defaultValue ?? 0)]));
  }

  const filteredSavedEstimates = useMemo(() => {
    if (historyFilter === "ALL") {
      return savedEstimates;
    }
    return savedEstimates.filter((entry) => (entry.status ?? "OPEN") === historyFilter);
  }, [historyFilter, savedEstimates]);

  useEffect(() => {
    setDrafts(readDrafts());
    void refreshSavedEstimates();
    void refreshCatalog();
    setCustomInputs(defaultsForTemplate(template));
  }, []);

  async function refreshSavedEstimates(): Promise<void> {
    const response = await fetch("/api/estimates/list?limit=120");
    const data = (await response.json()) as { estimates?: Estimate[] };
    if (response.ok && data.estimates) {
      setSavedEstimates(data.estimates.map(normalizeEstimate));
    }
  }

  async function refreshCatalog(): Promise<void> {
    const response = await fetch("/api/pos/catalog?branchId=br_main");
    const data = (await response.json()) as { products?: Product[] };
    if (response.ok && data.products) {
      setCatalog(data.products);
      if (!manualProductId && data.products[0]) {
        setManualProductId(data.products[0].id);
      }
    }
  }

  function resetForm(): void {
    setStep(1);
    setTitle("");
    setCustomerName("");
    setCustomerPhone("");
    setAreaValue(100);
    setThicknessCm(1);
    setWastePercent(template?.defaultWastePercent ?? 8);
    setCustomInputs(defaultsForTemplate(template));
    setEstimate(null);
    setSavedEstimateId("");
  }

  async function calculate(): Promise<void> {
    setStatus("");
    const response = await fetch("/api/estimates/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId,
        title,
        areaValue,
        thicknessCm,
        wastePercent,
        customInputs
      })
    });
    const data = (await response.json()) as { estimate?: Estimate; error?: string };
    if (!response.ok || !data.estimate) {
      setStatus(data.error ?? "Hesaplama hatasi.");
      return;
    }
    setEstimate(normalizeEstimate({
      ...data.estimate,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined
    }));
    setSavedEstimateId("");
    setStep(3);
  }

  async function save(): Promise<void> {
    if (!estimate) {
      return;
    }
    const response = await fetch("/api/estimates/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estimate: {
          ...estimate,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined
        }
      })
    });
    const data = (await response.json()) as { estimate?: Estimate; error?: string };
    if (!response.ok || !data.estimate) {
      setStatus(data.error ?? "Kaydetme hatasi.");
      return;
    }
    setSavedEstimateId(data.estimate.id);
    setEstimate(normalizeEstimate(data.estimate));
    setStatus("Teklif kaydedildi.");
    setStep(4);
    await refreshSavedEstimates();
  }

  function saveDraft(): void {
    const draft: EstimateDraft = {
      id: `drf_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`,
      title: title.trim() || `${template?.name ?? "Metraj"} Taslak`,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      templateId,
      areaValue,
      thicknessCm,
      wastePercent,
      customInputs,
      estimate: estimate ?? undefined,
      createdAt: new Date().toISOString()
    };
    const nextDrafts = [draft, ...drafts].slice(0, 200);
    setDrafts(nextDrafts);
    writeDrafts(nextDrafts);
    setStatus("Taslak kaydedildi.");
  }

  function loadDraft(draft: EstimateDraft): void {
    setTemplateId(draft.templateId);
    setTitle(draft.title);
    setCustomerName(draft.customerName);
    setCustomerPhone(draft.customerPhone);
    setAreaValue(draft.areaValue);
    setThicknessCm(draft.thicknessCm);
    setWastePercent(draft.wastePercent);
    setCustomInputs(draft.customInputs ?? defaultsForTemplate(templates.find((entry) => entry.id === draft.templateId)));
    setEstimate(draft.estimate ? normalizeEstimate(draft.estimate) : null);
    setSavedEstimateId("");
    setStep(draft.estimate ? 3 : 2);
    setStatus("Taslak acildi.");
  }

  function deleteDraft(draftId: string): void {
    const nextDrafts = drafts.filter((entry) => entry.id !== draftId);
    setDrafts(nextDrafts);
    writeDrafts(nextDrafts);
    setStatus("Taslak silindi.");
  }

  function openSavedEstimate(item: Estimate): void {
    setTemplateId(item.templateId);
    setTitle(item.title);
    setCustomerName(item.customerName ?? "");
    setCustomerPhone(item.customerPhone ?? "");
    setAreaValue(item.areaValue);
    setThicknessCm(item.thicknessCm ?? 1);
    setWastePercent(item.wastePercent);
    setEstimate(normalizeEstimate(item));
    setSavedEstimateId(item.id);
    setStep(3);
    setStatus("Kayitli teklif acildi.");
  }

  async function markStatus(estimateId: string, newStatus: EstimateStatus): Promise<void> {
    const response = await fetch(`/api/estimates/${estimateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setStatus(data.error ?? "Durum guncellenemedi.");
      return;
    }
    setStatus("Teklif durumu guncellendi.");
    await refreshSavedEstimates();
    if (savedEstimateId === estimateId && estimate) {
      setEstimate({
        ...estimate,
        status: newStatus
      });
    }
  }

  async function deleteSavedEstimate(estimateId: string): Promise<void> {
    const ok = window.confirm("Bu teklif kaydini silmek istiyor musunuz?");
    if (!ok) {
      return;
    }
    const response = await fetch(`/api/estimates/${estimateId}`, { method: "DELETE" });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setStatus(data.error ?? "Kayit silinemedi.");
      return;
    }
    if (savedEstimateId === estimateId) {
      setSavedEstimateId("");
      setEstimate(null);
    }
    setStatus("Kayit silindi.");
    await refreshSavedEstimates();
  }

  function adjustLineQuantity(productId: string, delta: number): void {
    if (!estimate) {
      return;
    }
    const nextLines = estimate.lines
      .map((line) => {
        if (line.productId !== productId) {
          return line;
        }
        const nextQty = Number((line.quantity + delta).toFixed(2));
        if (line.unit === "piece" || line.unit === "box") {
          return { ...line, quantity: Math.max(1, Math.round(nextQty)) };
        }
        return { ...line, quantity: Math.max(0, nextQty) };
      })
      .filter((line) => line.quantity > 0);
    setEstimate(recalcEstimateTotals({ ...estimate, lines: nextLines }));
  }

  function removeLine(productId: string): void {
    if (!estimate) {
      return;
    }
    const nextLines = estimate.lines.filter((line) => line.productId !== productId);
    setEstimate(recalcEstimateTotals({ ...estimate, lines: nextLines }));
  }

  async function transferToPos(): Promise<void> {
    if (!savedEstimateId) {
      setStatus("Once teklifi kaydet.");
      return;
    }
    const response = await fetch("/api/estimates/to-pos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estimateId: savedEstimateId,
        customerId: transferCustomerId || undefined
      })
    });
    const data = (await response.json()) as { saleId?: string; error?: string };
    if (!response.ok || !data.saleId) {
      setStatus(data.error ?? "POS aktarimi basarisiz.");
      return;
    }
    notify({ type: "success", message: `POS taslagi olustu: ${data.saleId}` });
    setStatus(`POS taslagi olustu: ${data.saleId}`);
  }

  async function transferToLedger(): Promise<void> {
    if (!savedEstimateId) {
      setStatus("Once teklifi kaydet.");
      return;
    }
    if (!transferCustomerId) {
      setStatus("Cari aktarim icin musteri sec.");
      return;
    }
    const response = await fetch("/api/estimates/to-ledger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estimateId: savedEstimateId,
        customerId: transferCustomerId
      })
    });
    const data = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !data.ok) {
      setStatus(data.error ?? "Cari aktarim basarisiz.");
      return;
    }
    notify({ type: "success", message: "Teklif veresiye defterine aktarildi." });
    setStatus("Teklif veresiye defterine aktarildi.");
  }

  function addManualLine(): void {
    if (!estimate) {
      return;
    }
    const qty = Number(manualQty);
    if (!manualProductId || !Number.isFinite(qty) || qty <= 0) {
      setStatus("Gecerli urun ve miktar girin.");
      return;
    }
    const product = catalog.find((entry) => entry.id === manualProductId);
    if (!product) {
      setStatus("Urun bulunamadi.");
      return;
    }
    const existing = estimate.lines.find((line) => line.productId === product.id);
    const nextLines = existing
      ? estimate.lines.map((line) =>
          line.productId === product.id
            ? {
                ...line,
                quantity: line.quantity + qty,
                requiredQuantity: (line.requiredQuantity ?? line.quantity) + qty
              }
            : line
        )
      : [
          ...estimate.lines,
          {
            productId: product.id,
            productName: product.name,
            unit: product.unit,
            requiredQuantity: qty,
            requiredUnit: product.unit,
            quantity: product.unit === "piece" || product.unit === "box" ? Math.ceil(qty) : qty,
            salePrice: product.salePrice,
            costPrice: product.lastCost,
            totalSale: 0,
            totalCost: 0
          }
        ];
    setEstimate(recalcEstimateTotals({ ...estimate, lines: nextLines }));
    setStatus("Kalem eklendi.");
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="card" style={{ display: "flex", gap: 8 }}>
        <button type="button" className={step === 1 ? "secondary" : ""} onClick={() => setStep(1)}>
          1. Sablon
        </button>
        <button type="button" className={step === 2 ? "secondary" : ""} onClick={() => setStep(2)}>
          2. Olculer
        </button>
        <button type="button" className={step === 3 ? "secondary" : ""} onClick={() => setStep(3)} disabled={!estimate}>
          3. Sonuc
        </button>
        <button type="button" className={step === 4 ? "secondary" : ""} onClick={() => setStep(4)} disabled={!savedEstimateId}>
          4. Cikti
        </button>
        <button type="button" className="ghost" onClick={resetForm}>
          Yeni Hesap
        </button>
      </div>

      {step === 1 ? (
        <SectionCard title="Paket Sec">
          <Field label="Hazir Hesap Paketi" unit="Secim" hint="Boya, siva, sap gibi hazir receteler.">
            <select
              value={templateId}
              onChange={(event) => {
                const nextId = event.target.value;
                setTemplateId(nextId);
                const nextTemplate = templates.find((entry) => entry.id === nextId);
                if (nextTemplate) {
                  setWastePercent(nextTemplate.defaultWastePercent);
                  setCustomInputs(defaultsForTemplate(nextTemplate));
                }
                setEstimate(null);
                setSavedEstimateId("");
              }}
            >
              {templates.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </Field>
          {template ? <p className="muted">{template.description}</p> : null}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setStep(2)}>
              Devam
            </button>
          </div>
        </SectionCard>
      ) : null}

      {step === 2 ? (
        <SectionCard title="Olculeri Gir">
          <div className="form-grid">
            <Field label="Teklif Basligi" unit="Metin" example="A Blok Ic Cephe Boya">
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Teklif basligi" />
            </Field>
            <Field label="Musteri Adi" unit="Opsiyonel" example="Ahmet Yilmaz">
              <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Musteri adi" />
            </Field>
            <Field label="Musteri Telefon" unit="Opsiyonel" example="05xx xxx xx xx">
              <input
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                placeholder="Telefon"
              />
            </Field>
            <Field
              label={template?.primaryInputLabel ?? "Alan Degeri"}
              unit={template?.inputMode === "meter" ? "m" : template?.inputMode ?? "m2"}
              example="120"
            >
              <input type="number" value={areaValue} onChange={(event) => setAreaValue(Number(event.target.value))} />
            </Field>
            {template?.showThickness === false ? null : (
              <Field label="Kalinlik" unit="cm" example="2" hint="m3/per_m3 formullerinde kullanilir.">
                <input type="number" value={thicknessCm} onChange={(event) => setThicknessCm(Number(event.target.value))} />
              </Field>
            )}
            <Field label="Fire Orani" unit="%" example="8" hint="Sarfiyat payi.">
              <input type="number" value={wastePercent} onChange={(event) => setWastePercent(Number(event.target.value))} />
            </Field>
            {(template?.customInputs ?? []).map((inputDef) => (
              <Field
                key={inputDef.key}
                label={inputDef.label}
                unit={inputDef.unit}
                example={inputDef.example}
                hint={inputDef.hint}
              >
                <input
                  type="number"
                  min={inputDef.min}
                  max={inputDef.max}
                  value={Number(customInputs[inputDef.key] ?? inputDef.defaultValue ?? 0)}
                  onChange={(event) =>
                    setCustomInputs((prev) => ({
                      ...prev,
                      [inputDef.key]: Number(event.target.value)
                    }))
                  }
                />
              </Field>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="secondary" onClick={() => setStep(1)}>
                Geri
              </button>
              <button type="button" className="ghost" onClick={saveDraft}>
                Taslak Kaydet
              </button>
            </div>
            <button type="button" onClick={() => void calculate()}>
              Hesapla
            </button>
          </div>
        </SectionCard>
      ) : null}

      {step === 3 && estimate ? (
        <SectionCard title="Hesap Sonucu">
          <div className="grid-4">
            <div className="card">
              <div className="muted">Toplam Satis</div>
              <h3>{money(estimate.totalSale)}</h3>
            </div>
            <div className="card">
              <div className="muted">Toplam Maliyet</div>
              <h3>{money(estimate.totalCost)}</h3>
            </div>
            <div className="card">
              <div className="muted">Brut Kar</div>
              <h3>{money(estimate.grossProfit)}</h3>
            </div>
            <div className="card">
              <div className="muted">Kar Marji</div>
              <h3>%{estimate.grossMarginPercent}</h3>
            </div>
          </div>
          <div className="table-scroll estimate-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Kalem</th>
                  <th>Gerekli</th>
                  <th>Satis</th>
                  <th>Paket</th>
                  <th>Fiyat</th>
                  <th>Tutar</th>
                  <th>Islem</th>
                </tr>
              </thead>
              <tbody>
                {estimate.lines.map((line) => (
                  <tr key={`${line.productId}_${line.productName}`}>
                    <td>{line.productName}</td>
                    <td>
                      {line.requiredQuantity} {line.requiredUnit}
                    </td>
                    <td>
                      {line.quantity} {line.unit}
                    </td>
                    <td>{line.packageLabel ?? "-"}</td>
                    <td>{money(line.salePrice)}</td>
                    <td>{money(line.totalSale)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" className="ghost btn-inline" onClick={() => adjustLineQuantity(line.productId, -1)}>
                          -1
                        </button>
                        <button type="button" className="ghost btn-inline" onClick={() => adjustLineQuantity(line.productId, 1)}>
                          +1
                        </button>
                        <button type="button" className="danger btn-inline" onClick={() => removeLine(line.productId)}>
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {estimate.lines.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      Satir kalmadi. Geri donup yeniden hesaplayin.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="card" style={{ marginTop: 8 }}>
            <strong>Kalem Ekle</strong>
            <div className="form-grid" style={{ marginTop: 8 }}>
              <Field label="Urun" unit="Secim">
                <select value={manualProductId} onChange={(event) => setManualProductId(event.target.value)}>
                  {catalog.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.sku} - {product.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Miktar" unit="Adet / m / kg">
                <input type="number" value={manualQty} onChange={(event) => setManualQty(event.target.value)} min={0.01} step={0.01} />
              </Field>
              <div className="field-wrap" style={{ alignSelf: "end" }}>
                <button type="button" onClick={addManualLine}>
                  Kalemi Ekle
                </button>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="secondary" onClick={() => setStep(2)}>
                Geri
              </button>
              <button type="button" className="ghost" onClick={saveDraft}>
                Taslak Kaydet
              </button>
            </div>
            <button type="button" onClick={() => void save()}>
              Teklifi Kaydet
            </button>
          </div>
        </SectionCard>
      ) : null}

      {step === 4 ? (
        <SectionCard title="Cikti ve Sonraki Adim">
          {savedEstimateId ? (
            <div style={{ display: "grid", gap: 10 }}>
              <p className="muted">Teklif kayit no: {savedEstimateId}</p>
              <Field label="Aktarim Musterisi" unit="Secim" hint="POS taslagi veya veresiye aktarimi icin kullanilir.">
                <select value={transferCustomerId} onChange={(event) => setTransferCustomerId(event.target.value)}>
                  <option value="">Perakende / Secilmedi</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.code} - {customer.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="secondary" onClick={() => void transferToPos()}>
                  POS Taslaga Aktar
                </button>
                <button type="button" onClick={() => void transferToLedger()}>
                  Veresiye Defterine Aktar
                </button>
              </div>
              <a href={`/api/export/estimate/${savedEstimateId}.csv`} target="_blank">
                <button type="button">CSV Teklifi Indir</button>
              </a>
            </div>
          ) : (
            <p className="muted">Once teklifi kaydet.</p>
          )}
        </SectionCard>
      ) : null}

      <SectionCard title="Teklif Kutusu">
        <div style={{ display: "grid", gap: 10 }} className="estimate-box-scroll">
          <div className="section-head">
            <strong>Taslaklar (Kaydetmeden)</strong>
            <span className="muted">{drafts.length} adet</span>
          </div>
          <div className="table-scroll estimate-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Baslik</th>
                  <th>Musteri</th>
                  <th>Tarih</th>
                  <th>Islem</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft) => (
                  <tr key={draft.id}>
                    <td>{draft.title}</td>
                    <td>{draft.customerName || "-"}</td>
                    <td>{dateTime(draft.createdAt)}</td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button type="button" className="secondary btn-inline" onClick={() => loadDraft(draft)}>
                        Ac
                      </button>
                      <button type="button" className="danger btn-inline" onClick={() => deleteDraft(draft.id)}>
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
                {drafts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      Taslak yok.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="section-head">
            <strong>Kayitli Teklifler</strong>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className={historyFilter === "ALL" ? "secondary" : "ghost"} onClick={() => setHistoryFilter("ALL")}>
                Tum
              </button>
              <button type="button" className={historyFilter === "OPEN" ? "secondary" : "ghost"} onClick={() => setHistoryFilter("OPEN")}>
                Bekleyen
              </button>
              <button type="button" className={historyFilter === "WON" ? "secondary" : "ghost"} onClick={() => setHistoryFilter("WON")}>
                Kabul
              </button>
              <button type="button" className={historyFilter === "LOST" ? "secondary" : "ghost"} onClick={() => setHistoryFilter("LOST")}>
                Vazgecti
              </button>
            </div>
          </div>

          <div className="table-scroll estimate-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Baslik</th>
                  <th>Musteri</th>
                  <th>Toplam</th>
                  <th>Durum</th>
                  <th>Tarih</th>
                  <th>Islem</th>
                </tr>
              </thead>
              <tbody>
                {filteredSavedEstimates.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.title}</td>
                    <td>{item.customerName || "-"}</td>
                    <td>{money(item.totalSale)}</td>
                    <td>{statusLabel((item.status ?? "OPEN") as EstimateStatus)}</td>
                    <td>{dateTime(item.createdAt)}</td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button type="button" className="secondary btn-inline" onClick={() => openSavedEstimate(item)}>
                        Ac
                      </button>
                      <button type="button" className="ghost btn-inline" onClick={() => void markStatus(item.id, "WON")}>
                        Kabul
                      </button>
                      <button type="button" className="ghost btn-inline" onClick={() => void markStatus(item.id, "LOST")}>
                        Vazgecti
                      </button>
                      {(item.status ?? "OPEN") === "LOST" ? (
                        <button type="button" className="danger btn-inline" onClick={() => void deleteSavedEstimate(item.id)}>
                          Sil
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {filteredSavedEstimates.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      Kayitli teklif yok.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      {status ? <p className="muted">{status}</p> : null}
    </div>
  );
}
