"use server";

import { z } from "zod";
import { db } from "@/server/db";
import { actionClient } from "@/lib/safe-action";

const createClientSchema = z.object({
	name: z.string().min(1, "Client name is required").trim(),
});

export const getClients = actionClient.action(async () => {
	return await db.client.findMany({
		orderBy: { name: "asc" },
	});
});

export const createClient = actionClient
	.inputSchema(createClientSchema)
	.action(async ({ parsedInput: { name } }) => {
		return await db.client.create({
			data: { name },
		});
	});
