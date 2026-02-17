"use client";

import type { JSX } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS: Array<{ title: string; links: Array<{ href: string; label: string }> }> = [
  {
    title: "OPERASYON",
    links: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/pos", label: "POS Terminal" },
      { href: "/pos-history", label: "POS Gecmisi" },
      { href: "/products", label: "Urunler" },
      { href: "/stock", label: "Stok Hareketleri" }
    ]
  },
  {
    title: "FINANS",
    links: [
      { href: "/customers", label: "Cari Hesap" },
      { href: "/ledger-history", label: "Cari Gecmisi" },
      { href: "/cashbook", label: "Gelir Gider" },
      { href: "/control", label: "Kontrol Merkezi" }
    ]
  },
  {
    title: "ANALIZ",
    links: [
      { href: "/pricing", label: "Fiyat KDV" },
      { href: "/reports", label: "Raporlar" },
      { href: "/estimator", label: "Metraj Hesap" }
    ]
  }
];

export function SidebarNav(): JSX.Element {
  const pathname = usePathname();
  return (
    <nav>
      {GROUPS.map((group) => (
        <div key={group.title}>
          <div className="nav-group">{group.title}</div>
          {group.links.map((link) => (
            <Link key={link.href} href={link.href} className={pathname.startsWith(link.href) ? "nav-active" : ""}>
              {link.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
