"use client";

import { useEffect, useState, useCallback } from "react";
import { useAction } from "next-safe-action/hooks";
import {
	getMembers,
	updateMemberRole,
	removeMember,
	inviteMember,
	getPendingInvitations,
	revokeInvitation,
} from "@/actions/members.actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	IconLoader2,
	IconTrash,
	IconUsers,
	IconUserPlus,
	IconCopy,
	IconCheck,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

type Role = "owner" | "admin" | "member";

interface Member {
	id: string;
	role: string;
	createdAt: Date;
	user: { id: string; name: string; email: string; image: string | null };
}

interface Invitation {
	id: string;
	email: string;
	role: string | null;
	expiresAt: Date;
}

const ROLE_BADGE: Record<Role, string> = {
	owner: "border-blue-500/30 bg-blue-500/15 text-blue-400",
	admin: "border-violet-500/30 bg-violet-500/15 text-violet-400",
	member: "border-border bg-muted/30 text-muted-foreground",
};

function canManage(actorRole: Role, targetRole: Role, targetId: string, currentUserId: string) {
	if (actorRole === "member") return false;
	if (targetId === currentUserId) return false;
	if (targetRole === "owner") return false;
	if (actorRole === "admin" && targetRole === "admin") return false;
	return true;
}

function roleOptions(actorRole: Role): Role[] {
	if (actorRole === "owner") return ["owner", "admin", "member"];
	return ["admin", "member"];
}

function CopyLinkButton({ invitationId }: { invitationId: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = () => {
		const url = `${window.location.origin}/accept-invitation?token=${invitationId}`;
		void navigator.clipboard.writeText(url);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<Button
			size="sm"
			variant="outline"
			className="h-7 gap-1.5 border-border/60 text-xs"
			onClick={handleCopy}
		>
			{copied ? (
				<><IconCheck className="h-3 w-3 text-emerald-400" /> Copied</>
			) : (
				<><IconCopy className="h-3 w-3" /> Copy link</>
			)}
		</Button>
	);
}

export default function MembersPage() {
	const [members, setMembers] = useState<Member[]>([]);
	const [invitations, setInvitations] = useState<Invitation[]>([]);
	const [currentUserRole, setCurrentUserRole] = useState<Role>("member");
	const [currentUserId, setCurrentUserId] = useState("");
	const [loading, setLoading] = useState(true);
	const [pendingId, setPendingId] = useState<string | null>(null);

	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
	const [inviting, setInviting] = useState(false);
	const [inviteError, setInviteError] = useState<string | null>(null);
	const [inviteSuccess, setInviteSuccess] = useState(false);

	const { executeAsync: executeGetMembers } = useAction(getMembers);
	const { executeAsync: executeGetInvitations } = useAction(getPendingInvitations);
	const { executeAsync: executeUpdateRole } = useAction(updateMemberRole);
	const { executeAsync: executeRemove } = useAction(removeMember);
	const { executeAsync: executeInvite } = useAction(inviteMember);
	const { executeAsync: executeRevoke } = useAction(revokeInvitation);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const [membersRes, invitesRes] = await Promise.all([
				executeGetMembers(),
				executeGetInvitations(),
			]);
			if (membersRes?.data) {
				setMembers(membersRes.data.members as Member[]);
				setCurrentUserRole(membersRes.data.currentUserRole as Role);
				setCurrentUserId(membersRes.data.currentUserId);
			}
			if (invitesRes?.data) {
				setInvitations(invitesRes.data as Invitation[]);
			}
		} finally {
			setLoading(false);
		}
	}, [executeGetMembers, executeGetInvitations]);

	useEffect(() => { void load(); }, [load]);

	const handleRoleChange = async (memberId: string, role: Role) => {
		setPendingId(memberId);
		try {
			await executeUpdateRole({ memberId, role });
			await load();
		} finally {
			setPendingId(null);
		}
	};

	const handleRemove = async (memberId: string) => {
		if (!confirm("Remove this member from the workspace?")) return;
		setPendingId(memberId);
		try {
			await executeRemove({ memberId });
			await load();
		} finally {
			setPendingId(null);
		}
	};

	const handleInvite = async (e: React.FormEvent) => {
		e.preventDefault();
		setInviteError(null);
		setInviteSuccess(false);
		setInviting(true);
		try {
			const res = await executeInvite({ email: inviteEmail, role: inviteRole });
			if (res?.serverError) {
				setInviteError(res.serverError);
			} else {
				setInviteSuccess(true);
				setInviteEmail("");
				await load();
			}
		} finally {
			setInviting(false);
		}
	};

	const handleRevoke = async (invitationId: string) => {
		setPendingId(invitationId);
		try {
			await executeRevoke({ invitationId });
			await load();
		} finally {
			setPendingId(null);
		}
	};

	const isReadOnly = currentUserRole === "member";

	return (
		<div className="mx-auto max-w-[1400px] space-y-6 p-8">
			<div>
				<h1 className="font-bold text-2xl tracking-tight">Members</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					{isReadOnly
						? "View your workspace members."
						: "Manage who has access to this workspace and their roles."}
				</p>
			</div>

			{!isReadOnly && (
				<Card className="border-border/40">
					<CardContent className="pt-5">
						<p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
							Invite member
						</p>
						<form onSubmit={handleInvite} className="flex items-center gap-3">
							<Input
								type="email"
								placeholder="colleague@example.com"
								value={inviteEmail}
								onChange={(e) => { setInviteEmail(e.target.value); setInviteSuccess(false); setInviteError(null); }}
								required
								className="h-8 max-w-xs border-border/60 bg-background text-sm"
							/>
							<Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "admin" | "member")}>
								<SelectTrigger className="h-8 w-28 border-border/60 bg-background text-xs">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="admin" className="text-xs">Admin</SelectItem>
									<SelectItem value="member" className="text-xs">Member</SelectItem>
								</SelectContent>
							</Select>
							<Button type="submit" size="sm" className="h-8 gap-1.5 text-xs" disabled={inviting}>
								{inviting
									? <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
									: <IconUserPlus className="h-3.5 w-3.5" />
								}
								Invite
							</Button>
							{inviteSuccess && <p className="text-xs text-emerald-400">Invitation created — copy the link below.</p>}
							{inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
						</form>
					</CardContent>
				</Card>
			)}

			{!isReadOnly && invitations.length > 0 && (
				<Card className="border-border/40">
					<CardContent className="p-0">
						<p className="px-6 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground border-b border-border/40">
							Pending invitations
						</p>
						<table className="w-full text-sm">
							<tbody>
								{invitations.map((inv, i) => (
									<tr
										key={inv.id}
										className={cn(
											"transition-colors hover:bg-muted/20",
											i !== invitations.length - 1 && "border-b border-border/40",
										)}
									>
										<td className="px-6 py-3">
											<p className="text-sm">{inv.email}</p>
											<p className="text-xs text-muted-foreground">
												Expires {new Date(inv.expiresAt).toLocaleDateString()}
											</p>
										</td>
										<td className="px-6 py-3">
											<Badge
												variant="outline"
												className={cn(
													"capitalize text-xs",
													ROLE_BADGE[(inv.role ?? "member") as Role] ?? ROLE_BADGE.member,
												)}
											>
												{inv.role ?? "member"}
											</Badge>
										</td>
										<td className="px-6 py-3 text-right">
											<div className="flex items-center justify-end gap-2">
												<CopyLinkButton invitationId={inv.id} />
												<Button
													size="sm"
													variant="ghost"
													className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
													disabled={pendingId === inv.id}
													onClick={() => handleRevoke(inv.id)}
												>
													{pendingId === inv.id
														? <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
														: <IconTrash className="h-3.5 w-3.5" />
													}
												</Button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</CardContent>
				</Card>
			)}

			{loading ? (
				<Card className="border-border/40">
					<CardContent className="flex items-center justify-center py-20">
						<IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
					</CardContent>
				</Card>
			) : members.length === 0 ? (
				<Card className="border-border/40">
					<CardContent className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
						<IconUsers className="h-8 w-8" />
						<p className="text-sm">No members found.</p>
					</CardContent>
				</Card>
			) : (
				<Card className="border-border/40">
					<CardContent className="p-0">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-border/40">
									<th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">
										Member
									</th>
									<th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">
										Role
									</th>
									{!isReadOnly && (
										<th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-widest text-muted-foreground">
											Actions
										</th>
									)}
								</tr>
							</thead>
							<tbody>
								{members.map((member, i) => {
									const canEdit = canManage(
										currentUserRole,
										member.role as Role,
										member.user.id,
										currentUserId,
									);
									const isPending = pendingId === member.id;

									return (
										<tr
											key={member.id}
											className={cn(
												"transition-colors hover:bg-muted/20",
												i !== members.length - 1 && "border-b border-border/40",
											)}
										>
											<td className="px-6 py-4">
												<div className="flex items-center gap-3">
													<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
														{member.user.name?.[0] ?? member.user.email[0]}
													</div>
													<div>
														<p className="font-medium leading-tight">{member.user.name}</p>
														<p className="text-xs text-muted-foreground">{member.user.email}</p>
													</div>
												</div>
											</td>
											<td className="px-6 py-4">
												{!isReadOnly && canEdit ? (
													<Select
														value={member.role}
														onValueChange={(v) => handleRoleChange(member.id, v as Role)}
														disabled={isPending}
													>
														<SelectTrigger className="h-7 w-32 border-border/60 bg-transparent text-xs">
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															{roleOptions(currentUserRole).map((r) => (
																<SelectItem key={r} value={r} className="text-xs capitalize">
																	{r}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												) : (
													<Badge
														variant="outline"
														className={cn(
															"capitalize text-xs",
															ROLE_BADGE[member.role as Role] ?? ROLE_BADGE.member,
														)}
													>
														{member.role}
													</Badge>
												)}
											</td>
											{!isReadOnly && (
												<td className="px-6 py-4 text-right">
													{canEdit && (
														<Button
															size="sm"
															variant="ghost"
															className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
															disabled={isPending}
															onClick={() => handleRemove(member.id)}
														>
															{isPending ? (
																<IconLoader2 className="h-3.5 w-3.5 animate-spin" />
															) : (
																<IconTrash className="h-3.5 w-3.5" />
															)}
														</Button>
													)}
												</td>
											)}
										</tr>
									);
								})}
							</tbody>
						</table>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
