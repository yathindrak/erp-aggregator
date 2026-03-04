import { NextRequest, NextResponse } from "next/server";
import { connectionManager } from "@/lib/erp/ConnectionManager";
import { withErrorHandler, ApiError } from "@/lib/api-utils";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ clientId: string }> }
) {
    const { clientId } = await params;
    const url = new URL(req.url);
    const statusStr = url.searchParams.get("status")?.toUpperCase();

    let status: "UNPAID" | "OVERDUE" | "PAID" | undefined = undefined;
    if (statusStr === "UNPAID" || statusStr === "OVERDUE" || statusStr === "PAID") {
        status = statusStr;
    }

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
        const allInvoices = await Promise.all(
            connections.map(async (conn) => {
                const adapter = await connectionManager.getAdapter(clientId, conn.erpName);
                const [rec, pay] = await Promise.all([
                    adapter.invoicesRecievable?.fetch(status ? { status } : undefined) ?? Promise.resolve([]),
                    adapter.invoicesPayable?.fetch(status ? { status } : undefined) ?? Promise.resolve([]),
                ]);
                return [...rec, ...pay];
            })
        );

        // Flatten the results
        const flatInvoices = allInvoices.flat();

        return NextResponse.json(flatInvoices);
    });
}
