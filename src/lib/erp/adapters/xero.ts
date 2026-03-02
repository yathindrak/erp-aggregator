import type { IErpAdapterPlugin, ErpMetadata } from "./base";
import type {
	CanonicalInvoice,
	CanonicalContact,
	CanonicalAccount,
	CanonicalJournalEntry,
	CanonicalPayment,
	AccountType,
} from "../models/canonical";
import axios, { type AxiosInstance } from "axios";
import { isBefore, formatISO, addMinutes, addSeconds } from "date-fns";
import { env } from "@/env";
import { createApiClient } from "./api-client";

const parseXeroDate = (dateString?: string): string => {
	if (!dateString) return "";

	// Xero returns dates in Microsoft JSON format, e.g., /Date(1765238400000+0000)/
	// date-fns does not support parsing this natively so we extract the timestamp manually.
	if (dateString.startsWith("/Date(") && dateString.endsWith(")/")) {
		// remove prefix and parse the number - parseInt automatically stops at timezone suffixes like '+' or '-'
		const timestamp = parseInt(dateString.substring(6), 10);
		return formatISO(new Date(timestamp));
	}

	return dateString;
};

export type XeroCredentials = {
	accessToken?: string;
	refreshToken?: string;
	expiresAt?: string | number | Date;
	tenantId?: string;
};

interface XeroInvoice {
	InvoiceID: string;
	Type: string;
	Status: string;
	DateString?: string;
	Date?: string;
	DueDateString?: string;
	DueDate?: string;
	CurrencyCode?: string;
	Total: number;
	AmountDue: number;
	Contact?: { ContactID: string };
}

interface XeroContactPhone {
	PhoneType: string;
	PhoneNumber: string;
}

interface XeroContact {
	ContactID: string;
	Name: string;
	IsSupplier: boolean;
	IsCustomer: boolean;
	EmailAddress?: string;
	Phones?: XeroContactPhone[];
	TaxNumber?: string;
}

interface XeroAccount {
	AccountID: string;
	Code: string;
	Name: string;
	Class: string;
	Status: string;
}

interface XeroJournalLine {
	AccountID: string;
	NetAmount: number;
	TaxAmount?: number;
}

interface XeroJournal {
	JournalID: string;
	JournalDate: string;
	Reference?: string;
	JournalLines?: XeroJournalLine[];
}

interface XeroPayment {
	PaymentID: string;
	Date: string;
	Amount: number;
	CurrencyCode?: string;
	Invoice?: { InvoiceID: string };
	Account?: { AccountID: string };
}

export class XeroAdapter implements IErpAdapterPlugin<XeroCredentials> {
	private api: AxiosInstance;

	constructor() {
		this.api = createApiClient({
			baseURL: "https://api.xero.com/api.xro/2.0",
		});
	}

	metadata: ErpMetadata = {
		id: "xero",
		name: "Xero",
		description: "Sync financial data from Xero via OIDC",
		iconUrl: "https://www.xero.com/content/dam/xero/pilot-images/explainer/media-downloads/xero-logo-downloads.1762731076660.png",
		authConfig: {
			description:
				"Connect directly to Xero securely using OIDC",
			oauthRoute: "/api/integrations/xero/connect",
			fields: [],
		},
	};

	auth = {
		authenticate: async (
			credentials: XeroCredentials,
		): Promise<Partial<XeroCredentials> | string | undefined> => {
			let { accessToken, refreshToken, expiresAt, tenantId } = credentials;

			// If we have a refresh token, check if we need to refresh
			if (refreshToken) {
				const isExpiredOrExpiringSoon = expiresAt
					? isBefore(new Date(expiresAt), addMinutes(new Date(), 5))
					: true;

				// Refresh if we don't know the expiration OR it's expiring/expired
				if (isExpiredOrExpiringSoon) {
					console.log(`[XeroAdapter] ${!expiresAt ? "Expiration unknown" : "Token expired/expiring soon"}, refreshing...`);
					const clientId = env.XERO_CLIENT_ID;
					const clientSecret = env.XERO_CLIENT_SECRET;

					if (!clientId || !clientSecret) {
						throw new Error("Xero OAuth credentials are not configured on the server.");
					}

					const params = new URLSearchParams({
						grant_type: "refresh_token",
						refresh_token: refreshToken,
						client_id: clientId,
						client_secret: clientSecret,
					});

					try {
						const response = await axios.post("https://identity.xero.com/connect/token", params.toString(), {
							headers: { "Content-Type": "application/x-www-form-urlencoded" },
						});

						accessToken = response.data.access_token;
						refreshToken = response.data.refresh_token || refreshToken;
						const expiresIn = response.data.expires_in || 1800;
						expiresAt = addSeconds(new Date(), expiresIn).toISOString();

						// Apply new token to active requests immediately
						if (accessToken) {
							this.api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
						}
						if (tenantId) {
							this.api.defaults.headers.common["xero-tenant-id"] = tenantId;
						}

						// Return the updated credentials so ConnectionManager can save them
						return {
							accessToken,
							refreshToken,
							expiresAt,
							tenantId,
						};
					} catch (e: any) {
						console.error("[XeroAdapter] Token refresh failed:", e.response?.data || e.message);
						throw new Error("Xero token refresh failed. Please reconnect.");
					}
				}
			}

			if (accessToken) {
				this.api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
			}
			if (tenantId) {
				this.api.defaults.headers.common["xero-tenant-id"] = tenantId;
			}

			return accessToken;
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
			let whereClause = "";

			// Status in Xero: DRAFT, SUBMITTED, DELETED, AUTHORISED, PAID, VOIDED
			if (status === "UNPAID") {
				whereClause = 'Status=="AUTHORISED"';
			}

			const { data } = await this.api.get("/Invoices", {
				params: { Where: whereClause },
			});
			const invoices: XeroInvoice[] = data.Invoices || [];

			const all = invoices.map((inv: XeroInvoice): CanonicalInvoice => {
				let isOverdue = false;
				const dueDateValue = parseXeroDate(inv.DueDateString || inv.DueDate);
				const issueDateValue = parseXeroDate(inv.DateString || inv.Date);
				if (dueDateValue) {
					isOverdue =
						isBefore(new Date(dueDateValue), new Date()) && inv.AmountDue > 0;
				}

				let mappedStatus: CanonicalInvoice["status"] = "PAID";

				if (inv.Status === "DRAFT") mappedStatus = "DRAFT";
				else if (inv.Status === "DELETED" || inv.Status === "VOIDED")
					mappedStatus = "VOIDED";
				else if (inv.Status === "AUTHORISED")
					mappedStatus = isOverdue ? "OVERDUE" : "UNPAID";

				const invoice: CanonicalInvoice = {
					id: String(inv.InvoiceID),
					type: inv.Type === "ACCPAY" ? "AP" : "AR", // Accounts Payable vs Accounts Receivable
					status: mappedStatus,
					issueDate: issueDateValue || "",
					dueDate: dueDateValue || "",
					currency: inv.CurrencyCode || "GBP",
					totalAmount: inv.Total,
					openAmount: inv.AmountDue,
					contactId: String(inv.Contact?.ContactID),
				};

				return invoice;
			});

			if (status === "OVERDUE") {
				return all.filter((i) => i.status === "OVERDUE");
			}
			if (status === "UNPAID") {
				return all.filter((i) => i.status === "UNPAID");
			}

			return all;
		},
	};

	dashboard = {
		getMetrics: async () => {
			const invoices = await this.invoices.fetch();

			const reports = await this.api.get("/Reports/BankSummary", {
				validateStatus: () => true,
			});

			let cashPosition = 0;
			try {
				if (reports?.data?.Reports?.[0]?.Rows) {
					const rows = reports.data.Reports[0].Rows;
					for (const reportBlock of rows) {
						if (reportBlock.RowType === "Section" && reportBlock.Rows) {
							for (const row of reportBlock.Rows) {
								if (row.RowType === "SummaryRow" && row.Cells) {
									const closingBalanceCell = row.Cells[4];
									if (closingBalanceCell && closingBalanceCell.Value) {
										cashPosition = parseFloat(closingBalanceCell.Value);
									}
								}
							}
						}
					}
				}
			} catch (_e) { }

			const totalAR = invoices
				.filter((i) => i.type === "AR" && i.openAmount > 0)
				.reduce((sum, i) => sum + i.openAmount, 0);

			const totalAP = invoices
				.filter((i) => i.type === "AP" && i.openAmount > 0)
				.reduce((sum, i) => sum + i.openAmount, 0);

			const overdue = invoices.filter((i) => i.status === "OVERDUE");

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
			const { data } = await this.api.get("/Contacts");
			const contacts: XeroContact[] = data.Contacts || [];

			const res: CanonicalContact[] = [];

			contacts.forEach((c: XeroContact) => {
				const canonContact: CanonicalContact = {
					id: String(c.ContactID),
					name: c.Name,
					type:
						c.IsSupplier && c.IsCustomer
							? "BOTH"
							: c.IsSupplier
								? "SUPPLIER"
								: "CUSTOMER",
					email: c.EmailAddress,
					phone: c.Phones?.find((p) => p.PhoneType === "DEFAULT")
						?.PhoneNumber,
					vatNumber: c.TaxNumber,
				};

				res.push(canonContact);
			});

			return res;
		},
	};

	accounts = {
		fetch: async (): Promise<CanonicalAccount[]> => {
			const { data } = await this.api.get("/Accounts");
			const accs: XeroAccount[] = data.Accounts || [];

			return accs.map((a: XeroAccount): CanonicalAccount => {
				let mappedType: AccountType = "EXPENSE";
				if (a.Class === "ASSET") mappedType = "ASSET";
				else if (a.Class === "LIABILITY") mappedType = "LIABILITY";
				else if (a.Class === "EQUITY") mappedType = "EQUITY";
				else if (a.Class === "REVENUE") mappedType = "REVENUE";
				else if (a.Class === "EXPENSE") mappedType = "EXPENSE";

				const canonicalAccount: CanonicalAccount = {
					id: String(a.AccountID),
					code: String(a.Code),
					name: a.Name,
					type: mappedType,
					isActive: a.Status === "ACTIVE",
				};
				return canonicalAccount;
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
			const { data } = await this.api.get("/Journals");
			const journals: XeroJournal[] = data.Journals || [];

			return journals.map((j: XeroJournal): CanonicalJournalEntry => {
				const journalEntry: CanonicalJournalEntry = {
					id: String(j.JournalID),
					date: parseXeroDate(j.JournalDate),
					description: j.Reference || "Journal",
					lines: (j.JournalLines || []).map((jl: XeroJournalLine) => ({
						accountId: String(jl.AccountID),
						amount: jl.NetAmount, // Handling positive/negative based on debit/credit
						taxAmount: jl.TaxAmount || 0,
					})),
				};

				return journalEntry;
			});
		},
	};

	payments = {
		fetch: async ({
			startDate,
			endDate,
		}: {
			startDate?: string;
			endDate?: string;
		} = {}): Promise<CanonicalPayment[]> => {
			const { data } = await this.api.get("/Payments");
			const payments: XeroPayment[] = data.Payments || [];

			return payments.map((p: XeroPayment): CanonicalPayment => ({
				id: p.PaymentID,
				date: parseXeroDate(p.Date),
				amount: p.Amount,
				currency: p.CurrencyCode || "GBP", // Defaulting to GBP if not present, though ideally organization currency
				invoiceId: p.Invoice?.InvoiceID,
				bankAccountId: p.Account?.AccountID,
			}));
		},
	};
}
