"use server";

import { z } from "zod";
import { actionClient } from "@/lib/safe-action";
import { getDashboardData } from "@/lib/erp/dashboard-metrics";
import { connectionManager } from "@/lib/erp/ConnectionManager";

const clientIdSchema = z.object({
	clientId: z.string().min(1, "clientId is required"),
});

export const getDashboard = actionClient
	.inputSchema(clientIdSchema)
	.action(async ({ parsedInput: { clientId } }) => {
		const connections = await connectionManager.getAllConnections(clientId);
		if (connections.length === 0) {
			return {
				error:
					"No ERP connection found for this client. Please connect an ERP first.",
			};
		}

		const data = await getDashboardData(clientId);
		console.log({ data })
		return data ?? { error: "No dashboard data available" };
	});
