"use client";

import { useEffect, useState, useCallback } from "react";
import { useWorkspace } from "@/providers/workspace-provider";
import {
	IconTrendingUp,
	IconTrendingDown,
	IconAlertTriangle,
	IconBuildingBank,
	IconPlugConnected,
} from "@tabler/icons-react";
import Link from "next/link";
import type { CanonicalInvoice } from "@/lib/erp/models/canonical";
import { useAction } from "next-safe-action/hooks";
import { getDashboard } from "@/actions/dashboard.actions";
import { getInvoices } from "@/actions/invoices.actions";
import { formatDistanceToNow } from "date-fns";
import { MetricCard } from "../../components/metric-card";
import { RecentInvoices } from "../../components/recent-invoices";
import { fmtNumber } from "@/lib/format";

interface DashboardMetrics {
	totalAR?: number;
	totalAP?: number;
	overdueCount?: number;
	overdueTotal?: number;
	cashPosition?: number;
	lastUpdated?: string;
	error?: string;
}

export default function DashboardPage() {
	const { clientId, erpName } = useWorkspace();

	const [metrics, setMetrics] = useState<DashboardMetrics>({});
	const [metricsLoading, setMetricsLoading] = useState(false);
	const [invoices, setInvoices] = useState<CanonicalInvoice[]>([]);
	const [invLoading, setInvLoading] = useState(false);
	const [invoiceFilter, setInvoiceFilter] = useState<
		"all" | "UNPAID" | "OVERDUE"
	>("all");
	const { executeAsync: executeGetDashboard } = useAction(getDashboard);
	const { executeAsync: executeGetInvoices } = useAction(getInvoices);

	const loadMetrics = useCallback(async () => {
		if (!clientId) return;
		setMetricsLoading(true);
		try {
			const res = await executeGetDashboard({ clientId });
			if (res?.data) {
				setMetrics(res.data as DashboardMetrics);
			} else {
				setMetrics({ error: res?.serverError || "Failed to load metrics" });
			}
		} catch {
			setMetrics({ error: "Failed to load metrics" });
		} finally {
			setMetricsLoading(false);
		}
	}, [clientId, executeGetDashboard]);

	const loadInvoices = useCallback(async () => {
		if (!clientId || !erpName) return;
		setInvLoading(true);
		try {
			const res = await executeGetInvoices({
				clientId,
				erpName,
				status:
					invoiceFilter !== "all"
						? (invoiceFilter as "UNPAID" | "OVERDUE")
						: undefined,
			});
			if (res?.data) {
				const data = res.data;
				setInvoices(Array.isArray(data) ? data.slice(0, 20) : []);
			} else {
				setInvoices([]);
			}
		} catch {
			setInvoices([]);
		} finally {
			setInvLoading(false);
		}
	}, [clientId, erpName, invoiceFilter, executeGetInvoices]);

	useEffect(() => {
		void loadMetrics();
	}, [loadMetrics]);

	useEffect(() => {
		void loadInvoices();
	}, [loadInvoices]);

	return (
		<div className="mx-auto max-w-[1400px] space-y-8 p-8">
			{/* Header */}
			<div className="flex items-start justify-between">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">
						Financial Overview
					</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Live data from connected ERP systems
					</p>
				</div>
			</div>

			{/* No connection warning */}
			{metrics.error?.includes("No ERP connection") && (
				<div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-blue-400 text-sm">
					<IconPlugConnected className="h-4 w-4 shrink-0" />
					<span>
						No ERP connected for this client. Go to{" "}
						<Link
							className="font-semibold underline underline-offset-2"
							href="/connections"
						>
							Connections
						</Link>{" "}
						to link an ERP account.
					</span>
				</div>
			)}

			{/* Metric cards */}
			<div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
				<MetricCard
					accentClass="before:absolute before:inset-0 before:bg-linear-to-br before:from-blue-500/5 before:to-transparent before:pointer-events-none"
					icon={<IconTrendingUp className="h-5 w-5 text-blue-400" />}
					label="Accounts Receivable"
					loading={metricsLoading}
					sub="Outstanding"
					value={fmtNumber(metrics.totalAR)}
					valueClass="text-blue-400"
				/>
				<MetricCard
					accentClass="before:absolute before:inset-0 before:bg-linear-to-br before:from-violet-500/5 before:to-transparent before:pointer-events-none"
					icon={<IconTrendingDown className="h-5 w-5 text-violet-400" />}
					label="Accounts Payable"
					loading={metricsLoading}
					sub="To be paid"
					value={fmtNumber(metrics.totalAP)}
					valueClass="text-violet-400"
				/>
				<MetricCard
					accentClass="before:absolute before:inset-0 before:bg-linear-to-br before:from-red-500/5 before:to-transparent before:pointer-events-none"
					icon={<IconAlertTriangle className="h-5 w-5 text-red-400" />}
					label="Overdue"
					loading={metricsLoading}
					sub={`${metrics.overdueCount ?? 0} overdue invoices`}
					value={fmtNumber(metrics.overdueTotal)}
					valueClass="text-red-400"
				/>
				<MetricCard
					accentClass="before:absolute before:inset-0 before:bg-linear-to-br before:from-emerald-500/5 before:to-transparent before:pointer-events-none"
					icon={<IconBuildingBank className="h-5 w-5 text-emerald-400" />}
					label="Cash Position"
					loading={metricsLoading}
					sub="Bank balance"
					value={fmtNumber(metrics.cashPosition)}
					valueClass="text-emerald-400"
				/>
			</div>

			{metrics.lastUpdated && (
				<p className="-mt-4 text-muted-foreground text-xs">
					Last updated: {formatDistanceToNow(new Date(metrics.lastUpdated), { addSuffix: true })}
				</p>
			)}

			{/* Recent Invoices */}
			<RecentInvoices
				erpName={erpName}
				invLoading={invLoading}
				invoiceFilter={invoiceFilter}
				invoices={invoices}
				setInvoiceFilter={setInvoiceFilter}
			/>
		</div>
	);
}
