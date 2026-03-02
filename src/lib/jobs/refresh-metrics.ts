import { db } from "@/server/db";
import { refreshDashboardData } from "@/lib/erp/dashboard-metrics";

/**
 * Background job to refresh dashboard metrics for all clients.
 */
export async function refreshAllClientsMetrics() {
    console.log("Starting background job: Refreshing all clients metrics...");

    try {
        const clients = await db.client.findMany({
            select: { id: true, name: true }
        });

        console.log(`Found ${clients.length} clients to refresh.`);

        const results = await Promise.allSettled(
            clients.map(async (client) => {
                console.log(`Refreshing metrics for client: ${client.name} (${client.id})`);
                return await refreshDashboardData(client.id);
            })
        );

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`Background job completed. Successful: ${successful}, Failed: ${failed}`);

        return {
            total: clients.length,
            successful,
            failed,
        };
    } catch (error) {
        console.error("Error in refreshAllClientsMetrics background job:", error);
        throw error;
    }
}
