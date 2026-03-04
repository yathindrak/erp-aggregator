import type { IErpAdapterPlugin, ErpMetadata } from "./base";
import type {
    CanonicalInvoice,
    CanonicalContact,
    CanonicalAccount,
    CanonicalJournalEntry,
    AccountType,
} from "../models/canonical";
import { type AxiosInstance } from "axios";
import { isBefore } from "date-fns";
import { env } from "@/env";
import { ErpAuthError } from "../../api-utils";
import { createApiClient } from "./api-client";

export type EconomicCredentials = {
    appSecretToken?: string;
    agreementGrantToken?: string;
    accessToken?: string; // Combined appToken:grantToken for DB storage
};

export class EconomicAdapter implements IErpAdapterPlugin<EconomicCredentials> {
    private api: AxiosInstance;

    constructor() {
        this.api = createApiClient({
            baseURL: "https://restapi.e-conomic.com",
            headers: {
                "Content-Type": "application/json",
            },
        });
    }

    metadata: ErpMetadata = {
        id: "economic",
        name: "e-conomic",
        description: "Visma e-conomic accounting software",
        iconUrl: "https://avatars.githubusercontent.com/u/1089274?s=200&v=4", // e-conomic github logo
        authConfig: {
            description: "Grant your app access via the Installation URL down below, which results in an Agreement Grant Token.",
            setupUrl: env.NEXT_PUBLIC_ECONOMIC_APP_PUBLIC_TOKEN ? `https://secure.e-conomic.com/secure/api1/requestaccess.aspx?appPublicToken=${env.NEXT_PUBLIC_ECONOMIC_APP_PUBLIC_TOKEN}` : undefined,
            fields: [
                {
                    id: "agreementGrantToken",
                    label: "Agreement Grant Token",
                    type: "password",
                    placeholder: "e.g. demo",
                    hint: "The agreement grant token",
                },
            ],
        },
    };

    auth = {
        authenticate: async (
            credentials: EconomicCredentials
        ): Promise<Partial<EconomicCredentials> | string | undefined> => {
            let appToken = credentials.appSecretToken || env.ECONOMIC_APP_SECRET_TOKEN;
            let grantToken = credentials.agreementGrantToken;

            // If we have a combined token, prefer that
            if (credentials.accessToken) {
                const [token, grant] = credentials.accessToken.split(":");
                if (token && grant) {
                    appToken = token;
                    grantToken = grant;
                }
            }

            if (!appToken || !grantToken) {
                throw new Error("Missing e-conomic credentials (appSecretToken and agreementGrantToken)");
            }

            this.api.defaults.headers.common["X-AppSecretToken"] = appToken;
            this.api.defaults.headers.common["X-AgreementGrantToken"] = grantToken;

            try {
                // Verify credentials with a simple ping (fetch 1 customer)
                await this.api.get("/customers", { params: { pageSize: 1 } });

                const combinedToken = `${appToken}:${grantToken}`;

                // If it was already set and matches, just return it so ConnectionManager knows nothing changed
                if (credentials.accessToken === combinedToken) {
                    return combinedToken;
                }

                // Return updated credentials object
                return {
                    accessToken: combinedToken,
                    appSecretToken: appToken,
                    agreementGrantToken: grantToken,
                };
            } catch (e: any) {
                console.error("[Economic] Auth verify failed:", e.response?.data || e.message);
                const errorMsg = e instanceof ErpAuthError ? e.message : (e.response?.data?.message || "Failed to authenticate with e-conomic. Check tokens.");
                throw new ErpAuthError(errorMsg);
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
            const [arRes, apRes] = await Promise.all([
                this.api.get("/invoices/booked", {
                    params: { pageSize: 1000 },
                }).catch(() => ({ data: { collection: [] } })),
                this.api.get("/supplier-invoices", {
                    params: { pageSize: 1000 },
                }).catch(() => ({ data: { collection: [] } })),
            ]);

            const arData = arRes.data?.collection || [];
            const apData = apRes.data?.collection || [];

            const mapAR = (inv: any): CanonicalInvoice => {
                const openAmt = inv.remainder || inv.remainderInBaseCurrency || 0;
                const isOverdue = inv.dueDate && isBefore(new Date(inv.dueDate), new Date()) && openAmt > 0;
                let mappedStatus: CanonicalInvoice["status"] = "PAID";
                if (openAmt > 0) mappedStatus = isOverdue ? "OVERDUE" : "UNPAID";
                if (openAmt === undefined || openAmt === 0) {
                    mappedStatus = "PAID";
                    if (inv.remainder > 0) mappedStatus = isOverdue ? "OVERDUE" : "UNPAID";
                }

                return {
                    id: String(inv.bookedInvoiceNumber || inv.invoiceNumber),
                    type: "AR",
                    status: mappedStatus,
                    issueDate: inv.date,
                    dueDate: inv.dueDate || "",
                    currency: inv.currency || "DKK",
                    totalAmount: Math.abs(inv.grossAmount || inv.amount || 0),
                    openAmount: openAmt,
                    contactId: String(inv.customer?.customerNumber || ""),
                };
            };

            const mapAP = (inv: any): CanonicalInvoice => {
                const openAmt = inv.remainder || 0;
                const isOverdue = inv.dueDate && isBefore(new Date(inv.dueDate), new Date()) && openAmt > 0;
                let mappedStatus: CanonicalInvoice["status"] = "PAID";
                if (openAmt > 0) mappedStatus = isOverdue ? "OVERDUE" : "UNPAID";

                return {
                    id: String(inv.id || inv.supplierInvoiceNumber),
                    type: "AP",
                    status: mappedStatus,
                    issueDate: inv.date || inv.invoiceDate,
                    dueDate: inv.dueDate || "",
                    currency: inv.currency || "DKK",
                    totalAmount: Math.abs(inv.grossAmount || inv.amount || 0),
                    openAmount: openAmt,
                    contactId: String(inv.supplier?.supplierNumber || ""),
                };
            };

            const all: CanonicalInvoice[] = [
                ...arData.map(mapAR),
                ...apData.map(mapAP),
            ];

            if (status === "OVERDUE") return all.filter((i) => i.status === "OVERDUE");
            if (status === "UNPAID") return all.filter((i) => i.status === "UNPAID");
            return all;
        },
    };

    dashboard = {
        getMetrics: async () => {
            const invoices = await this.invoices.fetch();

            const totalAR = invoices
                .filter((i) => i.type === "AR" && i.openAmount > 0)
                .reduce((sum, i) => sum + i.openAmount, 0);

            const totalAP = invoices
                .filter((i) => i.type === "AP" && i.openAmount > 0)
                .reduce((sum, i) => sum + i.openAmount, 0);

            const overdue = invoices.filter((i) => i.status === "OVERDUE");

            let cashPosition = 0;
            try {
                // Fetch accounts with balances directly
                const accountsRes = await this.api.get("/accounts", {
                    params: { pageSize: 1000 }
                });
                const accs = accountsRes.data?.collection || [];

                // Heuristic to identify bank/cash accounts:
                // 1. Account type should be 'status' (individual Balance Sheet account)
                // 2. Name should contain specific bank/cash keywords
                const bankKeywords = ["bank", "kasse", "cash", "giro", "likvid", "beholdning"];
                const bankAccounts = accs.filter((a: any) => {
                    const name = (a.name || "").toLowerCase();
                    const accType = a.accountType;

                    const isBalanceSheetAccount = accType === "status";
                    const hasKeyword = bankKeywords.some(k => name.includes(k));

                    return isBalanceSheetAccount && hasKeyword && a.balance !== undefined;
                });

                cashPosition = bankAccounts.reduce((sum: number, a: any) => sum + (a.balance || 0), 0);
            } catch (e) {
                console.error("[Economic] Failed to calculate cash position:", e);
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
            const [customersRes, suppliersRes] = await Promise.all([
                this.api.get("/customers", { params: { pageSize: 1000 } }).catch(() => ({ data: { collection: [] } })),
                this.api.get("/suppliers", { params: { pageSize: 1000 } }).catch(() => ({ data: { collection: [] } })),
            ]);

            const res: CanonicalContact[] = [];

            (customersRes.data?.collection || []).forEach((c: any) => {
                res.push({
                    id: String(c.customerNumber),
                    name: c.name || "",
                    type: "CUSTOMER",
                    email: c.email,
                    phone: c.telephoneAndFaxNumber,
                    vatNumber: c.corporateIdentificationNumber,
                    address: c.address ? {
                        street: c.address || "",
                        city: c.city || "",
                        postalCode: c.zip || "",
                        countryCode: c.country || "DK",
                    } : undefined,
                });
            });

            (suppliersRes.data?.collection || []).forEach((s: any) => {
                res.push({
                    id: String(s.supplierNumber),
                    name: s.name || "",
                    type: "SUPPLIER",
                    email: s.email,
                    phone: s.telephoneAndFaxNumber,
                    vatNumber: s.corporateIdentificationNumber,
                    address: s.address ? {
                        street: s.address || "",
                        city: s.city || "",
                        postalCode: s.zip || "",
                        countryCode: s.country || "DK",
                    } : undefined,
                });
            });

            return res;
        },
    };

    accounts = {
        fetch: async (): Promise<CanonicalAccount[]> => {
            const { data } = await this.api.get("/accounts", { params: { pageSize: 1000 } });
            const accs = data.collection || [];

            return accs.map((a: any) => {
                let mappedType: AccountType = "EXPENSE";
                const t = a.accountType;
                const accNum = Number(a.accountNumber);

                if (t === "profitAndLoss") {
                    // Standard e-conomic P&L: Revenue is usually < 2000, Expenses > 2000
                    mappedType = accNum < 2000 ? "REVENUE" : "EXPENSE";
                } else if (t === "status") {
                    // Standard e-conomic Balance Sheet: Assets < 6000, Liabilities/Equity > 6000
                    mappedType = accNum < 6000 ? "ASSET" : "LIABILITY";
                }

                return {
                    id: String(a.accountNumber),
                    code: String(a.accountNumber),
                    name: a.name,
                    type: mappedType,
                    isActive: !a.blockDirectEntries,
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
            const from = startDate ? startDate : undefined;
            const to = endDate ? endDate : undefined;

            try {
                const yearsRes = await this.api.get("/accounting-years", {
                    params: { pageSize: 1000 }
                }).catch(() => ({ data: { collection: [] } }));
                const allYears: any[] = yearsRes.data?.collection || [];

                const validYears = allYears.filter((y: any) => {
                    if (!from && !to) return true;
                    const yFrom = new Date(y.fromDate);
                    const yTo = new Date(y.toDate);
                    const reqFrom = from ? new Date(from) : new Date(0);
                    const reqTo = to ? new Date(to) : new Date();
                    return yFrom <= reqTo && yTo >= reqFrom;
                });

                if (validYears.length === 0) return [];

                const entriesResults = await Promise.all(
                    validYears.map(y => this.api.get(`/accounting-years/${y.year}/entries`, {
                        params: {
                            fromDate: from,
                            toDate: to,
                            pageSize: 1000,
                        }
                    }).catch(() => ({ data: { collection: [] } })))
                );

                const entries = entriesResults.flatMap(r => r.data?.collection || []);

                // Group entries by voucherNumber
                const grouped = entries.reduce((acc: any, e: any) => {
                    const v = String(e.voucherNumber || "Unknown");
                    if (!acc[v]) {
                        acc[v] = {
                            id: String(e.entryNumber || e.voucherNumber),
                            date: e.date,
                            description: e.text || "Journal Entry",
                            voucherType: e.entryType || null,
                            lines: [],
                        };
                    }
                    acc[v].lines.push({
                        accountId: String(e.account?.accountNumber || ""),
                        amount: e.amount || 0,
                        taxAmount: e.vatAmount || 0,
                    });
                    return acc;
                }, {});

                return Object.values(grouped);
            } catch (e) {
                console.error("[Economic] Failed to fetch journals:", e);
                return [];
            }
        },
    };
}
