"use server";

import { z } from "zod";
import { db } from "@/server/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { authActionClient } from "@/lib/safe-action";

async function getActiveOrgId(session: { session: { activeOrganizationId?: string | null }; user: { id: string } }) {
	const orgId = session.session.activeOrganizationId;
	if (orgId) return orgId;
	const member = await db.member.findFirst({
		where: { userId: session.user.id },
		orderBy: { createdAt: "asc" },
	});
	return member?.organizationId ?? null;
}

async function requireOrgMember(userId: string, orgId: string) {
	const member = await db.member.findFirst({
		where: { userId, organizationId: orgId },
	});
	if (!member) throw new Error("Forbidden");
	return member;
}

export const getMembers = authActionClient.action(async ({ ctx: { session } }) => {
	const orgId = await getActiveOrgId(session);
	if (!orgId) return null;

	const members = await db.member.findMany({
		where: { organizationId: orgId },
		include: {
			user: { select: { id: true, name: true, email: true, image: true } },
		},
		orderBy: { createdAt: "asc" },
	});

	const currentUserRole = members.find((m) => m.userId === session.user.id)?.role ?? "member";

	return { members, currentUserRole, currentUserId: session.user.id };
});

export const inviteMember = authActionClient
	.inputSchema(
		z.object({
			email: z.string().email("Invalid email address"),
			role: z.enum(["admin", "member"]),
		}),
	)
	.action(async ({ parsedInput: { email, role }, ctx: { session } }) => {
		const orgId = await getActiveOrgId(session);
		if (!orgId) throw new Error("No active organization");

		const actor = await requireOrgMember(session.user.id, orgId);
		if (actor.role === "member") throw new Error("Forbidden");

		return await auth.api.createInvitation({
			body: { email, role, organizationId: orgId },
			headers: await headers(),
		});
	});

export const getPendingInvitations = authActionClient.action(async ({ ctx: { session } }) => {
	const orgId = await getActiveOrgId(session);
	if (!orgId) return [];

	await requireOrgMember(session.user.id, orgId);

	return db.invitation.findMany({
		where: { organizationId: orgId, status: "pending", expiresAt: { gt: new Date() } },
		orderBy: { createdAt: "desc" },
	});
});

export const revokeInvitation = authActionClient
	.inputSchema(z.object({ invitationId: z.string() }))
	.action(async ({ parsedInput: { invitationId }, ctx: { session } }) => {
		const invitation = await db.invitation.findUniqueOrThrow({ where: { id: invitationId } });
		const actor = await requireOrgMember(session.user.id, invitation.organizationId);
		if (actor.role === "member") throw new Error("Forbidden");
		return db.invitation.delete({ where: { id: invitationId } });
	});

export const acceptInvitation = authActionClient
	.inputSchema(z.object({ invitationId: z.string() }))
	.action(async ({ parsedInput: { invitationId } }) => {
		return await auth.api.acceptInvitation({
			body: { invitationId },
			headers: await headers(),
		});
	});

export const updateMemberRole = authActionClient
	.inputSchema(
		z.object({
			memberId: z.string(),
			role: z.enum(["owner", "admin", "member"]),
		}),
	)
	.action(async ({ parsedInput: { memberId, role }, ctx: { session } }) => {
		const target = await db.member.findUniqueOrThrow({ where: { id: memberId } });
		const actor = await requireOrgMember(session.user.id, target.organizationId);

		if (actor.role === "member") throw new Error("Forbidden");
		if (target.userId === session.user.id) throw new Error("Cannot change your own role");
		if (target.role === "owner") throw new Error("Cannot change the owner's role");
		if (actor.role === "admin" && role === "owner") throw new Error("Admins cannot promote to owner");

		return db.member.update({ where: { id: memberId }, data: { role } });
	});

export const removeMember = authActionClient
	.inputSchema(z.object({ memberId: z.string() }))
	.action(async ({ parsedInput: { memberId }, ctx: { session } }) => {
		const target = await db.member.findUniqueOrThrow({ where: { id: memberId } });
		const actor = await requireOrgMember(session.user.id, target.organizationId);

		if (actor.role === "member") throw new Error("Forbidden");
		if (target.userId === session.user.id) throw new Error("Cannot remove yourself");
		if (target.role === "owner") throw new Error("Cannot remove the owner");
		if (actor.role === "admin" && target.role === "admin") throw new Error("Admins cannot remove other admins");

		return db.member.delete({ where: { id: memberId } });
	});
