import { NextRequest, NextResponse } from "next/server";
import { refreshAllClientsMetrics } from "@/lib/jobs/refresh-metrics";
import { withErrorHandler } from "@/lib/api-utils";
import { env } from "@/env";

/**
 * Vercel Cron job endpoint to trigger the background refresh job.
 * Vercel triggers cron jobs via GET requests.
 */
export async function GET(req: NextRequest) {
    return withErrorHandler(async () => {
        const authHeader = req.headers.get("Authorization");

        if (env.NODE_ENV === "production" && env.CRON_SECRET) {
            if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        }

        console.log("Triggering metrics refresh job...");
        const report = await refreshAllClientsMetrics();

        return NextResponse.json({
            message: "Refresh job completed",
            report
        });
    });
}
