import type {
  AccountEntry,
  AuditLog,
  CashbookEntry,
  Payment,
  Product,
  Sale,
  SaleLine,
  SaleStatus,
  SessionUser,
  StockMovement,
  SyncEvent
} from "@/lib/types";
import { newId, readStore, withStoreLock, writeStore } from "@/lib/store";

const DEFAULT_BRANCH_ID = "br_main";
const DEFAULT_REGISTER_ID = "reg_1";
const DEFAULT_TAX_RATE = 20;

type AddLineInput = {
  saleId: string;
  productId: string;
  quantity: number;
  unitPrice?: number;
  discountRate?: number;
};

type FinalizeInput = {
  saleId: string;
  idempotencyKey?: string;
};

type SetManualDiscountInput = {
  saleId: string;
  amount: number;
};

type UpdateLineInput = {
  saleId: string;
  lineId: string;
  mode: "DECREASE_ONE" | "REMOVE";
};

function nowIso(): string {
  return new Date().toISOString();
}

function recalcSale(sale: Sale): Sale {
  const subTotal = sale.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const lineDiscountTotal = sale.lines.reduce((sum, line) => {
    const lineGross = line.quantity * line.unitPrice;
    return sum + lineGross * (line.discountRate / 100);
  }, 0);
  const taxTotal = sale.lines.reduce((sum, line) => {
    const lineGross = line.quantity * line.unitPrice;
    const taxable = lineGross - lineGross * (line.discountRate / 100);
    return sum + taxable * (line.taxRate / 100);
  }, 0);
  const taxable = subTotal - lineDiscountTotal;
  const grossNet = taxable + taxTotal;
  const manualDiscountTotal = Math.min(Math.max(Number(sale.manualDiscountTotal ?? 0), 0), grossNet);
  const discountTotal = lineDiscountTotal + manualDiscountTotal;
  const netTotal = Math.max(grossNet - manualDiscountTotal, 0);
  const dueTotal = Math.max(netTotal - sale.paidTotal, 0);
  const changeTotal = Math.max(sale.paidTotal - netTotal, 0);
  return {
    ...sale,
    subTotal,
    manualDiscountTotal,
    discountTotal,
    taxTotal,
    netTotal,
    dueTotal,
    changeTotal
  };
}

function createAudit(user: SessionUser, action: string, meta: unknown): AuditLog {
  return {
    id: newId("audit"),
    action,
    username: user.username,
    role: user.role,
    meta: JSON.stringify(meta),
    createdAt: nowIso()
  };
}

export async function createDraftSale(user: SessionUser, customerName = "PERAKENDE SATIS"): Promise<Sale> {
  return withStoreLock(async () => {
    const sales = await readStore("sales");
    const sale: Sale = {
      id: newId("sale"),
      branchId: DEFAULT_BRANCH_ID,
      registerId: DEFAULT_REGISTER_ID,
      customerName,
      status: "DRAFT",
      lines: [],
      subTotal: 0,
      discountTotal: 0,
      manualDiscountTotal: 0,
      taxTotal: 0,
      netTotal: 0,
      paidTotal: 0,
      dueTotal: 0,
      changeTotal: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      createdBy: user.username
    };
    sales.unshift(sale);
    await writeStore("sales", sales);

    const logs = await readStore("audit-logs");
    logs.unshift(createAudit(user, "pos.sale.draft.create", { saleId: sale.id }));
    await writeStore("audit-logs", logs);

    return sale;
  });
}

type CreateDraftInput = {
  customerName?: string;
  customerId?: string;
};

export async function createDraftSaleWithCustomer(user: SessionUser, input: CreateDraftInput): Promise<Sale> {
  const customerName = input.customerName?.trim() || "PERAKENDE SATIS";
  const sale = await createDraftSale(user, customerName);
  if (!input.customerId) {
    return sale;
  }
  return withStoreLock(async () => {
    const sales = await readStore("sales");
    const index = sales.findIndex((entry) => entry.id === sale.id);
    if (index < 0) {
      return sale;
    }
    sales[index] = { ...sales[index], customerId: input.customerId };
    await writeStore("sales", sales);
    return sales[index];
  });
}

export async function getOpenDraftSale(user: SessionUser): Promise<Sale | null> {
  const sales = await readStore("sales");
  const draft = sales.find((entry) => entry.status === "DRAFT" && entry.createdBy === user.username);
  if (!draft) {
    return null;
  }
  return recalcSale(draft);
}

export async function addLineToSale(user: SessionUser, input: AddLineInput): Promise<Sale> {
  return withStoreLock(async () => {
    const [sales, products, logs] = await Promise.all([
      readStore("sales"),
      readStore("products"),
      readStore("audit-logs")
    ]);
    const saleIndex = sales.findIndex((entry) => entry.id === input.saleId);
    if (saleIndex < 0) {
      throw new Error("Sale not found");
    }
    const sale = sales[saleIndex];
    if (sale.status !== "DRAFT") {
      throw new Error("Only draft sales can be edited");
    }
    const product = products.find((entry) => entry.id === input.productId);
    if (!product) {
      throw new Error("Product not found");
    }

    const quantity = Number(input.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("Invalid quantity");
    }

    const existingLine = sale.lines.find((line) => line.productId === product.id);
    const price = Number(input.unitPrice ?? product.salePrice);
    const discountRate = Number(input.discountRate ?? 0);

    if (existingLine) {
      existingLine.quantity += quantity;
      existingLine.unitPrice = price;
      existingLine.discountRate = discountRate;
      const gross = existingLine.quantity * existingLine.unitPrice;
      existingLine.lineTotal = gross - gross * (existingLine.discountRate / 100);
    } else {
      const line: SaleLine = {
        id: newId("line"),
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity,
        unitPrice: price,
        discountRate,
        taxRate: product.vatRate ?? DEFAULT_TAX_RATE,
        lineTotal: quantity * price * (1 - discountRate / 100)
      };
      sale.lines.push(line);
    }

    sales[saleIndex] = recalcSale({ ...sale, updatedAt: nowIso() });
    await writeStore("sales", sales);

    logs.unshift(
      createAudit(user, "pos.sale.line.add", {
        saleId: sale.id,
        productId: product.id,
        quantity,
        price
      })
    );
    if (price < product.lastCost) {
      logs.unshift(
        createAudit(user, "pos.warning.negative_margin", {
          saleId: sale.id,
          productId: product.id,
          salePrice: price,
          cost: product.lastCost
        })
      );
    }
    await writeStore("audit-logs", logs);
    return sales[saleIndex];
  });
}

export async function updateSaleLine(user: SessionUser, input: UpdateLineInput): Promise<Sale> {
  return withStoreLock(async () => {
    const [sales, logs] = await Promise.all([readStore("sales"), readStore("audit-logs")]);
    const saleIndex = sales.findIndex((entry) => entry.id === input.saleId);
    if (saleIndex < 0) {
      throw new Error("Sale not found");
    }
    const sale = sales[saleIndex];
    if (sale.status !== "DRAFT") {
      throw new Error("Sadece taslak satis duzenlenebilir.");
    }

    const lineIndex = sale.lines.findIndex((entry) => entry.id === input.lineId);
    if (lineIndex < 0) {
      throw new Error("Satis satiri bulunamadi.");
    }
    const line = sale.lines[lineIndex];

    if (input.mode === "REMOVE") {
      sale.lines.splice(lineIndex, 1);
    } else if (line.quantity <= 1) {
      sale.lines.splice(lineIndex, 1);
    } else {
      const newQuantity = line.quantity - 1;
      const gross = newQuantity * line.unitPrice;
      sale.lines[lineIndex] = {
        ...line,
        quantity: newQuantity,
        lineTotal: gross - gross * (line.discountRate / 100)
      };
    }

    sales[saleIndex] = recalcSale({
      ...sale,
      updatedAt: nowIso()
    });
    logs.unshift(
      createAudit(user, "pos.sale.line.update", {
        saleId: sale.id,
        lineId: input.lineId,
        mode: input.mode
      })
    );
    await Promise.all([writeStore("sales", sales), writeStore("audit-logs", logs)]);
    return sales[saleIndex];
  });
}

export async function addPayment(user: SessionUser, saleId: string, paymentInput: Omit<Payment, "id" | "createdAt" | "createdBy" | "saleId">): Promise<Sale> {
  return withStoreLock(async () => {
    const [sales, payments, logs] = await Promise.all([
      readStore("sales"),
      readStore("payments"),
      readStore("audit-logs")
    ]);
    const saleIndex = sales.findIndex((entry) => entry.id === saleId);
    if (saleIndex < 0) {
      throw new Error("Sale not found");
    }
    const sale = sales[saleIndex];
    if (sale.status !== "DRAFT") {
      throw new Error("Only draft sale can receive payments");
    }

    const amount = Number(paymentInput.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Invalid payment amount");
    }

    const payment: Payment = {
      id: newId("pay"),
      saleId,
      method: paymentInput.method,
      amount,
      reference: paymentInput.reference,
      installmentPlan: paymentInput.installmentPlan,
      createdAt: nowIso(),
      createdBy: user.username
    };

    payments.unshift(payment);
    await writeStore("payments", payments);

    sales[saleIndex] = recalcSale({
      ...sale,
      paidTotal: sale.paidTotal + amount,
      updatedAt: nowIso()
    });
    await writeStore("sales", sales);

    logs.unshift(createAudit(user, "pos.sale.payment.add", { saleId, paymentId: payment.id, amount }));
    await writeStore("audit-logs", logs);
    return sales[saleIndex];
  });
}

export async function setSaleManualDiscount(user: SessionUser, input: SetManualDiscountInput): Promise<Sale> {
  return withStoreLock(async () => {
    const [sales, logs] = await Promise.all([readStore("sales"), readStore("audit-logs")]);
    const saleIndex = sales.findIndex((entry) => entry.id === input.saleId);
    if (saleIndex < 0) {
      throw new Error("Sale not found");
    }
    const sale = sales[saleIndex];
    if (sale.status !== "DRAFT") {
      throw new Error("Sadece taslak satislarda indirim degistirilebilir.");
    }
    if (!Number.isFinite(input.amount) || input.amount < 0) {
      throw new Error("Indirim tutari gecersiz.");
    }

    sales[saleIndex] = recalcSale({
      ...sale,
      manualDiscountTotal: input.amount,
      updatedAt: nowIso()
    });

    logs.unshift(createAudit(user, "pos.sale.discount.set", { saleId: input.saleId, amount: input.amount }));
    await Promise.all([writeStore("sales", sales), writeStore("audit-logs", logs)]);
    return sales[saleIndex];
  });
}

export async function finalizeSale(
  user: SessionUser,
  input: FinalizeInput & { allowOverLimit?: boolean }
): Promise<{ sale: Sale; syncEventId: string }> {
  return withStoreLock(async () => {
    const [sales, products, movements, logs, syncEvents] = await Promise.all([
      readStore("sales"),
      readStore("products"),
      readStore("stock-movements"),
      readStore("audit-logs"),
      readStore("sync-events")
    ]);
    const [customers, accountEntries, cashbook] = await Promise.all([
      readStore("customers"),
      readStore("account-entries"),
      readStore("cashbook")
    ]);

    const saleIndex = sales.findIndex((entry) => entry.id === input.saleId);
    if (saleIndex < 0) {
      throw new Error("Sale not found");
    }
    const sale = sales[saleIndex];

    if (sale.idempotencyKey && input.idempotencyKey && sale.idempotencyKey === input.idempotencyKey) {
      const existingEvent = syncEvents.find((entry) => entry.saleId === sale.id);
      return { sale, syncEventId: existingEvent?.id ?? "" };
    }
    if (sale.status !== "DRAFT") {
      throw new Error("Sale cannot be finalized");
    }
    if (sale.lines.length === 0) {
      throw new Error("Cannot finalize empty sale");
    }

    for (const line of sale.lines) {
      const productIndex = products.findIndex((entry) => entry.id === line.productId);
      if (productIndex < 0) {
        throw new Error(`Product missing for line ${line.id}`);
      }
      products[productIndex].quantity -= line.quantity;
      const stockMove: StockMovement = {
        id: newId("mov"),
        productId: line.productId,
        type: "OUT",
        quantity: line.quantity,
        note: `Sale ${sale.id}`,
        createdAt: nowIso(),
        createdBy: user.username
      };
      movements.unshift(stockMove);
    }

    sales[saleIndex] = {
      ...sale,
      status: "COMPLETED",
      idempotencyKey: input.idempotencyKey ?? sale.idempotencyKey,
      updatedAt: nowIso(),
      dueTotal: Math.max(sale.netTotal - sale.paidTotal, 0)
    };

    const syncEvent: SyncEvent = {
      id: newId("sync"),
      eventType: "SALE_FINALIZE",
      saleId: sale.id,
      payload: JSON.stringify(sales[saleIndex]),
      status: "PENDING",
      attempts: 0,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    syncEvents.unshift(syncEvent);
    logs.unshift(createAudit(user, "pos.sale.finalize", { saleId: sale.id }));

    if (sales[saleIndex].paidTotal > 0) {
      const netCollection = Math.min(sales[saleIndex].paidTotal, sales[saleIndex].netTotal);
      const incomeEntry: CashbookEntry = {
        id: newId("cb"),
        type: "INCOME",
        category: "SALE",
        amount: netCollection,
        note: `Satis tahsilati ${sale.id}`,
        relatedSaleId: sale.id,
        createdAt: nowIso(),
        createdBy: user.username
      };
      cashbook.unshift(incomeEntry);

      const changeAmount = Math.max(sales[saleIndex].paidTotal - sales[saleIndex].netTotal, 0);
      if (changeAmount > 0) {
        cashbook.unshift({
          id: newId("cb"),
          type: "EXPENSE",
          category: "OTHER",
          amount: changeAmount,
          note: `Paraustu iadesi ${sale.id}`,
          relatedSaleId: sale.id,
          createdAt: nowIso(),
          createdBy: user.username
        });
      }
    }

    if (sales[saleIndex].customerId && sales[saleIndex].dueTotal > 0) {
      const customerIndex = customers.findIndex((entry) => entry.id === sales[saleIndex].customerId);
      if (customerIndex >= 0) {
        const projected = customers[customerIndex].balance + sales[saleIndex].dueTotal;
        if (
          customers[customerIndex].creditLimit > 0 &&
          projected > customers[customerIndex].creditLimit &&
          !input.allowOverLimit
        ) {
          throw new Error("Musteri kredi limiti asiliyor. Yonetici onayi gerekir.");
        }
        customers[customerIndex].balance += sales[saleIndex].dueTotal;
      }
      const debitEntry: AccountEntry = {
        id: newId("acc"),
        customerId: sales[saleIndex].customerId,
        type: "DEBIT",
        amount: sales[saleIndex].dueTotal,
        note: `Vadeli satis ${sale.id}`,
        relatedSaleId: sale.id,
        createdAt: nowIso(),
        createdBy: user.username
      };
      accountEntries.unshift(debitEntry);
    }

    await Promise.all([
      writeStore("products", products),
      writeStore("stock-movements", movements),
      writeStore("sales", sales),
      writeStore("sync-events", syncEvents),
      writeStore("audit-logs", logs),
      writeStore("customers", customers),
      writeStore("account-entries", accountEntries),
      writeStore("cashbook", cashbook)
    ]);

    return { sale: sales[saleIndex], syncEventId: syncEvent.id };
  });
}

async function setSaleStatus(user: SessionUser, saleId: string, status: SaleStatus, action: string): Promise<Sale> {
  return withStoreLock(async () => {
    const [sales, logs] = await Promise.all([readStore("sales"), readStore("audit-logs")]);
    const saleIndex = sales.findIndex((entry) => entry.id === saleId);
    if (saleIndex < 0) {
      throw new Error("Sale not found");
    }
    sales[saleIndex] = { ...sales[saleIndex], status, updatedAt: nowIso() };
    logs.unshift(createAudit(user, action, { saleId }));
    await Promise.all([writeStore("sales", sales), writeStore("audit-logs", logs)]);
    return sales[saleIndex];
  });
}

export async function voidSale(user: SessionUser, saleId: string): Promise<Sale> {
  return setSaleStatus(user, saleId, "VOIDED", "pos.sale.void");
}

export async function refundSale(user: SessionUser, saleId: string): Promise<Sale> {
  return setSaleStatus(user, saleId, "REFUNDED", "pos.sale.refund");
}

export async function getCatalog(branchId: string, categoryId?: string, q?: string): Promise<Product[]> {
  const products = await readStore("products");
  const text = (q ?? "").trim().toLowerCase();
  return products.filter((product) => {
    const branchOk = !product.branchId || product.branchId === branchId;
    const categoryOk = !categoryId || product.categoryId === categoryId;
    const textOk =
      !text ||
      product.name.toLowerCase().includes(text) ||
      product.sku.toLowerCase().includes(text) ||
      (product.barcode ?? "").toLowerCase().includes(text);
    return branchOk && categoryOk && textOk;
  });
}

export async function syncOfflineEvents(ids: string[]): Promise<{ synced: number; failed: number }> {
  return withStoreLock(async () => {
    const events = await readStore("sync-events");
    let synced = 0;
    let failed = 0;
    for (const event of events) {
      if (!ids.includes(event.id)) {
        continue;
      }
      if (event.status === "SYNCED") {
        synced += 1;
        continue;
      }
      event.attempts += 1;
      event.updatedAt = nowIso();
      try {
        event.status = "SYNCED";
        event.error = undefined;
        synced += 1;
      } catch {
        event.status = "FAILED";
        event.error = "Unknown sync failure";
        failed += 1;
      }
    }
    await writeStore("sync-events", events);
    return { synced, failed };
  });
}

export async function reversePayment(
  user: SessionUser,
  paymentId: string,
  note: string
): Promise<{ saleId: string; reversedAmount: number }> {
  return withStoreLock(async () => {
    const [payments, sales, cashbook, logs] = await Promise.all([
      readStore("payments"),
      readStore("sales"),
      readStore("cashbook"),
      readStore("audit-logs")
    ]);

    const paymentIndex = payments.findIndex((entry) => entry.id === paymentId);
    if (paymentIndex < 0) {
      throw new Error("Odeme kaydi bulunamadi.");
    }
    const payment = payments[paymentIndex];
    const saleIndex = sales.findIndex((entry) => entry.id === payment.saleId);
    if (saleIndex < 0) {
      throw new Error("Satis kaydi bulunamadi.");
    }

    sales[saleIndex] = recalcSale({
      ...sales[saleIndex],
      paidTotal: Math.max(sales[saleIndex].paidTotal - payment.amount, 0),
      updatedAt: nowIso()
    });

    payments.splice(paymentIndex, 1);

    cashbook.unshift({
      id: newId("cb"),
      type: "EXPENSE",
      category: "OTHER",
      amount: payment.amount,
      note: `Yanlis odeme duzeltme: ${note || paymentId}`,
      relatedSaleId: payment.saleId,
      createdAt: nowIso(),
      createdBy: user.username
    });

    logs.unshift(createAudit(user, "pos.payment.reverse", { paymentId, saleId: payment.saleId, amount: payment.amount }));

    await Promise.all([
      writeStore("sales", sales),
      writeStore("payments", payments),
      writeStore("cashbook", cashbook),
      writeStore("audit-logs", logs)
    ]);

    return { saleId: payment.saleId, reversedAmount: payment.amount };
  });
}
