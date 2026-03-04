import { format, parseISO, isValid } from "date-fns";

export function fmtDate(d: string | Date | null | undefined): string {
    if (!d) return "—";
    const date = typeof d === "string" ? parseISO(d) : d;
    if (!isValid(date)) return "—";
    return format(date, "MMM d, yyyy");
}

export function fmtNumber(n: number | null | undefined): string {
    if (n == null || Number.isNaN(n)) return "—";
    return n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export function statusBadgeVariant(status: string) {
    switch (status) {
        case "OVERDUE":
            return "destructive";
        case "UNPAID":
            return "secondary";
        case "PAID":
            return "default";
        default:
            return "outline";
    }
}

