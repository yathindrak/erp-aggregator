import { betterFetch } from "@better-fetch/fetch";
import type { auth } from "@/lib/auth";
import { NextResponse, type NextRequest } from "next/server";

type Session = typeof auth.$Infer.Session;

export async function middleware(request: NextRequest) {
	const { data: session } = await betterFetch<Session>(
		"/api/auth/get-session",
		{
			baseURL: request.nextUrl.origin,
			headers: {
				cookie: request.headers.get("cookie") ?? "",
			},
		},
	);

	if (!session) {
		const loginUrl = new URL("/login", request.url);
		loginUrl.searchParams.set("redirect", request.nextUrl.pathname + request.nextUrl.search);
		return NextResponse.redirect(loginUrl);
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		/*
		 * Protect all routes except:
		 * - /login (auth page, public)
		 * - /api/auth/* (better-auth endpoints)
		 * - /_next/* (Next.js internals)
		 * - /favicon.ico, /public assets
		 */
		"/((?!login|api/auth|_next/static|_next/image|favicon\\.ico).*)",
	],
};
