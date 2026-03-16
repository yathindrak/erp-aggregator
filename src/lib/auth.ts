import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { env } from "@/env";
import { db } from "@/server/db";

export const auth = betterAuth({
	baseURL: env.APP_URL,
	database: prismaAdapter(db, {
		provider: "postgresql",
	}),
	socialProviders: {
		google: {
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET,
		},
	},
	plugins: [organization()],
});
