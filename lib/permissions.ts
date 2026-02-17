import type { Permission, UserRole } from "@/lib/types";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  Owner: [
    "pos.sell",
    "pos.refund",
    "pos.void",
    "pos.override_price",
    "pos.high_discount",
    "pos.close_register",
    "cari.override_limit",
    "finance.reverse_payment"
  ],
  Manager: [
    "pos.sell",
    "pos.refund",
    "pos.void",
    "pos.override_price",
    "pos.high_discount",
    "cari.override_limit",
    "finance.reverse_payment"
  ],
  Cashier: ["pos.sell"],
  Warehouse: [],
  FieldSales: ["pos.sell"]
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
