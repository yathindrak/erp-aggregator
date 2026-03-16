"use client";

import { createOrganization } from "@/actions/organization.actions";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function OnboardingPage() {
	const router = useRouter();
	const [name, setName] = useState("");
	const { execute, isPending, hasErrored, result } = useAction(
		createOrganization,
		{
			onSuccess: () => router.push("/"),
		},
	);

	return (
		<div className="flex min-h-screen items-center justify-center bg-background">
			<div className="w-full max-w-md space-y-8 rounded-xl border border-border bg-card p-8 shadow-sm">
				<div className="space-y-1">
					<h1 className="text-2xl font-semibold tracking-tight text-foreground">
						Create your workspace
					</h1>
					<p className="text-sm text-muted-foreground">
						Set up your organization to start managing clients.
					</p>
				</div>

				<form
					className="space-y-4"
					onSubmit={(e) => {
						e.preventDefault();
						execute({ name });
					}}
				>
					<div className="space-y-2">
						<label
							htmlFor="org-name"
							className="text-sm font-medium text-foreground"
						>
							Organization name
						</label>
						<input
							id="org-name"
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Acme Accounting"
							required
							className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
						/>
					</div>

					{hasErrored && (
						<p className="text-sm text-destructive">
							{result.serverError ?? "Something went wrong. Please try again."}
						</p>
					)}

					<button
						type="submit"
						disabled={isPending || !name.trim()}
						className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isPending ? "Creating…" : "Create workspace"}
					</button>
				</form>
			</div>
		</div>
	);
}
