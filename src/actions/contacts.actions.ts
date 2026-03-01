"use server";

import { z } from "zod";
import { actionClient } from "@/lib/safe-action";
import { connectionManager } from "@/lib/erp/ConnectionManager";

const getContactsSchema = z.object({
	clientId: z.string().min(1, "clientId is required"),
	erpName: z.string().min(1, "erpName is required"),
});

export const getContacts = actionClient
	.inputSchema(getContactsSchema)
	.action(async ({ parsedInput: { clientId, erpName } }) => {
		const adapter = await connectionManager.getAdapter(clientId, erpName);
		if (!adapter.contacts) {
			throw new Error(`${erpName} does not support contacts`);
		}
		return await adapter.contacts.fetch();
	});
