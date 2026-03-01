"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import {
	IconLayoutDashboard,
	IconFileInvoice,
	IconUsers,
	IconBook2,
	IconNotes,
	IconPlugConnected,
	IconBolt,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const Logo = () => (
	<Link className="group flex items-center gap-2.5 py-1" href="/">
		<div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 shadow-blue-500/25 shadow-lg transition-shadow group-hover:shadow-blue-500/40">
			<IconBolt className="h-4 w-4 text-white" stroke={2.5} />
		</div>
		<div className="flex flex-col">
			<span className="font-bold text-base text-foreground leading-tight tracking-tight">
				Taxxa
			</span>
			<span className="font-medium text-[10px] text-muted-foreground uppercase leading-tight tracking-widest">
				ERP Workspace
			</span>
		</div>
	</Link>
);

export function AppSidebar() {
	const pathname = usePathname();

	const navLinks = [
		{
			label: "Dashboard",
			href: "/",
			icon: (
				<IconLayoutDashboard
					className={cn(
						"h-5 w-5 shrink-0 transition-colors",
						pathname === "/" ? "text-blue-400" : "text-muted-foreground",
					)}
				/>
			),
		},
		{
			label: "Invoices",
			href: "/invoices",
			icon: (
				<IconFileInvoice
					className={cn(
						"h-5 w-5 shrink-0 transition-colors",
						pathname === "/invoices"
							? "text-blue-400"
							: "text-muted-foreground",
					)}
				/>
			),
		},
		{
			label: "Contacts",
			href: "/contacts",
			icon: (
				<IconUsers
					className={cn(
						"h-5 w-5 shrink-0 transition-colors",
						pathname === "/contacts"
							? "text-blue-400"
							: "text-muted-foreground",
					)}
				/>
			),
		},
		{
			label: "Accounts",
			href: "/accounts",
			icon: (
				<IconBook2
					className={cn(
						"h-5 w-5 shrink-0 transition-colors",
						pathname === "/accounts"
							? "text-blue-400"
							: "text-muted-foreground",
					)}
				/>
			),
		},
		{
			label: "Journals",
			href: "/journals",
			icon: (
				<IconNotes
					className={cn(
						"h-5 w-5 shrink-0 transition-colors",
						pathname === "/journals"
							? "text-blue-400"
							: "text-muted-foreground",
					)}
				/>
			),
		},
		{
			label: "Connections",
			href: "/connections",
			icon: (
				<IconPlugConnected
					className={cn(
						"h-5 w-5 shrink-0 transition-colors",
						pathname === "/connections"
							? "text-blue-400"
							: "text-muted-foreground",
					)}
				/>
			),
		},
	];

	return (
		<Sidebar animate={false} open={true}>
			<SidebarBody className="flex flex-col">
				<div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
					<Logo />

					<div className="mt-6 flex flex-col gap-0.5">
						<p className="mb-2 px-2 font-semibold text-[10px] text-muted-foreground uppercase tracking-widest">
							Workspace
						</p>
						{navLinks.slice(0, 5).map((link) => (
							<SidebarLink
								className={cn(
									"rounded-lg transition-colors",
									pathname === link.href
										? "bg-blue-500/10 text-blue-400"
										: "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
								)}
								key={link.href}
								link={link}
							/>
						))}

						<p className="mt-4 mb-2 px-2 font-semibold text-[10px] text-muted-foreground uppercase tracking-widest">
							Settings
						</p>
						{navLinks.slice(5).map((link) => (
							<SidebarLink
								className={cn(
									"rounded-lg transition-colors",
									pathname === link.href
										? "bg-blue-500/10 text-blue-400"
										: "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
								)}
								key={link.href}
								link={link}
							/>
						))}
					</div>
				</div>
			</SidebarBody>
		</Sidebar>
	);
}
