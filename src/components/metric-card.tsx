import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
    label,
    value,
    sub,
    icon,
    accentClass,
    valueClass,
    loading,
}: {
    label: string;
    value: string;
    sub?: string;
    icon: React.ReactNode;
    accentClass: string;
    valueClass: string;
    loading: boolean;
}) {
    return (
        <Card
            className={cn(
                "relative overflow-hidden border-border/40 bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg",
                accentClass,
            )}
        >
            <CardContent className="p-6">
                <div className="mb-3 flex items-center justify-between">
                    <p className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">
                        {label}
                    </p>
                    {icon}
                </div>
                {loading ? (
                    <div className="h-8 w-32 animate-pulse rounded bg-muted" />
                ) : (
                    <p className={cn("font-bold text-3xl tracking-tight", valueClass)}>
                        {value}
                    </p>
                )}
                {sub && <p className="mt-1.5 text-muted-foreground text-xs">{sub}</p>}
            </CardContent>
        </Card>
    );
}
