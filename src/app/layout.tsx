import "@/styles/globals.css";

import type { Metadata } from "next";
import { Inter } from "next/font/google";

export const metadata: Metadata = {
	title: "Taxxa — Multi-ERP Financial Workspace",
	description:
		"AI-powered unified financial workspace for accountants. Connect Tripletex, Xero, Procountor and more.",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const inter = Inter({
	subsets: ["latin"],
	variable: "--font-inter",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html className={`${inter.variable} dark`} lang="en">
			<body className="bg-background text-foreground antialiased">
				{children}
			</body>
		</html>
	);
}
