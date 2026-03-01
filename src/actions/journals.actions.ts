"use server";

import { z } from "zod";
import { actionClient } from "@/lib/safe-action";
import { connectionManager } from "@/lib/erp/ConnectionManager";

const getJournalsSchema = z.object({
	clientId: z.string().min(1, "clientId is required"),
	erpName: z.string().min(1, "erpName is required"),
});

export const getJournals = actionClient
	.inputSchema(getJournalsSchema)
	.action(async ({ parsedInput: { clientId, erpName } }) => {
		const adapter = await connectionManager.getAdapter(clientId, erpName);
		if (!adapter.journals) {
			throw new Error(`${erpName} does not support journal entries`);
		}
		return await adapter.journals.fetch();
	});
