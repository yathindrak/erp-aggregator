"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { useWorkspace } from "@/providers/workspace-provider";

export function AdminShell({ children }: { children: ReactNode }) {
  const { bootstrapped } = useWorkspace();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <main
        className={`min-w-0 flex-1 overflow-y-auto transition-opacity duration-300 ${
          !bootstrapped ? "pointer-events-none opacity-40" : "opacity-100"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
