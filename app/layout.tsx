import type { Metadata } from "next";
import type { JSX } from "react";
import { getSessionUser } from "@/lib/auth";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "NalburOS",
  description: "Modern nalbur operasyon paneli"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>): Promise<JSX.Element> {
  const user = await getSessionUser();

  return (
    <html lang="tr">
      <body>
        {!user ? (
          children
        ) : (
          <AppShell user={user}>{children}</AppShell>
        )}
      </body>
    </html>
  );
}
