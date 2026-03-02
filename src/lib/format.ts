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
