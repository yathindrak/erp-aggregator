import { NextResponse } from "next/server";

export class ApiError extends Error {
    constructor(
        public message: string,
        public status: number = 400,
        public code?: string
    ) {
        super(message);
        this.name = "ApiError";
    }
}

export async function withErrorHandler(handler: () => Promise<Response>) {
    try {
        return await handler();
    } catch (error: any) {
        console.error("[API Error]", error);

        if (error instanceof ApiError) {
            return NextResponse.json(
                { error: error.message, code: error.code },
                { status: error.status }
            );
        }

        // Handle specific ERP errors if possible
        if (error.message?.includes("token refresh failed")) {
            return NextResponse.json(
                { error: "ERP connection expired. Please reconnect.", code: "AUTH_EXPIRED" },
                { status: 401 }
            );
        }

        if (error.message?.includes("rate limit")) {
            return NextResponse.json(
                { error: "Too many requests to the ERP provider.", code: "RATE_LIMITED" },
                { status: 429 }
            );
        }

        return NextResponse.json(
            { error: "Internal Server Error", message: error.message },
            { status: 500 }
        );
    }
}
