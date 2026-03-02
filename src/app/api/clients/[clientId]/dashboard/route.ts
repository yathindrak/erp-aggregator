import { NextRequest, NextResponse } from "next/server";
import { getDashboardData, refreshDashboardData } from "@/lib/erp/dashboard-metrics";
import { withErrorHandler, ApiError } from "@/lib/api-utils";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ clientId: string }> }
) {
    const { clientId } = await params;
    const { searchParams } = new URL(req.url);
    const refresh = searchParams.get("refresh") === "true";

    return withErrorHandler(async () => {
        if (!clientId) {
            throw new ApiError("clientId is required", 400);
        }

        const data = refresh
            ? await refreshDashboardData(clientId)
            : await getDashboardData(clientId);

        if (!data) {
            return NextResponse.json(
                { error: "No connection found or data unavailable" },
                { status: 404 }
            );
        }

        return NextResponse.json(data);
    });
}
