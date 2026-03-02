import type { IErpAdapterPlugin, ErpMetadata } from "./base";
import type {
	CanonicalInvoice,
	CanonicalContact,
	CanonicalAccount,
	CanonicalJournalEntry,
	AccountType,
} from "../models/canonical";
import { type AxiosInstance } from "axios";
import { addDays, addMonths, subMonths, isBefore, format } from "date-fns";
import { createApiClient } from "./api-client";

export type TripletexCredentials = {
	consumerToken?: string;
	employeeToken?: string;
	accessToken?: string;
	expiresAt?: string | number | Date;
};

interface TripletexInvoice {
	id: number;
	invoiceDate: string;
	invoiceDueDate?: string;
	amount?: number;
	amountCurrency?: number;
	amountOutstanding?: number;
	amountCurrencyOutstanding?: number;
	outstandingAmount?: number;
	customer?: { id: number };
	supplier?: { id: number };
	currency?: { id?: number; code?: string };
}

interface CustomerOrSupplier {
	id: number;
	name?: string;
	type: string;
	email?: string;
	phone?: string;
	vatNumber?: string;
	address?: {
		street: string;
		city: string;
		postalCode: string;
		countryCode: string;
	};
}

interface TripletexAccount {
	id: number;
	number: number;
	name: string;
	type: string;
	isInactive: boolean;
}

interface TripletexVoucher {
	id: number;
	date: string;
	description?: string;
	supplierVoucherType?: string;
}

interface TripletexPosting {
	voucher?: { id: number };
	account?: { id: number };
	amount: number;
	amountGross?: number;
}

// TODO: Might wanna consider pagination later. Also the hardcoded counts are not optimal.

// Always use tomorrow as the upper bound, otherwise we miss today's records.
function dateRange(startDate?: string, endDate?: string) {
	const now = new Date();
	return {
		from: startDate || format(subMonths(now, 6), "yyyy-MM-dd"),
		to: endDate || format(addDays(now, 1), "yyyy-MM-dd"),
	};
}

export class TripletexAdapter
	implements IErpAdapterPlugin<TripletexCredentials> {
	private api: AxiosInstance;

	constructor() {
		this.api = createApiClient({
			baseURL: "https://api-test.tripletex.tech/v2/",
		});
	}

	metadata: ErpMetadata = {
		id: "tripletex",
		name: "Tripletex",
		description: "All of Norway's accounting program",
		iconUrl: "https://www.tripletex.no/wp-content/uploads/2022/05/logo.svg",
		authConfig: {
			description: "Get your test tokens from https://api-test.tripletex.tech",
			fields: [
				{
					id: "consumerToken",
					label: "Consumer Token",
					type: "password",
					placeholder: "e.g. ea0...abc",
					hint: "Your app's consumer token",
				},
				{
					id: "employeeToken",
					label: "Employee Token",
					type: "password",
					placeholder: "e.g. 5a9...xyz",
					hint: "The employee token",
				},
			],
		},
	};

	auth = {
		authenticate: async (
			credentials: TripletexCredentials,
		): Promise<Partial<TripletexCredentials> | string | undefined> => {
			let { accessToken, expiresAt, consumerToken, employeeToken } = credentials;

			// If we have an active session token, check its validity
			if (accessToken) {
				const isExpiringSoon = expiresAt
					? isBefore(new Date(expiresAt), addDays(new Date(), 7)) // 1 week buffer
					: false;

				if (expiresAt && !isExpiringSoon) {
					console.log("[Tripletex] Session token still valid, skipping ping.");
					this.api.defaults.auth = { username: "0", password: accessToken };
					return accessToken;
				}

				// If expiring soon, or no expiresAt stored, check validity with a ping
				this.api.defaults.auth = { username: "0", password: accessToken };
				try {
					await this.api.get("/token/session/%3EwhoAmI");
					console.log("[Tripletex] Session token is still valid via ping.");
					return accessToken;
				} catch (e: any) {
					if (e.response?.status === 401) {
						console.log("[Tripletex] Token expired or invalid, recreating...");
						delete this.api.defaults.auth;
					} else {
						throw e;
					}
				}
			}

			if (!consumerToken || !employeeToken) {
				throw new Error("Missing client tokens (consumerToken/employeeToken) to create session.");
			}

			const expirationDate = addMonths(new Date(), 6);

			try {
				const response = await this.api.put("/token/session/:create", null, {
					params: {
						consumerToken,
						employeeToken,
						expirationDate: expirationDate.toISOString(),
					},
				});

				const token = response.data?.value?.token;
				if (!token) {
					throw new Error("Empty session token returned by Tripletex API");
				}

				// Apply it for all future requests on this adapter instance
				this.api.defaults.auth = {
					username: "0",
					password: token,
				};

				return {
					accessToken: token,
					expiresAt: expirationDate.toISOString(),
					consumerToken,
					employeeToken,
				};
			} catch (e: any) {
				console.error("[Tripletex] Auth failed:", e.response?.data || e.message);
				throw new Error("Tripletex session creation failed. Please check tokens.");
			}
		},
	};

	invoices = {
		fetch: async ({
			status,
			startDate,
			endDate,
		}: {
			status?: "UNPAID" | "OVERDUE";
			startDate?: string;
			endDate?: string;
		} = {}): Promise<CanonicalInvoice[]> => {
			const { from, to } = dateRange(startDate, endDate);

			const params = {
				count: 1000,
				invoiceDateFrom: from,
				invoiceDateTo: to,
			};

			const arParams: Record<string, string | number | boolean> = {
				...params,
				fields: "*,currency(id,code)",
			};
			const apParams: Record<string, string | number | boolean> = {
				...params,
				fields: "*,currency(id,code)",
			};

			// Fetch AR and AP in parallel — AP degrades gracefully if the module isn't enabled
			const [arData, apData] = await Promise.all([
				this.api
					.get<{ values: TripletexInvoice[] }>("/invoice", { params: arParams })
					.then((r) => r.data.values || [])
					.catch(() => []),
				this.api
					.get<{ values: TripletexInvoice[] }>("/supplierInvoice", {
						params: apParams,
					})
					.then((r) => r.data.values || [])
					.catch(() => []),
			]);

			const mapAR = (inv: TripletexInvoice): CanonicalInvoice => {
				const openAmt =
					inv.amountCurrencyOutstanding ?? inv.amountOutstanding ?? 0;
				const isOverdue =
					inv.invoiceDueDate &&
					isBefore(new Date(inv.invoiceDueDate), new Date()) &&
					openAmt > 0;
				let mappedStatus: CanonicalInvoice["status"] = "PAID";
				if (openAmt > 0) mappedStatus = isOverdue ? "OVERDUE" : "UNPAID";
				const invoice: CanonicalInvoice = {
					id: String(inv.id),
					type: "AR",
					status: mappedStatus,
					issueDate: inv.invoiceDate,
					dueDate: inv.invoiceDueDate || "",
					currency: inv.currency?.code || "NOK",
					totalAmount: inv.amountCurrency ?? inv.amount ?? 0,
					openAmount: openAmt,
					contactId: String(inv.customer?.id),
				};
				return invoice;
			};

			const mapAP = (inv: TripletexInvoice): CanonicalInvoice => {
				const openAmt =
					inv.outstandingAmount ?? Math.abs(inv.amountCurrency ?? 0);
				const dueDate = inv.invoiceDueDate;
				const isOverdue =
					dueDate && isBefore(new Date(dueDate), new Date()) && openAmt > 0;
				const mappedStatus: CanonicalInvoice["status"] =
					openAmt > 0 ? (isOverdue ? "OVERDUE" : "UNPAID") : "PAID";
				const invoice: CanonicalInvoice = {
					id: String(inv.id),
					type: "AP",
					status: mappedStatus,
					issueDate: inv.invoiceDate,
					dueDate: dueDate || "",
					currency: inv.currency?.code || "NOK",
					totalAmount: Math.abs(inv.amountCurrency ?? inv.amount ?? 0),
					openAmount: openAmt,
					contactId: String(inv.supplier?.id),
				};

				return invoice;
			};

			const all: CanonicalInvoice[] = [
				...arData.map(mapAR),
				...apData.map(mapAP),
			];

			if (status === "OVERDUE")
				return all.filter((i) => i.status === "OVERDUE");
			if (status === "UNPAID") return all.filter((i) => i.status === "UNPAID");
			return all;
		},
	};

	dashboard = {
		getMetrics: async () => {
			// To ensure dashboard numbers match the invoice lists exactly, we sum up open amounts
			// directly from the invoice records rather than relying on /ledger/openPost.
			const invoices = await this.invoices.fetch();

			console.log("[Tripletex] Invoices:", JSON.stringify(invoices, null, 2));

			const totalAR = invoices
				.filter((i) => i.type === "AR" && i.openAmount > 0)
				.reduce((sum, i) => sum + i.openAmount, 0);

			const totalAP = invoices
				.filter((i) => i.type === "AP" && i.openAmount > 0)
				.reduce((sum, i) => sum + i.openAmount, 0);

			const overdue = invoices.filter((i) => i.status === "OVERDUE");

			let cashPosition = 0;
			try {
				const bankRes = await this.api.get("/bank/statement");
				cashPosition = bankRes.data.values?.[0]?.closingBalanceCurrency || 0;
			} catch (_e) {
				/* bank statement may not be configured in sandbox */
			}

			return {
				totalAR,
				totalAP,

				overdueCount: overdue.length,
				overdueTotal: overdue.reduce((acc, inv) => acc + inv.openAmount, 0),
				cashPosition,
			};
		},
	};

	contacts = {
		fetch: async (): Promise<CanonicalContact[]> => {
			const [customers, suppliers] = await Promise.all([
				this.api.get("/customer", { params: { count: 10 } }),
				this.api.get("/supplier", { params: { count: 10 } }),
			]);

			const res: CanonicalContact[] = [];

			(customers.data?.values || []).forEach((c: CustomerOrSupplier) => {
				const canonContact: CanonicalContact = {
					id: String(c.id),
					name: c.name || "",
					type: "CUSTOMER",
					email: c.email,
					phone: c.phone,
					vatNumber: c.vatNumber, // Norway, the VAT no is the same as the organization number
					address: c.address
						? {
							street: c.address.street || "",
							city: c.address.city || "",
							postalCode: c.address.postalCode || "",
							countryCode: c.address.countryCode || "NO", // Default to NO
						}
						: undefined,
				};
				res.push(canonContact);
			});

			(suppliers.data?.values || []).forEach((s: CustomerOrSupplier) => {
				const contact: CanonicalContact = {
					id: String(s.id),
					name: s.name || "",
					type: "SUPPLIER",
					email: s.email,
					phone: s.phone,
					vatNumber: s.vatNumber,
					address: s.address
						? {
							street: s.address.street || "",
							city: s.address.city || "",
							postalCode: s.address.postalCode || "",
							countryCode: s.address.countryCode || "NO", // Default to NO
						}
						: undefined,
				};
				res.push(contact);
			});

			return res;
		},
	};

	accounts = {
		fetch: async (): Promise<CanonicalAccount[]> => {
			const { data } = await this.api.get("/ledger/account", {
				params: { count: 2000 },
			});
			const accs = data.values || [];

			return accs.map((a: TripletexAccount) => {
				let mappedType: AccountType = "EXPENSE";
				if (a.type === "ASSETS") mappedType = "ASSET";
				else if (a.type === "LIABILITIES") mappedType = "LIABILITY";
				else if (a.type === "EQUITY") mappedType = "EQUITY";
				else if (a.type === "OPERATING_REVENUES") mappedType = "REVENUE";
				else if (a.type === "OPERATING_EXPENSES") mappedType = "EXPENSE";

				return {
					id: String(a.id),
					code: String(a.number),
					name: a.name,
					type: mappedType,
					isActive: !a.isInactive,
				};
			});
		},
	};

	journals = {
		fetch: async ({
			startDate,
			endDate,
		}: {
			startDate?: string;
			endDate?: string;
		} = {}): Promise<CanonicalJournalEntry[]> => {
			const { from, to } = dateRange(startDate, endDate);

			const [vouchersRes, postingsRes] = await Promise.all([
				this.api.get("/ledger/voucher", {
					params: { dateFrom: from, dateTo: to, fields: "*" },
				}),
				this.api.get("/ledger/posting", {
					params: { dateFrom: from, dateTo: to, fields: "*" },
				}),
			]);

			const vouchers = vouchersRes.data?.values || [];
			const postings = postingsRes.data?.values || [];

			console.log("[Tripletex] Vouchers:", JSON.stringify(vouchers, null, 2));
			console.log("[Tripletex] Postings:", JSON.stringify(postings, null, 2));

			// Group postings by their voucher id
			const postingsByVoucher = postings.reduce(
				(acc: Record<string, TripletexPosting[]>, p: TripletexPosting) => {
					const vid = p.voucher?.id;
					if (!vid) return acc;
					if (!acc[vid]) acc[vid] = [];
					acc[vid].push(p);
					return acc;
				},
				{},
			);

			return vouchers.map((v: TripletexVoucher) => ({
				id: String(v.id),
				date: v.date,
				description: v.description || "Voucher",
				//   "TYPE_SUPPLIER_INVOICE_SIMPLE" → approved incoming supplier invoice
				//   null / undefined               → customer/other voucher
				voucherType: v.supplierVoucherType || null,
				lines: (postingsByVoucher[v.id] || []).map((p: TripletexPosting) => ({
					accountId: String(p.account?.id || ""),
					amount: p.amount,
					// taxAmount = difference between gross and net amount.
					// Only non-zero when the posting carries embedded VAT.
					taxAmount:
						p.amountGross != null && p.amount != null
							? Math.abs(p.amountGross - p.amount)
							: 0,
				})),
			}));
		},
	};
}
