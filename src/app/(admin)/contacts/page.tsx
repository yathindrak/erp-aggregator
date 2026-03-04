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
import type { CanonicalContact } from "@/lib/erp/models/canonical";

function contactTypeBadge(type: string) {
	switch (type) {
		case "CUSTOMER":
			return "default";
		case "SUPPLIER":
			return "secondary";
		default:
			return "outline";
	}
}

export default function ContactsPage() {
	const { clientId } = useWorkspace();
	const [contacts, setContacts] = useState<CanonicalContact[]>([]);
	const [loading, setLoading] = useState(false);

	const load = useCallback(async () => {
		if (!clientId) return;
		setLoading(true);
		try {
			const res = await fetch(`/api/clients/${clientId}/contacts`);
			const data = await res.json();
			if (res.ok) {
				setContacts(Array.isArray(data) ? data : []);
			} else {
				setContacts([]);
			}
		} catch {
			setContacts([]);
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
						Contacts
						{contacts.length > 0 && (
							<span className="ml-3 inline-flex items-center rounded-full border border-border/60 bg-muted px-2.5 py-0.5 align-middle font-semibold text-muted-foreground text-xs">
								{contacts.length} records
							</span>
						)}
					</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Customers and suppliers
					</p>
				</div>
			</div>

			<Card className="border-border/40">
				<Table>
					<TableHeader>
						<TableRow className="border-border/40 hover:bg-transparent">
							{["Name", "Type", "Email", "Phone", "VAT #"].map((h) => (
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
									{Array.from({ length: 5 }).map((_, j) => (
										<TableCell key={j}>
											<div className="h-4 animate-pulse rounded bg-muted" />
										</TableCell>
									))}
								</TableRow>
							))
						) : contacts.length === 0 ? (
							<TableRow className="border-border/40">
								<TableCell
									className="py-12 text-center text-muted-foreground text-sm"
									colSpan={5}
								>
									No contacts found.
								</TableCell>
							</TableRow>
						) : (
							contacts.map((c) => (
								<TableRow
									className="border-border/40 hover:bg-muted/30"
									key={c.id}
								>
									<TableCell className="font-medium text-sm">
										{c.name ?? "—"}
									</TableCell>
									<TableCell>
										<Badge
											className="text-xs"
											variant={
												contactTypeBadge(c.type) as
												| "default"
												| "secondary"
												| "outline"
											}
										>
											{c.type}
										</Badge>
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{c.email ?? "—"}
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{c.phone ?? "—"}
									</TableCell>
									<TableCell className="font-mono text-muted-foreground text-xs">
										{c.vatNumber ?? "—"}
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
