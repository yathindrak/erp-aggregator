import { AdminShell } from "@/components/admin-shell";
import { WorkspaceProvider } from "@/providers/workspace-provider";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function AdminLayout({
	children,
}: {
	children: ReactNode;
}) {
	const session = await auth.api.getSession({ headers: await headers() });

	if (!session) redirect("/login");

	const memberships = await db.member.findMany({
		where: { userId: session.user.id },
		include: { organization: true },
		orderBy: { createdAt: "asc" },
	});

	if (memberships.length === 0) redirect("/onboarding");

	const activeOrgId = session.session.activeOrganizationId;
	const active =
		memberships.find((m) => m.organizationId === activeOrgId) ?? memberships[0]!;

	const orgs = memberships.map((m) => ({
		id: m.organization.id,
		name: m.organization.name,
	}));

	return (
		<WorkspaceProvider activeOrg={{ id: active.organization.id, name: active.organization.name }} orgs={orgs}>
			<AdminShell>{children}</AdminShell>
		</WorkspaceProvider>
	);
}
