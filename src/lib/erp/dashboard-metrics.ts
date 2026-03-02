import { differenceInMinutes, compareDesc } from "date-fns";
import { connectionManager } from "./ConnectionManager";
import { db } from "@/server/db";

export async function getDashboardData(clientId: string) {
	try {
		const cached = await db.aggregatedMetric.findUnique({
			where: { clientId },
		});

		if (!cached) {
			// If no cache exists, trigger a refresh and return the fresh data
			return await refreshDashboardData(clientId);
		}

		// If data is more than 15 minutes old, consider it stale
		const isStale = differenceInMinutes(new Date(), new Date(cached.lastUpdated)) >= 15;

		// Fetch fresh invoices separately to respect "no raw data in DB"
		let recentTransactions: any[] = [];
		try {
			const connections = await connectionManager.getAllConnections(clientId);
			const invoiceResults = await Promise.all(
				connections.map(async (conn) => {
					const adapter = await connectionManager.getAdapter(clientId, conn.erpName);
					return adapter.invoices ? adapter.invoices.fetch() : [];
				})
			);
			recentTransactions = invoiceResults.flat();
			recentTransactions = recentTransactions
				.sort((a, b) => compareDesc(new Date(a.issueDate), new Date(b.issueDate)))
				.slice(0, 10);
		} catch (error) {
			console.warn(`Could not fetch fresh invoices for client ${clientId}, serving metrics only`, error);
		}

		return {
			totalAR: cached.totalAR,
			totalAP: cached.totalAP,
			overdueCount: cached.overdueCount,
			overdueTotal: cached.overdueTotal,
			cashPosition: cached.cashPosition,
			lastActivityDate: cached.lastActivityDate,
			lastUpdated: cached.lastUpdated,
			isStale,
			recentTransactions,
		};
	} catch (e) {
		console.error(`Error fetching dashboard for client ${clientId}`, e);
		return null;
	}
}

export async function refreshDashboardData(clientId: string) {
	try {
		const connections = await connectionManager.getAllConnections(clientId);
		if (connections.length === 0) {
			console.warn(`No connections found for client ${clientId}`);
			return null;
		}

		let totalAR = 0;
		let totalAP = 0;
		let overdueCount = 0;
		let overdueTotal = 0;
		let cashPosition = 0;
		let lastActivityDate: Date | null = null;

		const results = await Promise.all(
			connections.map(async (conn) => {
				const adapter = await connectionManager.getAdapter(
					clientId,
					conn.erpName,
				);

				const [metrics, invoices] = await Promise.all([
					adapter.dashboard ? adapter.dashboard.getMetrics() : null,
					adapter.invoices ? adapter.invoices.fetch() : [],
				]);

				return { metrics, invoices };
			})
		);

		for (const { metrics, invoices } of results) {
			if (metrics) {
				totalAR += metrics.totalAR;
				totalAP += metrics.totalAP;
				overdueCount += metrics.overdueCount;
				overdueTotal += metrics.overdueTotal;
				cashPosition += metrics.cashPosition;
			}
			if (invoices && invoices.length > 0) {
				// Update lastActivityDate based on most recent invoice
				const latestInvoiceDate = new Date(
					Math.max(...invoices.map((inv: any) => new Date(inv.issueDate).getTime()))
				);
				if (!lastActivityDate || compareDesc(lastActivityDate, latestInvoiceDate) === -1) {
					lastActivityDate = latestInvoiceDate;
				}
			}
		}

		const data = {
			totalAR,
			totalAP,
			overdueCount,
			overdueTotal,
			cashPosition,
			lastActivityDate,
			lastUpdated: new Date(),
		};

		await db.aggregatedMetric.upsert({
			where: { clientId },
			create: {
				clientId,
				...data,
			},
			update: data,
		});

		return data;
	} catch (e) {
		console.error(`Error refreshing dashboard for client ${clientId}`, e);
		return null;
	}
}

