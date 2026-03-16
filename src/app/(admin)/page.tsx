"use client";

import { useEffect, useState, useCallback } from "react";
import { useWorkspace } from "@/providers/workspace-provider";
import {
	IconTrendingUp,
	IconTrendingDown,
	IconAlertTriangle,
	IconBuildingBank,
	IconPlugConnected,
	IconRefresh,
} from "@tabler/icons-react";
import Link from "next/link";
import type { CanonicalInvoice } from "@/lib/erp/models/canonical";
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
	isStale?: boolean;
	error?: string;
	supportedFeatures?: {
		ar: boolean;
		ap: boolean;
	};
}

export default function DashboardPage() {
	const { clientId, erpName, bootstrapped } = useWorkspace();

	const [metrics, setMetrics] = useState<DashboardMetrics>({});
	const [metricsLoading, setMetricsLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [invoices, setInvoices] = useState<CanonicalInvoice[]>([]);
	const [invLoading, setInvLoading] = useState(false);

	// Reset dashboard state immediately when workspace is switching orgs
	useEffect(() => {
		if (!bootstrapped) {
			setMetrics({});
			setInvoices([]);
			setMetricsLoading(true);
			setInvLoading(true);
		}
	}, [bootstrapped]);
	const [invoiceFilter, setInvoiceFilter] = useState<
		"all" | "UNPAID" | "OVERDUE"
	>("all");

	const loadData = useCallback(async (refresh = false) => {
		if (!clientId) return;
		if (refresh) setRefreshing(true);
		setMetricsLoading(true);
		setInvLoading(true);
		try {
			const res = await fetch(`/api/clients/${clientId}/dashboard${refresh ? "?refresh=true" : ""}`);
			const data = await res.json();

			if (res.ok) {
				setMetrics(data);
				if (data.recentTransactions) {
					setInvoices(data.recentTransactions);
				}
			} else {
				setMetrics({ error: data.error || "Failed to load dashboard" });
			}
		} catch (error) {
			setMetrics({ error: "Failed to load metrics" });
		} finally {
			setMetricsLoading(false);
			setInvLoading(false);
			if (refresh) setRefreshing(false);
		}
	}, [clientId]);

	const loadFilteredInvoices = useCallback(async () => {
		if (!clientId || invoiceFilter === "all") {
			if (invoiceFilter === "all") {
				void loadData();
				return;
			}
			return;
		}

		setInvLoading(true);
		try {
			const res = await fetch(`/api/clients/${clientId}/invoices?status=${invoiceFilter.toLowerCase()}`);
			const data = await res.json();
			if (res.ok) {
				setInvoices(data);
			} else {
				setInvoices([]);
			}
		} catch {
			setInvoices([]);
		} finally {
			setInvLoading(false);
		}
	}, [clientId, invoiceFilter, loadData]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	useEffect(() => {
		if (invoiceFilter !== "all") {
			void loadFilteredInvoices();
		}
	}, [loadFilteredInvoices, invoiceFilter]);


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
				<button
					type="button"
					onClick={() => void loadData(true)}
					disabled={refreshing || metricsLoading}
					className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10 disabled:opacity-50 transition-colors"
				>
					<IconRefresh className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
					{refreshing ? "Refreshing..." : "Refresh"}
				</button>
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

			{/* Stale data warning */}
			{metrics.isStale && (
				<div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-yellow-500 text-sm">
					<IconAlertTriangle className="h-4 w-4 shrink-0" />
					<span>
						Dashboard is showing cached data from earlier.
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
					unavailable={metrics.supportedFeatures && !metrics.supportedFeatures.ar}
				/>
				<MetricCard
					accentClass="before:absolute before:inset-0 before:bg-linear-to-br before:from-violet-500/5 before:to-transparent before:pointer-events-none"
					icon={<IconTrendingDown className="h-5 w-5 text-violet-400" />}
					label="Accounts Payable"
					loading={metricsLoading}
					sub="To be paid"
					value={fmtNumber(metrics.totalAP)}
					valueClass="text-violet-400"
					unavailable={metrics.supportedFeatures && !metrics.supportedFeatures.ap}
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
