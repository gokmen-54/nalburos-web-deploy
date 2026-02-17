"use client";

import type { JSX, ReactNode } from "react";
import { useState } from "react";
import type { SessionUser } from "@/lib/types";
import { LogoutButton } from "@/components/logout-button";
import { SidebarNav } from "@/components/sidebar-nav";
import { ToastHost } from "@/components/toast-host";

type Props = {
  user: SessionUser;
  children: ReactNode;
};

export function AppShell({ user, children }: Props): JSX.Element {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className={`shell ${sidebarOpen ? "" : "shell-sidebar-closed"}`}>
      <header className="topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="topbar-menu-btn secondary"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-expanded={sidebarOpen}
            aria-controls="main-sidebar"
          >
            {sidebarOpen ? "Menuyu Kapat" : "Menuyu Ac"}
          </button>
          <div>
            <div className="brand">NalburOS</div>
            <div className="muted">
              {user.name} ({user.role})
            </div>
          </div>
        </div>
        <LogoutButton />
      </header>

      <div className="layout">
        <aside id="main-sidebar" className={`sidebar ${sidebarOpen ? "" : "sidebar-hidden"}`}>
          <SidebarNav />
        </aside>
        <main className="content">
          <div className="content-inner">{children}</div>
        </main>
      </div>
      <ToastHost />
    </div>
  );
}
