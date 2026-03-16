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

        const allContactsResults = await Promise.all(
            connections.map(async (conn) => {
                try {
                    const adapter = await connectionManager.getAdapter(clientId, conn.erpName);
                    if (!adapter.contacts) return [];
                    const data = await adapter.contacts.fetch();
                    return data.map(c => ({ ...c, id: `${conn.erpName}:${c.id}` }));
                } catch (e) {
                    console.error(`[ContactsAPI] Failed for ${conn.erpName}:`, e);
                    return [];
                }
            })
        );

        return NextResponse.json(allContactsResults.flat());
    });
}
