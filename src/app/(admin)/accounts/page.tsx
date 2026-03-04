"use client";

import { useEffect, useState, useCallback } from "react";
import { useWorkspace } from "@/providers/workspace-provider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { CanonicalAccount } from "@/lib/erp/models/canonical";

export default function AccountsPage() {
	const { clientId } = useWorkspace();
	const [accounts, setAccounts] = useState<CanonicalAccount[]>([]);
	const [loading, setLoading] = useState(false);

	const load = useCallback(async () => {
		if (!clientId) return;
		setLoading(true);
		try {
			const res = await fetch(`/api/clients/${clientId}/accounts`);
			const data = await res.json();
			if (res.ok) {
				setAccounts(Array.isArray(data) ? data : []);
			} else {
				setAccounts([]);
			}
		} catch {
			setAccounts([]);
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
						Chart of Accounts
						{accounts.length > 0 && (
							<span className="ml-3 inline-flex items-center rounded-full border border-border/60 bg-muted px-2.5 py-0.5 align-middle font-semibold text-muted-foreground text-xs">
								{accounts.length} accounts
							</span>
						)}
					</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Account codes from connected ERP
					</p>
				</div>
			</div>

			<Card className="border-border/40">
				<Table>
					<TableHeader>
						<TableRow className="border-border/40 hover:bg-transparent">
							{["Code", "Name", "Type", "Status"].map((h) => (
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
							Array.from({ length: 10 }).map((_, i) => (
								<TableRow className="border-border/40" key={i}>
									{Array.from({ length: 4 }).map((_, j) => (
										<TableCell key={j}>
											<div className="h-4 animate-pulse rounded bg-muted" />
										</TableCell>
									))}
								</TableRow>
							))
						) : accounts.length === 0 ? (
							<TableRow className="border-border/40">
								<TableCell
									className="py-12 text-center text-muted-foreground text-sm"
									colSpan={4}
								>
									No accounts found.
								</TableCell>
							</TableRow>
						) : (
							accounts.map((a) => (
								<TableRow
									className="border-border/40 hover:bg-muted/30"
									key={a.id}
								>
									<TableCell className="font-mono font-semibold text-sm">
										{a.code}
									</TableCell>
									<TableCell className="font-medium text-sm">
										{a.name}
									</TableCell>
									<TableCell>
										<Badge className="font-mono text-xs" variant="outline">
											{a.type}
										</Badge>
									</TableCell>
									<TableCell>
										{a.isActive ? (
											<Badge
												className="border-emerald-500/30 bg-emerald-500/20 text-emerald-400 text-xs hover:bg-emerald-500/20"
												variant="default"
											>
												Active
											</Badge>
										) : (
											<Badge className="text-xs" variant="secondary">
												Inactive
											</Badge>
										)}
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
