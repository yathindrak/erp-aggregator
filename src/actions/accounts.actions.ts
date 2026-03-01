"use server";

import { z } from "zod";
import { actionClient } from "@/lib/safe-action";
import { connectionManager } from "@/lib/erp/ConnectionManager";

const getAccountsSchema = z.object({
	clientId: z.string().min(1, "clientId is required"),
	erpName: z.string().min(1, "erpName is required"),
});

export const getAccounts = actionClient
	.inputSchema(getAccountsSchema)
	.action(async ({ parsedInput: { clientId, erpName } }) => {
		const adapter = await connectionManager.getAdapter(clientId, erpName);
		if (!adapter.accounts) {
			throw new Error(`${erpName} does not support chart of accounts`);
		}
		return await adapter.accounts.fetch();
	});
