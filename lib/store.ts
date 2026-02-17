import { promises as fs } from "fs";
import path from "path";
import type {
  AccountEntry,
  AuditLog,
  Branch,
  Category,
  CashbookEntry,
  Customer,
  DeviceJob,
  Payment,
  PasswordResetToken,
  PriceChange,
  Product,
  RecipeTemplate,
  Register,
  Sale,
  Estimate,
  StockMovement,
  SyncEvent,
  UserRecord
} from "@/lib/types";

type StoreMap = {
  users: UserRecord[];
  branches: Branch[];
  registers: Register[];
  categories: Category[];
  products: Product[];
  "stock-movements": StockMovement[];
  sales: Sale[];
  payments: Payment[];
  "sync-events": SyncEvent[];
  "device-jobs": DeviceJob[];
  "audit-logs": AuditLog[];
  "price-history": PriceChange[];
  customers: Customer[];
  "account-entries": AccountEntry[];
  cashbook: CashbookEntry[];
  "recipe-templates": RecipeTemplate[];
  estimates: Estimate[];
  "password-reset-tokens": PasswordResetToken[];
};

const DATA_FILES: Record<keyof StoreMap, string> = {
  users: "users.json",
  branches: "branches.json",
  registers: "registers.json",
  categories: "categories.json",
  products: "products.json",
  "stock-movements": "stock-movements.json",
  sales: "sales.json",
  payments: "payments.json",
  "sync-events": "sync-events.json",
  "device-jobs": "device-jobs.json",
  "audit-logs": "audit-logs.json",
  "price-history": "price-history.json",
  customers: "customers.json",
  "account-entries": "account-entries.json",
  cashbook: "cashbook.json",
  "recipe-templates": "recipe-templates.json",
  estimates: "estimates.json",
  "password-reset-tokens": "password-reset-tokens.json"
};

const DEFAULT_EMPTY_STORE: StoreMap = {
  users: [
    {
      id: "usr_admin",
      username: "admin",
      email: "admin@nalburos.local",
      passwordSalt: "6108e1d15abea5cb79d759a43d90a590",
      passwordHash:
        "d0320c2327de351b0991c617387445b1f3e379839854a812e942bc491ee659896c6dab90da62a36e1e7e234acc422b9417955f3c51630ef84b6a64cb7aaa225f",
      passwordUpdatedAt: "2026-02-16T00:00:00.000Z",
      name: "Nalbur Admin",
      role: "Owner"
    }
  ],
  branches: [],
  registers: [],
  categories: [],
  products: [],
  "stock-movements": [],
  sales: [],
  payments: [],
  "sync-events": [],
  "device-jobs": [],
  "audit-logs": [],
  "price-history": [],
  customers: [],
  "account-entries": [],
  cashbook: [],
  "recipe-templates": [],
  estimates: [],
  "password-reset-tokens": []
};

type StoreRuntime = {
  dataDir: string;
  seedDir: string | null;
};

let runtimePromise: Promise<StoreRuntime> | null = null;

function candidateDataDirs(): string[] {
  const configured = process.env.DATA_DIR?.trim();
  if (configured) {
    return [path.resolve(configured)];
  }
  return [path.resolve(process.cwd(), "data"), path.resolve(process.cwd(), "apps/web/data")];
}

function candidateSeedDirs(): string[] {
  const configured = process.env.DATA_SEED_DIR?.trim();
  const candidates = [path.resolve(process.cwd(), "apps/web/data"), path.resolve(process.cwd(), "data")];
  return configured ? [path.resolve(configured), ...candidates] : candidates;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveWritableDataDir(): Promise<string> {
  const candidates = candidateDataDirs();
  for (const dir of candidates) {
    try {
      await fs.mkdir(dir, { recursive: true });
      const probe = path.join(dir, ".write-probe");
      await fs.writeFile(probe, "ok", "utf8");
      await fs.unlink(probe);
      return dir;
    } catch {
      continue;
    }
  }
  throw new Error("Data klasoru yazilabilir degil. DATA_DIR ortam degiskeni ile yazilabilir bir klasor verin.");
}

async function resolveSeedDir(): Promise<string | null> {
  for (const dir of candidateSeedDirs()) {
    if (await pathExists(path.join(dir, "users.json"))) {
      return dir;
    }
  }
  return null;
}

async function resolveRuntime(): Promise<StoreRuntime> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const dataDir = await resolveWritableDataDir();
      const seedDir = await resolveSeedDir();
      return { dataDir, seedDir };
    })();
  }
  return runtimePromise;
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  const normalized = raw.replace(/^\uFEFF/, "");
  return JSON.parse(normalized) as T;
}

async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function ensureStoreFile<K extends keyof StoreMap>(key: K): Promise<string> {
  const runtime = await resolveRuntime();
  const fileName = DATA_FILES[key];
  const filePath = path.join(runtime.dataDir, fileName);

  if (await pathExists(filePath)) {
    return filePath;
  }

  const seedPath = runtime.seedDir ? path.join(runtime.seedDir, fileName) : "";
  if (seedPath && (await pathExists(seedPath))) {
    const seededData = await readJsonFile<StoreMap[K]>(seedPath);
    await writeJsonFile(filePath, seededData);
    return filePath;
  }

  await writeJsonFile(filePath, DEFAULT_EMPTY_STORE[key] as StoreMap[K]);
  return filePath;
}

export async function readStore<K extends keyof StoreMap>(key: K): Promise<StoreMap[K]> {
  const filePath = await ensureStoreFile(key);
  return readJsonFile<StoreMap[K]>(filePath);
}

export async function writeStore<K extends keyof StoreMap>(key: K, data: StoreMap[K]): Promise<void> {
  const filePath = await ensureStoreFile(key);
  await writeJsonFile(filePath, data);
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`;
}

let lock: Promise<void> = Promise.resolve();

export async function withStoreLock<T>(task: () => Promise<T>): Promise<T> {
  const previous = lock;
  let release: () => void = () => undefined;
  lock = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await task();
  } finally {
    release();
  }
}
