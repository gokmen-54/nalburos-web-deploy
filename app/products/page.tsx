import { redirect } from "next/navigation";
import type { JSX } from "react";
import { getSessionUser } from "@/lib/auth";
import { readStore } from "@/lib/store";
import { ProductForm } from "@/components/product-form";
import { ProductManager } from "@/components/product-manager";

function money(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2
  }).format(value);
}

export default async function ProductsPage(): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const [products, categories] = await Promise.all([readStore("products"), readStore("categories")]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2>Urunler</h2>
      <ProductForm categories={categories} />
      <ProductManager products={products} />
      <div className="card">
        <h3>Urun Listesi</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Ad</th>
                <th>Birim</th>
                <th>Stok</th>
                <th>Min Stok</th>
                <th>Satis</th>
                <th>Son Maliyet</th>
              </tr>
            </thead>
            <tbody>
              {products.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.sku}</td>
                  <td>{entry.name}</td>
                  <td>{entry.unit}</td>
                  <td>{entry.quantity}</td>
                  <td>{entry.minStock}</td>
                  <td>{money(entry.salePrice)}</td>
                  <td>{money(entry.lastCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
