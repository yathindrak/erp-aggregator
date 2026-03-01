"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { WorkspaceProvider } from "@/providers/workspace-provider";
import type { ReactNode } from "react";

export default function AdminLayout({
	children,
}: {
	children: ReactNode;
}) {
	return (
		<WorkspaceProvider>
			<div className="flex h-screen overflow-hidden bg-background">
				<AppSidebar />
				<main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
			</div>
		</WorkspaceProvider>
	);
}
