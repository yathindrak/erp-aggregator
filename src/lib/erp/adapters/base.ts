import type {
	CanonicalInvoice,
	CanonicalContact,
	CanonicalAccount,
	CanonicalJournalEntry,
} from "../models/canonical";

interface ErpAuthField {
	id: string;
	label: string;
	type: "text" | "password"; // html input type
	placeholder?: string;
	hint?: string;
}

export interface ErpMetadata {
	id: string; // 'xero', 'tripletex', 'procountor'
	name: string; // display Name
	description: string;
	iconUrl: string;
	authConfig?: {
		description: string;
		setupUrl?: string;
		fields?: ErpAuthField[];
		oauthRoute?: string;
	};
}

interface ErpAuthenticator<TCredentials = unknown> {
	authenticate: (credentials: TCredentials) => Promise<string | Partial<TCredentials> | undefined>;
}

interface ErpResource<T, TParams = unknown> {
	fetch: (params?: TParams) => Promise<T[]>;
}

export interface IErpAdapterPlugin<TCredentials = unknown> {
	metadata: ErpMetadata;
	auth: ErpAuthenticator<TCredentials>;

	// TODO: Make these required if every erp supports
	invoices?: ErpResource<
		CanonicalInvoice,
		{ status?: "UNPAID" | "OVERDUE"; startDate?: string; endDate?: string }
	>;
	contacts?: ErpResource<CanonicalContact>;
	accounts?: ErpResource<CanonicalAccount>;
	journals?: ErpResource<
		CanonicalJournalEntry,
		{ startDate?: string; endDate?: string }
	>;

	dashboard?: {
		getMetrics: () => Promise<{
			totalAR: number;
			totalAP: number;
			overdueCount: number;
			overdueTotal: number;
			cashPosition: number;
		}>;
	};
}
