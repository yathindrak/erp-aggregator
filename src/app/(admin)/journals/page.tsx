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
import {
	IconChevronDown,
	IconChevronUp,
} from "@tabler/icons-react";
import type { CanonicalJournalEntry } from "@/lib/erp/models/canonical";
import { cn } from "@/lib/utils";
import { fmtNumber } from "@/lib/format";

export default function JournalsPage() {
	const { clientId } = useWorkspace();
	const [journals, setJournals] = useState<CanonicalJournalEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const load = useCallback(async () => {
		if (!clientId) return;
		setLoading(true);
		try {
			const res = await fetch(`/api/clients/${clientId}/journals`);
			const data = await res.json();
			if (res.ok) {
				setJournals(Array.isArray(data) ? data : []);
			} else {
				setJournals([]);
			}
		} catch {
			setJournals([]);
		} finally {
			setLoading(false);
		}
	}, [clientId]);

	useEffect(() => {
		void load();
	}, [load]);

	const toggleExpand = (id: string) => {
		setExpandedId((prev) => (prev === id ? null : id));
	};

	return (
		<div className="mx-auto max-w-[1400px] space-y-6 p-8">
			<div className="flex items-start justify-between">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">
						Journal Entries
						{journals.length > 0 && (
							<span className="ml-3 inline-flex items-center rounded-full border border-border/60 bg-muted px-2.5 py-0.5 align-middle font-semibold text-muted-foreground text-xs">
								{journals.length} entries
							</span>
						)}
					</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Vouchers / ledger entries — click a row to expand lines
					</p>
				</div>
			</div>

			<Card className="overflow-hidden border-border/40">
				<Table>
					<TableHeader>
						<TableRow className="border-border/40 hover:bg-transparent">
							{["Voucher ID", "Date", "Description", "Lines"].map((h) => (
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
									{Array.from({ length: 4 }).map((_, j) => (
										<TableCell key={j}>
											<div className="h-4 animate-pulse rounded bg-muted" />
										</TableCell>
									))}
								</TableRow>
							))
						) : journals.length === 0 ? (
							<TableRow className="border-border/40">
								<TableCell
									className="py-12 text-center text-muted-foreground text-sm"
									colSpan={4}
								>
									No journal entries found.
								</TableCell>
							</TableRow>

						) : (
							journals.map((j) => {
								const isExpanded = expandedId === j.id;
								const lineCount = j.lines?.length ?? 0;
								return (
									<>
										<TableRow
											className="cursor-pointer select-none border-border/40 hover:bg-muted/30"
											key={j.id}
											onClick={() => toggleExpand(j.id)}
										>
											<TableCell className="font-mono text-muted-foreground text-xs">
												{j.id}
											</TableCell>
											<TableCell className="text-sm">{j.date ?? "—"}</TableCell>
											<TableCell className="max-w-[300px] truncate text-sm">
												{j.description ?? "—"}
											</TableCell>
											<TableCell>
												<div className="flex items-center gap-2">
													<Badge className="text-xs" variant="outline">
														{lineCount} line{lineCount !== 1 ? "s" : ""}
													</Badge>
													{isExpanded ? (
														<IconChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
													) : (
														<IconChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
													)}
												</div>
											</TableCell>
										</TableRow>

										{/* Expanded journal lines */}
										{isExpanded && (
											<TableRow
												className="border-border/40 bg-muted/20"
												key={`${j.id}-lines`}
											>
												<TableCell className="px-6 py-3" colSpan={4}>
													<div className="space-y-1">
														{lineCount === 0 ? (
															<p className="text-muted-foreground text-xs">
																No line detail available.
															</p>
														) : (
															j.lines.map((l, idx) => {
																const isDebit = l.amount >= 0;
																const taxAmt = Math.abs(l.taxAmount ?? 0);
																return (
																	<div
																		className="flex items-center gap-6 border-border/30 border-t pt-1.5 text-xs first:border-t-0 first:pt-0"
																		key={idx}
																	>
																		<span className="w-48 truncate font-mono text-muted-foreground">
																			{l.accountId ?? "—"}
																		</span>
																		<span
																			className={cn(
																				"font-semibold",
																				isDebit
																					? "text-blue-400"
																					: "text-violet-400",
																			)}
																		>
																			{isDebit ? "Dr" : "Cr"}
																		</span>
																		<span className="font-medium text-foreground">
																			{fmtNumber(l.amount)}
																		</span>
																		{taxAmt > 0 && (
																			<span className="text-muted-foreground">
																				VAT: {fmtNumber(taxAmt)}
																			</span>
																		)}
																	</div>
																);
															})
														)}
													</div>
												</TableCell>
											</TableRow>
										)}
									</>
								);
							})
						)}
					</TableBody>
				</Table>
			</Card>
		</div>
	);
}
