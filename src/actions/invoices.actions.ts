"use server";

import { z } from "zod";
import { actionClient } from "@/lib/safe-action";
import { connectionManager } from "@/lib/erp/ConnectionManager";

const getInvoicesSchema = z.object({
	clientId: z.string().min(1, "clientId is required"),
	erpName: z.string().min(1, "erpName is required"),
	status: z.enum(["UNPAID", "OVERDUE"]).optional(),
});

export const getInvoices = actionClient
	.inputSchema(getInvoicesSchema)
	.action(async ({ parsedInput: { clientId, erpName, status } }) => {
		const adapter = await connectionManager.getAdapter(clientId, erpName);
		if (!adapter.invoices) {
			throw new Error(`${erpName} does not support invoices`);
		}
		return await adapter.invoices.fetch(
			status ? { status } : undefined,
		);
	});
