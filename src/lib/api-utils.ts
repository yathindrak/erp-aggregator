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

export class ErpAuthError extends ApiError {
    constructor(message: string = "ERP connection expired. Please reconnect.") {
        super(message, 401, "AUTH_EXPIRED");
        this.name = "ErpAuthError";
    }
}

export class ErpRateLimitError extends ApiError {
    constructor(message: string = "Too many requests to the ERP provider.") {
        super(message, 429, "RATE_LIMITED");
        this.name = "ErpRateLimitError";
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

        return NextResponse.json(
            { error: "Internal Server Error", message: error.message },
            { status: 500 }
        );
    }
}
