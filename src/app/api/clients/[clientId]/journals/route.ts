import { NextRequest, NextResponse } from "next/server";

import { connectionManager } from "@/lib/erp/ConnectionManager";
import { withErrorHandler, ApiError } from "@/lib/api-utils";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ clientId: string }> }
) {
    const { clientId } = await params;

    return withErrorHandler(async () => {
        if (!clientId) {
            throw new ApiError("clientId is required", 400);
        }

        const connections = await connectionManager.getAllConnections(clientId);
        if (connections.length === 0) {
            return NextResponse.json(
                { error: "No connection found" },
                { status: 404 }
            );
        }

        const allJournals = await Promise.all(
            connections.map(async (conn) => {
                const adapter = await connectionManager.getAdapter(clientId, conn.erpName);
                if (!adapter.journals) return [];
                return await adapter.journals.fetch();
            })
        );

        return NextResponse.json(allJournals.flat());
    });
}
