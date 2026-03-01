import { connectionManager } from "./ConnectionManager";

export async function getDashboardData(clientId: string) {
	try {
		const connections =
			await connectionManager.getAllConnections(clientId);
		if (connections.length === 0) {
			console.warn(`No connections found for client ${clientId}`);
			return null;
		}

		const totalMetrics = {
			totalAR: 0,
			totalAP: 0,
			overdueCount: 0,
			overdueTotal: 0,
			cashPosition: 0,
		};

		for (const conn of connections) {
			const adapter = await connectionManager.getAdapter(
				clientId,
				conn.erpName,
			);
			const metrics = adapter.dashboard
				? await adapter.dashboard.getMetrics()
				: null;

			if (metrics) {
				totalMetrics.totalAR += metrics.totalAR;
				totalMetrics.totalAP += metrics.totalAP;
				totalMetrics.overdueCount += metrics.overdueCount;
				totalMetrics.overdueTotal += metrics.overdueTotal;
				totalMetrics.cashPosition += metrics.cashPosition;
			}
		}

		return {
			...totalMetrics,
			lastUpdated: new Date()
		};
	} catch (e) {
		console.error(`Error refreshing dashboard for client ${clientId}`, e);
		return null;
	}
}
