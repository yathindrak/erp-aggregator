"use server";

import { z } from "zod";
import { db } from "@/server/db";
import { authActionClient } from "@/lib/safe-action";

const createClientSchema = z.object({
	name: z.string().min(1, "Client name is required").trim(),
});

async function getActiveOrgId(userId: string, activeOrgId?: string | null) {
	if (activeOrgId) {
		const match = await db.member.findFirst({
			where: { userId, organizationId: activeOrgId },
		});
		if (match) return activeOrgId;
	}
	const member = await db.member.findFirst({
		where: { userId },
		orderBy: { createdAt: "asc" },
	});
	return member?.organizationId ?? null;
}

export const getClients = authActionClient.action(async ({ ctx: { session } }) => {
	const orgId = await getActiveOrgId(
		session.user.id,
		session.session.activeOrganizationId,
	);
	if (!orgId) return [];
	return await db.client.findMany({
		where: { organizationId: orgId },
		orderBy: { name: "asc" },
	});
});

export const createClient = authActionClient
	.inputSchema(createClientSchema)
	.action(async ({ parsedInput: { name }, ctx: { session } }) => {
		const orgId = await getActiveOrgId(
			session.user.id,
			session.session.activeOrganizationId,
		);
		if (!orgId) throw new Error("No organization found");
		return await db.client.create({
			data: { name, organizationId: orgId },
		});
	});
