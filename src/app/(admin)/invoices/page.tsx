"use client";

import { useEffect, useState, useCallback } from "react";
import { useWorkspace } from "@/providers/workspace-provider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { CanonicalInvoice } from "@/lib/erp/models/canonical";
import { fmtNumber, statusBadgeVariant, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function InvoicesPage() {
	const { clientId } = useWorkspace();
	const [invoices, setInvoices] = useState<CanonicalInvoice[]>([]);
	const [loading, setLoading] = useState(false);
	const [filter, setFilter] = useState<"all" | "UNPAID" | "OVERDUE" | "PAID">("all");

	const load = useCallback(async () => {
		if (!clientId) return;
		setLoading(true);
		try {
			const statusParam = filter !== "all" ? `?status=${filter.toLowerCase()}` : "";
			const res = await fetch(`/api/clients/${clientId}/invoices${statusParam}`);
			const data = await res.json();
			if (res.ok) {
				setInvoices(Array.isArray(data) ? data : []);
			} else {
				setInvoices([]);
			}
		} catch {
			setInvoices([]);
		} finally {
			setLoading(false);
		}
	}, [clientId, filter]);

	useEffect(() => {
		void load();
	}, [load]);

	return (
		<div className="mx-auto max-w-[1400px] space-y-6 p-8">
			<div className="flex items-start justify-between">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">
						Invoices
						{invoices.length > 0 && (
							<span className="ml-3 inline-flex items-center rounded-full border border-border/60 bg-muted px-2.5 py-0.5 align-middle font-semibold text-muted-foreground text-xs">
								{invoices.length} records
							</span>
						)}
					</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						All invoices from connected ERP
					</p>
				</div>
			</div>

			<Tabs onValueChange={(v) => setFilter(v as typeof filter)} value={filter}>
				<TabsList className="h-8">
					<TabsTrigger
						className="px-3 text-xs"
						id="invoices-tab-all"
						value="all"
					>
						All
					</TabsTrigger>
					<TabsTrigger
						className="px-3 text-xs"
						id="invoices-tab-unpaid"
						value="UNPAID"
					>
						Unpaid
					</TabsTrigger>
					<TabsTrigger
						className="px-3 text-xs"
						id="invoices-tab-overdue"
						value="OVERDUE"
					>
						Overdue
					</TabsTrigger>
					<TabsTrigger
						className="px-3 text-xs"
						id="invoices-tab-paid"
						value="PAID"
					>
						Paid
					</TabsTrigger>
				</TabsList>
			</Tabs>

			<Card className="border-border/40">
				<Table>
					<TableHeader>
						<TableRow className="border-border/40 hover:bg-transparent">
							{[
								"Invoice ID",
								"Type",
								"Status",
								"Issue Date",
								"Due Date",
								"Currency",
								"Total",
								"Open",
							].map((h) => (
								<TableHead
									className="font-semibold text-muted-foreground text-xs uppercase tracking-wider"
									key={h}
								>
									{h}
								</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{loading ? (
							Array.from({ length: 8 }).map((_, i) => (
								<TableRow className="border-border/40" key={i}>
									{Array.from({ length: 8 }).map((_, j) => (
										<TableCell key={j}>
											<div className="h-4 animate-pulse rounded bg-muted" />
										</TableCell>
									))}
								</TableRow>
							))
						) : invoices.length === 0 ? (
							<TableRow className="border-border/40">
								<TableCell
									className="py-12 text-center text-muted-foreground text-sm"
									colSpan={8}
								>
									No invoices found.
								</TableCell>
							</TableRow>

						) : (
							invoices.map((inv) => (
								<TableRow
									className="border-border/40 hover:bg-muted/30"
									key={inv.id}
								>
									<TableCell className="font-mono text-muted-foreground text-xs">
										{inv.id}
									</TableCell>
									<TableCell>
										<span
											className={cn(
												"font-semibold text-xs",
												inv.type === "AR" ? "text-blue-400" : "text-violet-400",
											)}
										>
											{inv.type}
										</span>
									</TableCell>
									<TableCell>
										<Badge
											className="text-xs"
											variant={
												statusBadgeVariant(inv.status) as
												| "destructive"
												| "secondary"
												| "default"
												| "outline"
											}
										>
											{inv.status}
										</Badge>
									</TableCell>
									<TableCell className="text-sm">
										{fmtDate(inv.issueDate)}
									</TableCell>
									<TableCell className="text-sm">
										{fmtDate(inv.dueDate)}
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{inv.currency ?? "—"}
									</TableCell>
									<TableCell className="text-right font-semibold text-sm">
										{fmtNumber(inv.totalAmount)}
									</TableCell>
									<TableCell className="text-right text-muted-foreground text-sm">
										{fmtNumber(inv.openAmount)}
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</Card>
		</div>
	);
}
