"use server";

import { z } from "zod";
import { actionClient } from "@/lib/safe-action";
import { connectionManager } from "@/lib/erp/ConnectionManager";
import { db } from "@/server/db";

const clientIdSchema = z.object({
	clientId: z.string().min(1, "clientId is required"),
});

const connectErpSchema = z.object({
	clientId: z.string().min(1, "clientId is required"),
	erpName: z.string().min(1, "erpName is required"),
	credentials: z.record(z.string(), z.unknown()),
});

const deleteConnectionSchema = z.object({
	clientId: z.string().min(1, "clientId is required"),
	erpName: z.string().min(1, "erpName is required"),
});

export const getConnections = actionClient
	.inputSchema(clientIdSchema)
	.action(async ({ parsedInput: { clientId } }) => {
		const connections = await db.connection.findMany({
			where: { clientId },
		});
		return connections.map((c) => ({
			erpName: c.erpName,
			hasToken: !!c.credentials,
			tokenExpiresAt: c.tokenExpiresAt,
		}));
	});

export const connectErp = actionClient
	.inputSchema(connectErpSchema)
	.action(async ({ parsedInput: { clientId, erpName, credentials } }) => {
		await connectionManager.connectErp(clientId, erpName, credentials);
		return { success: true };
	});

export const deleteConnection = actionClient
	.inputSchema(deleteConnectionSchema)
	.action(async ({ parsedInput: { clientId } }) => {
		await connectionManager.deleteConnection(clientId);
		return { success: true };
	});
