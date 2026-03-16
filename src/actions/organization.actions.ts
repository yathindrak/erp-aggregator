"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { authActionClient } from "@/lib/safe-action";
import { headers } from "next/headers";

const createOrganizationSchema = z.object({
	name: z.string().min(1, "Organization name is required").trim(),
});

export const createOrganization = authActionClient
	.inputSchema(createOrganizationSchema)
	.action(async ({ parsedInput: { name } }) => {
		const slug = name
			.toLowerCase()
			.replace(/\s+/g, "-")
			.replace(/[^a-z0-9-]/g, "");

		return await auth.api.createOrganization({
			body: { name, slug },
			headers: await headers(),
		});
	});
