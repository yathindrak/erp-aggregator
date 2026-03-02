"use client";

import { useEffect, useState, useCallback } from "react";
import { useWorkspace } from "@/providers/workspace-provider";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	IconCheck,
	IconExternalLink,
	IconLoader2,
	IconPlugConnected,
	IconPlugOff,
	IconAlertCircle,
	IconClock,
} from "@tabler/icons-react";
import type { ErpMetadata } from "@/lib/erp/adapters/base";
import { cn } from "@/lib/utils";
import { useAction } from "next-safe-action/hooks";
import { getAdapters } from "@/actions/adapters.actions";
import {
	connectErp,
	deleteConnection,
	getConnections,
} from "@/actions/connections.actions";

interface Connection {
	erpName: string;
	hasToken: boolean;
	tokenExpiresAt: string | null;
	reauthRequired: boolean;
}

function AdapterCard({
	adapter,
	connection,
	clientId,
	onSuccess,
	isLocked,
}: {
	adapter: ErpMetadata;
	connection?: Connection;
	clientId: string;
	onSuccess: () => void;
	isLocked: boolean;
}) {
	const isConnected = !!connection?.hasToken;
	const isExpired = connection?.tokenExpiresAt && new Date(connection.tokenExpiresAt) < new Date();
	const isReauthRequired = !!connection?.reauthRequired;

	const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
	const [loading, setLoading] = useState(false);
	const [msg, setMsg] = useState<{
		type: "error" | "success";
		text: string;
	} | null>(null);
	const [disconnecting, setDisconnecting] = useState(false);

	const { executeAsync: executeConnectErp } = useAction(connectErp);
	const { executeAsync: executeDeleteConnection } = useAction(deleteConnection);

	const handleConnect = async () => {
		if (adapter.authConfig?.oauthRoute) {
			window.location.href = `${adapter.authConfig.oauthRoute}?clientId=${clientId}`;
			return;
		}

		setLoading(true);
		setMsg(null);
		try {
			const res = await executeConnectErp({
				clientId,
				erpName: adapter.id,
				credentials: fieldValues,
			});
			if (res?.serverError || res?.validationErrors) {
				setMsg({ type: "error", text: res.serverError || "Connection failed" });
			} else if (res?.data?.success) {
				setMsg({ type: "success", text: `${adapter.name} connected!` });
				onSuccess();
			}
		} catch (e: unknown) {
			setMsg({
				type: "error",
				text: e instanceof Error ? e.message : "Connection failed",
			});
		} finally {
			setLoading(false);
		}
	};

	const handleDisconnect = async () => {
		if (
			!confirm(
				`Disconnect ${adapter.name}? Dashboard data will no longer refresh.`,
			)
		)
			return;
		setDisconnecting(true);
		try {
			const res = await executeDeleteConnection({
				clientId,
				erpName: adapter.id,
			});
			if (res?.data?.success) {
				onSuccess();
			} else {
				setMsg({
					type: "error",
					text: res?.serverError || "Failed to disconnect",
				});
			}
		} finally {
			setDisconnecting(false);
		}
	};

	return (
		<Card
			className={cn(
				"border-border/40 transition-all duration-200",
				isConnected && "border-emerald-500/30",
				isLocked && "opacity-60 grayscale-[0.5] select-none",
			)}
		>
			<CardHeader className="pb-3">
				<div className="flex min-w-0 items-center gap-3">
					<div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-muted/40 text-2xl overflow-hidden">
						{adapter.iconUrl && (
							<img
								alt={`${adapter.name} logo`}
								className="h-full w-full object-contain p-2"
								src={adapter.iconUrl}
							/>
						)}
					</div>
					<div className="min-w-0 flex-1">
						<p className="font-semibold text-sm leading-tight">
							{adapter.name}
						</p>
						<p className="mt-0.5 truncate text-muted-foreground text-xs">
							{adapter.description}
						</p>
					</div>
					<div className="shrink-0">
						{isReauthRequired ? (
							<Badge className="gap-1 border-amber-500/30 bg-amber-500/15 text-amber-400 text-xs hover:bg-amber-500/15">
								<IconAlertCircle className="h-3 w-3" />
								Re-auth required
							</Badge>
						) : isExpired ? (
							<Badge className="gap-1 border-amber-500/30 bg-amber-500/15 text-amber-400 text-xs hover:bg-amber-500/15">
								<IconClock className="h-3 w-3" />
								Token expired
							</Badge>
						) : isConnected ? (
							<Badge className="gap-1 border-emerald-500/30 bg-emerald-500/15 text-emerald-400 text-xs hover:bg-emerald-500/15">
								<IconCheck className="h-3 w-3" />
								Connected
							</Badge>
						) : isLocked ? (
							<Badge className="gap-1 text-xs" variant="outline">
								Locked
							</Badge>
						) : (
							<Badge className="gap-1 text-xs" variant="secondary">
								<IconPlugOff className="h-3 w-3" />
								Not connected
							</Badge>
						)}
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{isConnected ? (
					<div className="space-y-3">
						<div
							className={cn(
								"flex items-center gap-3 rounded-lg border px-3 py-2.5",
								isReauthRequired || isExpired
									? "border-amber-500/20 bg-amber-500/5 text-amber-400"
									: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
							)}
						>
							{isReauthRequired ? (
								<IconAlertCircle className="h-4 w-4 shrink-0" />
							) : isExpired ? (
								<IconClock className="h-4 w-4 shrink-0" />
							) : (
								<IconPlugConnected className="h-4 w-4 shrink-0" />
							)}
							<span className="flex-1 font-medium text-xs">
								{isReauthRequired
									? "Authorization expired"
									: isExpired
										? "Token expired"
										: "ERP data is live"}
							</span>
							<Button
								className="h-7 px-3 text-xs"
								disabled={disconnecting}
								id={`disconnect-${adapter.id}-btn`}
								onClick={handleDisconnect}
								size="sm"
								variant="destructive"
							>
								{disconnecting ? (
									<IconLoader2 className="h-3 w-3 animate-spin" />
								) : (
									"Disconnect"
								)}
							</Button>
						</div>

						{isReauthRequired && (
							<div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
								<p className="text-[11px] leading-normal text-amber-200/80">
									Your connection with {adapter.name} has been interrupted. Please
									re-authorize to restore the sync.
								</p>
								<Button
									className="mt-2.5 h-7 w-full gap-1.5 bg-amber-600 text-[11px] hover:bg-amber-700"
									onClick={handleConnect}
									size="sm"
								>
									Re-authorize {adapter.name}
								</Button>
							</div>
						)}
					</div>
				) : isLocked ? (
					<div className="rounded-lg border border-border/40 bg-muted/10 p-4">
						<p className="text-center text-muted-foreground text-xs">
							Disconnect current ERP to switch to {adapter.name}
						</p>
					</div>
				) : adapter.authConfig?.fields?.length ? (
					<div className="space-y-3 rounded-lg border border-border/40 bg-muted/20 p-4">
						{adapter.authConfig.description && (
							<p className="text-muted-foreground text-xs">
								{adapter.authConfig.description}
							</p>
						)}
						{adapter.authConfig.setupUrl && (
							<a
								className="mt-1 inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors"
								href={adapter.authConfig.setupUrl}
								target="_blank"
								rel="noreferrer"
							>
								Open Installation URL
								<IconExternalLink className="h-3 w-3" />
							</a>
						)}
						{adapter.authConfig.fields.map((field) => (
							<div className="space-y-1.5" key={field.id}>
								<Label
									className="font-medium text-muted-foreground text-xs uppercase tracking-wide"
									htmlFor={`${adapter.id}-${field.id}`}
								>
									{field.label}
								</Label>
								<Input
									autoComplete="off"
									className="h-8 border-border/60 bg-background text-sm"
									id={`${adapter.id}-${field.id}`}
									onChange={(e) =>
										setFieldValues((prev) => ({
											...prev,
											[field.id]: e.target.value,
										}))
									}
									placeholder={field.placeholder ?? ""}
									type={field.type}
									value={fieldValues[field.id] ?? ""}
								/>
								{field.hint && (
									<p className="text-[11px] text-muted-foreground">
										{field.hint}
									</p>
								)}
							</div>
						))}
						<div className="flex items-center gap-3 pt-1">
							<Button
								className="h-8 gap-1.5 text-xs"
								disabled={loading}
								id={`connect-${adapter.id}-btn`}
								onClick={handleConnect}
								size="sm"
							>
								{loading && <IconLoader2 className="h-3 w-3 animate-spin" />}
								Connect {adapter.name}
							</Button>
							{msg && (
								<p
									className={cn(
										"text-xs",
										msg.type === "error"
											? "text-destructive"
											: "text-emerald-400",
									)}
								>
									{msg.type === "error" ? "❌" : "✓"} {msg.text}
								</p>
							)}
						</div>
					</div>
				) : adapter.authConfig?.oauthRoute ? (
					<div className="space-y-3 rounded-lg border border-border/40 bg-muted/20 p-4">
						{adapter.authConfig.description && (
							<p className="text-muted-foreground text-xs">
								{adapter.authConfig.description}
							</p>
						)}
						<div className="flex items-center gap-3 pt-1">
							<Button
								className="h-8 gap-1.5 text-xs"
								onClick={handleConnect}
								size="sm"
							>
								Connect {adapter.name}
							</Button>
						</div>
					</div>
				) : (
					<p className="text-muted-foreground text-xs italic">
						Connection UI coming soon.
					</p>
				)}
			</CardContent>
		</Card>
	);
}

export default function ConnectionsPage() {
	const { clientId, refreshConnections } = useWorkspace();
	const [adapters, setAdapters] = useState<ErpMetadata[]>([]);
	const [connections, setConnections] = useState<Connection[]>([]);
	const [loadingAdapters, setLoadingAdapters] = useState(true);

	const { executeAsync: executeGetAdapters } = useAction(getAdapters);
	const { executeAsync: executeGetConnections } = useAction(getConnections);

	const load = useCallback(async () => {
		if (!clientId) return;
		setLoadingAdapters(true);
		try {
			const [adapterRes, connRes] = await Promise.all([
				executeGetAdapters(),
				executeGetConnections({ clientId }),
			]);
			if (adapterRes?.data) setAdapters(adapterRes.data as ErpMetadata[]);
			if (connRes?.data) setConnections(connRes.data as Connection[]);
		} catch (e) {
			console.error(e);
		} finally {
			setLoadingAdapters(false);
		}
	}, [clientId, executeGetAdapters, executeGetConnections]);

	useEffect(() => {
		void load();
	}, [load]);

	const handleSuccess = async () => {
		await Promise.all([load(), refreshConnections()]);
	};

	return (
		<div className="mx-auto max-w-[1400px] space-y-6 p-8">
			<div>
				<h1 className="font-bold text-2xl tracking-tight">ERP Connections</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Connect your client&apos;s ERP accounts to Taxxa
				</p>
			</div>

			{!clientId ? (
				<div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-400 text-sm">
					Please select a client first.
				</div>
			) : loadingAdapters ? (
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<Card className="border-border/40" key={i}>
							<CardContent className="space-y-3 p-6">
								<div className="flex items-center gap-3">
									<div className="h-11 w-11 animate-pulse rounded-xl bg-muted" />
									<div className="flex-1 space-y-1.5">
										<div className="h-4 w-32 animate-pulse rounded bg-muted" />
										<div className="h-3 w-48 animate-pulse rounded bg-muted" />
									</div>
								</div>
								<div className="h-16 animate-pulse rounded-lg bg-muted" />
							</CardContent>
						</Card>
					))}
				</div>
			) : adapters.length === 0 ? (
				<div className="py-20 text-center text-muted-foreground">
					<p className="text-base">No adapters registered.</p>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
					{adapters.map((adapter) => {
						const conn = connections.find((c) => c.erpName === adapter.id);
						const isConnected = !!conn?.hasToken;
						const isAnyConnected = connections.some((c) => c.hasToken);
						const isLocked = isAnyConnected && !isConnected;

						return (
							<AdapterCard
								adapter={adapter}
								clientId={clientId}
								connection={conn}
								isLocked={isLocked}
								key={adapter.id}
								onSuccess={handleSuccess}
							/>
						);
					})}
				</div>
			)}
		</div>
	);
}
