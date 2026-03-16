import { NextRequest, NextResponse } from "next/server";

import { connectionManager } from "@/lib/erp/ConnectionManager";
import { withClientAuth } from "@/lib/api-utils";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ clientId: string }> }
) {
    const { clientId } = await params;

    return withClientAuth(req, clientId, async () => {
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
