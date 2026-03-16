import { createSafeActionClient } from "next-safe-action";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const actionClient = createSafeActionClient();

/**
 * Authenticated action client — injects the current session into the context.
 * Use this for all server actions that require a logged-in user.
 */
export const authActionClient = createSafeActionClient().use(async ({ next }) => {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		throw new Error("Unauthorized");
	}

	return next({ ctx: { session } });
});
