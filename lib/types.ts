export type UserRole = "Owner" | "Manager" | "Cashier" | "Warehouse" | "FieldSales";

export type UserRecord = {
  id: string;
  username: string;
  email?: string;
  password?: string;
  passwordHash?: string;
  passwordSalt?: string;
  passwordUpdatedAt?: string;
  name: string;
  role: UserRole;
};

export type SessionUser = {
  username: string;
  name: string;
  role: UserRole;
};

export type PasswordResetToken = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt?: string;
  requestedFromIp?: string;
  createdAt: string;
};

export type Permission =
  | "pos.sell"
  | "pos.refund"
  | "pos.void"
  | "pos.override_price"
  | "pos.high_discount"
  | "pos.close_register"
  | "cari.override_limit"
  | "finance.reverse_payment";

export type Branch = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  createdAt: string;
};

export type Register = {
  id: string;
  branchId: string;
  name: string;
  code: string;
  active: boolean;
  createdAt: string;
};

export type Category = {
  id: string;
  name: string;
  hotkey: string;
  createdAt: string;
};

export type Product = {
  id: string;
  branchId?: string;
  categoryId?: string;
  sku: string;
  barcode?: string;
  name: string;
  imageUrl?: string;
  unit: "piece" | "box" | "meter" | "kg";
  quantity: number;
  minStock: number;
  salePrice: number;
  lastCost: number;
  vatRate?: number;
  createdAt: string;
};

export type PriceChange = {
  id: string;
  productId: string;
  oldSalePrice: number;
  newSalePrice: number;
  oldCost: number;
  newCost: number;
  reason?: string;
  changedBy: string;
  createdAt: string;
};

export type StockMovementType = "IN" | "OUT" | "ADJUST";

export type StockMovement = {
  id: string;
  productId: string;
  type: StockMovementType;
  quantity: number;
  unitCost?: number;
  note?: string;
  createdAt: string;
  createdBy: string;
};

export type DashboardKpi = {
  totalProducts: number;
  lowStockProducts: number;
  stockValue: number;
  totalStockUnits: number;
};

export type SaleStatus = "DRAFT" | "COMPLETED" | "VOIDED" | "REFUNDED";

export type SaleLine = {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discountRate: number;
  taxRate: number;
  lineTotal: number;
};

export type InstallmentPlan = {
  count: number;
  intervalDays: number;
};

export type PaymentMethod =
  | "CASH"
  | "CARD"
  | "TRANSFER"
  | "CREDIT"
  | "MIXED";

export type Payment = {
  id: string;
  saleId: string;
  method: PaymentMethod;
  amount: number;
  reference?: string;
  installmentPlan?: InstallmentPlan;
  createdAt: string;
  createdBy: string;
};

export type Sale = {
  id: string;
  branchId: string;
  registerId: string;
  customerId?: string;
  customerName: string;
  status: SaleStatus;
  lines: SaleLine[];
  subTotal: number;
  discountTotal: number;
  manualDiscountTotal?: number;
  taxTotal: number;
  netTotal: number;
  paidTotal: number;
  dueTotal: number;
  changeTotal?: number;
  idempotencyKey?: string;
  holdCode?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

export type SyncEventStatus = "PENDING" | "SYNCED" | "FAILED";

export type SyncEvent = {
  id: string;
  eventType: "SALE_FINALIZE";
  saleId: string;
  payload: string;
  status: SyncEventStatus;
  attempts: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type DeviceJobType = "PRINT_RECEIPT" | "OPEN_CASHDRAWER";
export type DeviceJobStatus = "QUEUED" | "DONE" | "FAILED";

export type DeviceJob = {
  id: string;
  type: DeviceJobType;
  payload: string;
  status: DeviceJobStatus;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type AuditLog = {
  id: string;
  action: string;
  username: string;
  role: UserRole;
  meta: string;
  createdAt: string;
};

export type Customer = {
  id: string;
  code: string;
  name: string;
  phone?: string;
  address?: string;
  creditLimit: number;
  balance: number;
  createdAt: string;
};

export type AccountEntryType = "DEBIT" | "CREDIT";

export type AccountEntry = {
  id: string;
  customerId: string;
  type: AccountEntryType;
  amount: number;
  note: string;
  relatedSaleId?: string;
  createdAt: string;
  createdBy: string;
};

export type CashbookType = "INCOME" | "EXPENSE";

export type CashbookCategory =
  | "SALE"
  | "COLLECTION"
  | "PURCHASE"
  | "RENT"
  | "SALARY"
  | "UTILITY"
  | "OTHER";

export type CashbookEntry = {
  id: string;
  type: CashbookType;
  category: CashbookCategory;
  amount: number;
  note: string;
  relatedSaleId?: string;
  createdAt: string;
  createdBy: string;
};

export type RecipeTemplate = {
  id: string;
  name: string;
  description: string;
  inputMode: "m2" | "m3" | "meter";
  primaryInputLabel?: string;
  showThickness?: boolean;
  defaultWastePercent: number;
  customInputs?: RecipeTemplateInput[];
  items: RecipeItem[];
};

export type RecipeTemplateInput = {
  key: string;
  label: string;
  unit: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  hint?: string;
  example?: string;
  required?: boolean;
};

export type RecipeItem = {
  productId: string;
  productName: string;
  unit: "piece" | "box" | "meter" | "kg";
  quantityFormula: "per_m2" | "per_m3" | "per_meter" | "fixed" | "per_input";
  coefficient: number;
  inputKey?: string;
};

export type EstimateLine = {
  productId: string;
  productName: string;
  unit: "piece" | "box" | "meter" | "kg";
  requiredQuantity: number;
  requiredUnit: "piece" | "box" | "meter" | "kg";
  quantity: number;
  packageSize?: number;
  packageUnit?: "piece" | "box" | "meter" | "kg";
  packageLabel?: string;
  salePrice: number;
  costPrice: number;
  totalSale: number;
  totalCost: number;
};

export type EstimateVersion = {
  version: number;
  changedAt: string;
  changedBy: string;
  note?: string;
};

export type Estimate = {
  id: string;
  templateId: string;
  templateName: string;
  title: string;
  customerName?: string;
  customerPhone?: string;
  areaValue: number;
  thicknessCm?: number;
  wastePercent: number;
  lines: EstimateLine[];
  totalSale: number;
  totalCost: number;
  grossProfit: number;
  grossMarginPercent: number;
  status?: "OPEN" | "WON" | "LOST";
  statusNote?: string;
  createdAt: string;
  createdBy: string;
  versions: EstimateVersion[];
};
