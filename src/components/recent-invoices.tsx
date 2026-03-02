import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CanonicalInvoice } from "@/lib/erp/models/canonical";
import { fmtNumber, statusBadgeVariant } from "@/lib/format";

export function RecentInvoices({
    invoices,
    invLoading,
    erpName,
    invoiceFilter,
    setInvoiceFilter,
}: {
    invoices: CanonicalInvoice[];
    invLoading: boolean;
    erpName?: string | null;
    invoiceFilter: "all" | "UNPAID" | "OVERDUE";
    setInvoiceFilter: (val: "all" | "UNPAID" | "OVERDUE") => void;
}) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="font-semibold text-base">Recent Invoices</h2>
                <Tabs
                    onValueChange={(v) => setInvoiceFilter(v as typeof invoiceFilter)}
                    value={invoiceFilter}
                >
                    <TabsList className="h-8">
                        <TabsTrigger
                            className="px-3 text-xs"
                            id="inv-tab-all"
                            value="all"
                        >
                            All
                        </TabsTrigger>
                        <TabsTrigger
                            className="px-3 text-xs"
                            id="inv-tab-unpaid"
                            value="UNPAID"
                        >
                            Unpaid
                        </TabsTrigger>
                        <TabsTrigger
                            className="px-3 text-xs"
                            id="inv-tab-overdue"
                            value="OVERDUE"
                        >
                            Overdue
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <Card className="border-border/40">
                <Table>
                    <TableHeader>
                        <TableRow className="border-border/40 hover:bg-transparent">
                            <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                                Invoice ID
                            </TableHead>
                            <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                                Type
                            </TableHead>
                            <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                                Status
                            </TableHead>
                            <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                                Due Date
                            </TableHead>
                            <TableHead className="text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                                Amount
                            </TableHead>
                            <TableHead className="text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                                Open
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow className="border-border/40" key={i}>
                                    {Array.from({ length: 6 }).map((_, j) => (
                                        <TableCell key={j}>
                                            <div className="h-4 animate-pulse rounded bg-muted" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : !erpName ? (
                            <TableRow className="border-border/40">
                                <TableCell
                                    className="py-10 text-center text-muted-foreground text-sm"
                                    colSpan={6}
                                >
                                    Please connect an ERP first.
                                </TableCell>
                            </TableRow>
                        ) : invoices.length === 0 ? (
                            <TableRow className="border-border/40">
                                <TableCell
                                    className="py-10 text-center text-muted-foreground text-sm"
                                    colSpan={6}
                                >
                                    No invoices found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            invoices.map((inv) => (
                                <TableRow
                                    className="border-border/40 hover:bg-muted/30"
                                    key={inv.id}
                                >
                                    <TableCell className="font-mono text-muted-foreground text-xs">
                                        {inv.id}
                                    </TableCell>
                                    <TableCell>
                                        <span
                                            className={cn(
                                                "font-semibold text-xs",
                                                inv.type === "AR"
                                                    ? "text-blue-400"
                                                    : "text-violet-400",
                                            )}
                                        >
                                            {inv.type === "AR" ? "Receivable" : "Payable"}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            className="text-xs"
                                            variant={
                                                statusBadgeVariant(inv.status) as
                                                | "destructive"
                                                | "secondary"
                                                | "default"
                                                | "outline"
                                            }
                                        >
                                            {inv.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {inv.dueDate ?? "—"}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-sm">
                                        {fmtNumber(inv.totalAmount)}
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground text-sm">
                                        {fmtNumber(inv.openAmount)}
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
