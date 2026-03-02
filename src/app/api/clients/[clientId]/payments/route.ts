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

        // Fetch from all connections in parallel
        const allPayments = await Promise.all(
            connections.map(async (conn) => {
                const adapter = await connectionManager.getAdapter(clientId, conn.erpName);
                if (!adapter.payments) return null;
                return await adapter.payments.fetch();
            })
        );

        const supportedPayments = allPayments.filter((p) => p !== null);

        if (connections.length > 0 && supportedPayments.length === 0) {
            return NextResponse.json(
                { error: "Payments tracking is not supported by your connected ERPs" },
                { status: 501 }
            );
        }

        const flatPayments = supportedPayments.flat();

        return NextResponse.json(flatPayments);
    });
}
