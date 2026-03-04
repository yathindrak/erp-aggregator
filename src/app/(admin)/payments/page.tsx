"use client";

import { useEffect, useState, useCallback } from "react";
import { useWorkspace } from "@/providers/workspace-provider";
import { Card } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { CanonicalPayment } from "@/lib/erp/models/canonical";
import { fmtNumber, fmtDate } from "@/lib/format";

export default function PaymentsPage() {
    const { clientId } = useWorkspace();
    const [payments, setPayments] = useState<CanonicalPayment[]>([]);
    const [loading, setLoading] = useState(false);
    const [isSupported, setIsSupported] = useState(true);

    const load = useCallback(async () => {
        if (!clientId) return;
        setLoading(true);
        setIsSupported(true);
        try {
            const res = await fetch(`/api/clients/${clientId}/payments`);
            const data = await res.json();
            if (res.ok) {
                setPayments(Array.isArray(data) ? data : []);
            } else {
                if (res.status === 501) {
                    setIsSupported(false);
                }
                setPayments([]);
            }
        } catch {
            setPayments([]);
        } finally {
            setLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <div className="mx-auto max-w-[1400px] space-y-6 p-8">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="font-bold text-2xl tracking-tight">
                        Payments
                        {payments.length > 0 && (
                            <span className="ml-3 inline-flex items-center rounded-full border border-border/60 bg-muted px-2.5 py-0.5 align-middle font-semibold text-muted-foreground text-xs">
                                {payments.length} records
                            </span>
                        )}
                    </h1>
                    <p className="mt-1 text-muted-foreground text-sm">
                        Recent payment transactions from connected ERP
                    </p>
                </div>
            </div>

            <Card className="border-border/40">
                <Table>
                    <TableHeader>
                        <TableRow className="border-border/40 hover:bg-transparent">
                            {[
                                "Payment ID",
                                "Date",
                                "Amount",
                                "Currency",
                                "Linked Invoice",
                                "Bank Account ID",
                            ].map((h) => (
                                <TableHead
                                    className="font-semibold text-muted-foreground text-xs uppercase tracking-wider"
                                    key={h}
                                >
                                    {h}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <TableRow className="border-border/40" key={i}>
                                    {Array.from({ length: 6 }).map((_, j) => (
                                        <TableCell key={j}>
                                            <div className="h-4 animate-pulse rounded bg-muted" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : !isSupported ? (
                            <TableRow className="border-border/40">
                                <TableCell
                                    className="py-12 text-center text-muted-foreground text-sm"
                                    colSpan={6}
                                >
                                    Payments tracking is not supported by your currently connected ERP.
                                </TableCell>
                            </TableRow>
                        ) : payments.length === 0 ? (
                            <TableRow className="border-border/40">
                                <TableCell
                                    className="py-12 text-center text-muted-foreground text-sm"
                                    colSpan={6}
                                >
                                    No payments found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            payments.map((p) => (
                                <TableRow
                                    className="border-border/40 hover:bg-muted/30"
                                    key={p.id}
                                >
                                    <TableCell className="font-mono text-muted-foreground text-xs">
                                        {p.id}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {fmtDate(p.date)}
                                    </TableCell>
                                    <TableCell className="font-semibold text-sm">
                                        {fmtNumber(p.amount)}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {p.currency ?? "—"}
                                    </TableCell>
                                    <TableCell className="font-mono text-muted-foreground text-xs">
                                        {p.invoiceId ?? "—"}
                                    </TableCell>
                                    <TableCell className="font-mono text-muted-foreground text-xs">
                                        {p.bankAccountId ?? "—"}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
