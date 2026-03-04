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
		let supportedFeatures = { ar: true, ap: true };

		try {
			const connections = await connectionManager.getAllConnections(clientId);
			const adapterResults = await Promise.all(
				connections.map(async (conn) => {
					const adapter = await connectionManager.getAdapter(clientId, conn.erpName).catch(() => null);
					if (!adapter) return { adapter: null, invoices: [] };

					let invoices: any[] = [];
					if (adapter.invoicesRecievable || adapter.invoicesPayable) {
						const [ar, ap] = await Promise.all([
							adapter.invoicesRecievable?.fetch() ?? Promise.resolve([]),
							adapter.invoicesPayable?.fetch() ?? Promise.resolve([]),
						]);
						invoices = [...ar, ...ap];
					}
					return { adapter, invoices };
				})
			);

			const validResults = adapterResults.filter((r) => r.adapter !== null);

			recentTransactions = validResults
				.flatMap((r) => r.invoices)
				.sort((a, b) => compareDesc(new Date(a.issueDate), new Date(b.issueDate)))
				.slice(0, 10);

			supportedFeatures = {
				ar: validResults.some((r) => !!r.adapter?.invoicesRecievable),
				ap: validResults.some((r) => !!r.adapter?.invoicesPayable),
			};
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
			supportedFeatures,
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

				const metricsPromise = adapter.dashboard.getMetrics();

				let invoicesPromise;
				if (adapter.invoicesRecievable || adapter.invoicesPayable) {
					invoicesPromise = Promise.all([
						adapter.invoicesRecievable?.fetch() ?? Promise.resolve([]),
						adapter.invoicesPayable?.fetch() ?? Promise.resolve([]),
					]).then(([ar, ap]) => [...ar, ...ap]);
				} else {
					invoicesPromise = Promise.resolve([]);
				}

				const [metrics, invoices] = await Promise.all([metricsPromise, invoicesPromise]);

				return { metrics, invoices, adapter };
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

		const supportedFeatures = {
			ar: results.some(r => !!(r.adapter as any).invoicesRecievable),
			ap: results.some(r => !!(r.adapter as any).invoicesPayable),
		};

		await db.aggregatedMetric.upsert({
			where: { clientId },
			create: {
				clientId,
				...data,
			},
			update: data,
		});

		return { ...data, supportedFeatures };
	} catch (e) {
		console.error(`Error refreshing dashboard for client ${clientId}`, e);
		return null;
	}
}
