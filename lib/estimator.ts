import type { Estimate, EstimateLine, Product, RecipeTemplate, SessionUser } from "@/lib/types";
import { newId, readStore, withStoreLock, writeStore } from "@/lib/store";

type CalculateInput = {
  templateId: string;
  areaValue: number;
  thicknessCm?: number;
  wastePercent?: number;
  title?: string;
  customInputs?: Record<string, number>;
};

function round(value: number): number {
  return Number(value.toFixed(2));
}

function ceilToStep(value: number, step: number): number {
  if (step <= 0) {
    return round(value);
  }
  return round(Math.ceil(value / step) * step);
}

function parsePackageInfo(product: Product): { packSize: number; packUnit: "kg" | "meter" | "piece" | "box"; label: string } | null {
  const text = product.name.toLowerCase();
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(kg|gr|g|lt|l|m)\b/i);
  if (!match) {
    return null;
  }
  const raw = Number(match[1].replace(",", "."));
  const token = match[2].toLowerCase();
  if (!Number.isFinite(raw) || raw <= 0) {
    return null;
  }
  if (token === "gr" || token === "g") {
    return { packSize: raw / 1000, packUnit: "kg", label: `${raw}gr` };
  }
  if (token === "kg") {
    return { packSize: raw, packUnit: "kg", label: `${raw}kg` };
  }
  if (token === "m") {
    return { packSize: raw, packUnit: "meter", label: `${raw}m` };
  }
  return null;
}

function resolveSellQuantity(requiredQty: number, requiredUnit: EstimateLine["requiredUnit"], product: Product | undefined): {
  sellQty: number;
  packageSize?: number;
  packageUnit?: EstimateLine["packageUnit"];
  packageLabel?: string;
} {
  if (!product) {
    return { sellQty: round(requiredQty) };
  }

  if (product.unit === "meter") {
    return { sellQty: ceilToStep(requiredQty, 0.01) };
  }
  if (product.unit === "kg") {
    return { sellQty: ceilToStep(requiredQty, 0.01) };
  }

  if (product.unit === "piece" || product.unit === "box") {
    const pkg = parsePackageInfo(product);
    if (pkg && pkg.packUnit === requiredUnit) {
      const pieces = Math.max(1, Math.ceil(requiredQty / pkg.packSize));
      return {
        sellQty: pieces,
        packageSize: pkg.packSize,
        packageUnit: pkg.packUnit,
        packageLabel: pkg.label
      };
    }
    return { sellQty: Math.max(1, Math.ceil(requiredQty)) };
  }

  return { sellQty: round(requiredQty) };
}

function calculateQuantity(
  mode: RecipeTemplate["inputMode"],
  formula: "per_m2" | "per_m3" | "per_meter" | "fixed" | "per_input",
  coefficient: number,
  areaValue: number,
  thicknessCm: number,
  customInputs: Record<string, number>,
  inputKey?: string
): number {
  if (formula === "fixed") {
    return coefficient;
  }
  if (formula === "per_input") {
    if (!inputKey) {
      return 0;
    }
    const inputValue = Number(customInputs[inputKey] ?? 0);
    return inputValue * coefficient;
  }
  if (formula === "per_meter") {
    return areaValue * coefficient;
  }
  if (formula === "per_m3") {
    const volume = areaValue * (thicknessCm / 100);
    return volume * coefficient;
  }
  const based = mode === "m2" ? areaValue : mode === "meter" ? areaValue : areaValue * (thicknessCm / 100);
  return based * coefficient;
}

export async function calculateEstimate(input: CalculateInput): Promise<Estimate> {
  const [templates, products] = await Promise.all([readStore("recipe-templates"), readStore("products")]);
  const template = templates.find((entry) => entry.id === input.templateId);
  if (!template) {
    throw new Error("Sablon bulunamadi.");
  }
  const areaValue = Number(input.areaValue);
  if (!Number.isFinite(areaValue) || areaValue <= 0) {
    throw new Error("Gecerli alan degeri girin.");
  }
  const thicknessCm = Number(input.thicknessCm ?? 1);
  const wastePercent = Number(input.wastePercent ?? template.defaultWastePercent);
  const customInputs = Object.fromEntries(
    (template.customInputs ?? []).map((entry) => {
      const incoming = Number(input.customInputs?.[entry.key] ?? entry.defaultValue ?? 0);
      return [entry.key, Number.isFinite(incoming) ? incoming : 0];
    })
  );

  for (const inputDef of template.customInputs ?? []) {
    const value = customInputs[inputDef.key];
    if (inputDef.required && (!Number.isFinite(value) || value <= 0)) {
      throw new Error(`${inputDef.label} zorunlu.`);
    }
  }

  const lines: EstimateLine[] = template.items.map((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    const baseQty = calculateQuantity(
      template.inputMode,
      item.quantityFormula,
      item.coefficient,
      areaValue,
      thicknessCm,
      customInputs,
      item.inputKey
    );
    const withWaste = baseQty * (1 + wastePercent / 100);
    const requiredUnit = item.unit;
    const requiredQty = round(withWaste);
    const sellInfo = resolveSellQuantity(requiredQty, requiredUnit, product);
    const qty = sellInfo.sellQty;
    const salePrice = product?.salePrice ?? 0;
    const costPrice = product?.lastCost ?? 0;
    return {
      productId: item.productId,
      productName: product?.name ?? item.productName,
      unit: product?.unit ?? item.unit,
      requiredQuantity: requiredQty,
      requiredUnit,
      quantity: qty,
      packageSize: sellInfo.packageSize,
      packageUnit: sellInfo.packageUnit,
      packageLabel: sellInfo.packageLabel,
      salePrice,
      costPrice,
      totalSale: round(qty * salePrice),
      totalCost: round(qty * costPrice)
    };
  });

  const totalSale = round(lines.reduce((sum, line) => sum + line.totalSale, 0));
  const totalCost = round(lines.reduce((sum, line) => sum + line.totalCost, 0));
  const grossProfit = round(totalSale - totalCost);
  const grossMarginPercent = totalSale > 0 ? round((grossProfit / totalSale) * 100) : 0;

  return {
    id: "",
    templateId: template.id,
    templateName: template.name,
    title: input.title?.trim() || `${template.name} Teklif`,
    areaValue,
    thicknessCm,
    wastePercent,
    lines,
    totalSale,
    totalCost,
    grossProfit,
    grossMarginPercent,
    status: "OPEN",
    createdAt: new Date().toISOString(),
    createdBy: "",
    versions: []
  };
}

export async function saveEstimate(user: SessionUser, estimate: Estimate): Promise<Estimate> {
  return withStoreLock(async () => {
    const estimates = await readStore("estimates");
    const record: Estimate = {
      ...estimate,
      id: newId("est"),
      status: estimate.status ?? "OPEN",
      createdAt: new Date().toISOString(),
      createdBy: user.username,
      versions: [
        {
          version: 1,
          changedAt: new Date().toISOString(),
          changedBy: user.username,
          note: "Ilk kayit"
        }
      ]
    };
    estimates.unshift(record);
    await writeStore("estimates", estimates);
    return record;
  });
}

export async function listEstimates(limit = 100): Promise<Estimate[]> {
  const estimates = await readStore("estimates");
  return estimates
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, Math.max(1, Math.min(limit, 1000)))
    .map((entry) => ({
      ...entry,
      status: entry.status ?? "OPEN"
    }));
}

export async function updateEstimateStatus(
  user: SessionUser,
  estimateId: string,
  status: "OPEN" | "WON" | "LOST",
  note?: string
): Promise<Estimate> {
  return withStoreLock(async () => {
    const estimates = await readStore("estimates");
    const index = estimates.findIndex((entry) => entry.id === estimateId);
    if (index < 0) {
      throw new Error("Teklif kaydi bulunamadi.");
    }
    const current = estimates[index];
    const versionNo = (current.versions.at(0)?.version ?? 1) + 1;
    const updated: Estimate = {
      ...current,
      status,
      statusNote: note?.trim() || current.statusNote,
      versions: [
        {
          version: versionNo,
          changedAt: new Date().toISOString(),
          changedBy: user.username,
          note: `Durum guncellendi: ${status}${note ? ` (${note})` : ""}`
        },
        ...current.versions
      ]
    };
    estimates[index] = updated;
    await writeStore("estimates", estimates);
    return updated;
  });
}

export async function deleteEstimate(estimateId: string): Promise<void> {
  return withStoreLock(async () => {
    const estimates = await readStore("estimates");
    const filtered = estimates.filter((entry) => entry.id !== estimateId);
    await writeStore("estimates", filtered);
  });
}
