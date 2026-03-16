"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { acceptInvitation } from "@/actions/members.actions";
import { IconLoader2, IconCheck, IconAlertCircle } from "@tabler/icons-react";

export default function AcceptInvitationPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const token = searchParams.get("token");

	const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
	const [errorMsg, setErrorMsg] = useState("");

	const { executeAsync } = useAction(acceptInvitation);

	useEffect(() => {
		if (!token) {
			setStatus("error");
			setErrorMsg("Invalid or missing invitation token.");
			return;
		}

		async function accept() {
			const res = await executeAsync({ invitationId: token! });
			if (res?.serverError) {
				setStatus("error");
				setErrorMsg(res.serverError);
			} else if (res?.data) {
				setStatus("success");
				setTimeout(() => router.push("/"), 2000);
			} else {
				setStatus("error");
				setErrorMsg("Something went wrong. The invitation may have expired.");
			}
		}

		void accept();
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [token]);

	return (
		<div className="flex min-h-screen items-center justify-center bg-background">
			<div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-8 shadow-sm text-center">
				{status === "loading" && (
					<>
						<IconLoader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
						<p className="text-sm text-muted-foreground">Accepting invitation…</p>
					</>
				)}
				{status === "success" && (
					<>
						<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
							<IconCheck className="h-6 w-6 text-emerald-400" />
						</div>
						<h1 className="font-semibold text-lg">You&apos;re in!</h1>
						<p className="text-sm text-muted-foreground">Redirecting to your workspace…</p>
					</>
				)}
				{status === "error" && (
					<>
						<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15">
							<IconAlertCircle className="h-6 w-6 text-destructive" />
						</div>
						<h1 className="font-semibold text-lg">Invitation failed</h1>
						<p className="text-sm text-muted-foreground">{errorMsg}</p>
						<button
							onClick={() => router.push("/login")}
							className="mt-2 text-xs text-blue-400 hover:underline"
						>
							Go to login
						</button>
					</>
				)}
			</div>
		</div>
	);
}
