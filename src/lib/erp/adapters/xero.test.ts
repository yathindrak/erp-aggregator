import { describe, it, expect, vi, beforeEach } from "vitest";
import { XeroAdapter } from "./xero";
import { ErpAuthError } from "../../api-utils";
import axios from "axios";
import * as apiClient from "./api-client";

// Mock env variables
vi.mock("@/env", () => ({
    env: {
        XERO_CLIENT_ID: "mock_client_id",
        XERO_CLIENT_SECRET: "mock_client_secret",
    },
}));

describe("XeroAdapter", () => {
    let adapter: XeroAdapter;
    let mockApiGet: any;
    let mockApiPost: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup the mocked API instance
        const mockAxiosInstance = {
            defaults: {
                headers: {
                    common: {},
                },
            },
            get: vi.fn(),
            post: vi.fn(),
        };

        vi.spyOn(apiClient, "createApiClient").mockReturnValue(
            mockAxiosInstance as any,
        );

        adapter = new XeroAdapter();
        mockApiGet = (adapter as any).api.get;
        mockApiPost = (adapter as any).api.post;
    });

    describe("Metadata", () => {
        it("should have correct metadata", () => {
            expect(adapter.metadata.id).toBe("xero");
            expect(adapter.metadata.name).toBe("Xero");
        });
    });

    describe("Auth", () => {
        it("should authenticate with existing valid token", async () => {
            const creds = {
                accessToken: "valid_token",
                tenantId: "tenant_id",
                expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
            };
            const result = await adapter.auth.authenticate(creds);

            expect((adapter as any).api.defaults.headers.common.Authorization).toBe(
                "Bearer valid_token",
            );
            expect(
                (adapter as any).api.defaults.headers.common["xero-tenant-id"],
            ).toBe("tenant_id");
            expect(result).toBe("valid_token");
        });

        it("should refresh token if expired", async () => {
            const creds = {
                accessToken: "expired_token",
                refreshToken: "refresh_me",
                tenantId: "tenant_id",
                expiresAt: new Date(Date.now() - 1000).toISOString(),
            };

            const axiosPostSpy = vi.spyOn(axios, "post").mockResolvedValue({
                data: {
                    access_token: "new_token",
                    refresh_token: "new_refresh",
                    expires_in: 3600,
                },
            } as any);

            const result = await adapter.auth.authenticate(creds);

            expect(axiosPostSpy).toHaveBeenCalledWith(
                "https://identity.xero.com/connect/token",
                expect.stringContaining("grant_type=refresh_token"),
                expect.any(Object),
            );

            expect(typeof result).toBe("object");
            if (typeof result === "object") {
                expect(result.accessToken).toBe("new_token");
                expect(result.refreshToken).toBe("new_refresh");
            }

            expect((adapter as any).api.defaults.headers.common.Authorization).toBe(
                "Bearer new_token",
            );
        });

        it("should throw ErpAuthError on refresh failure", async () => {
            const creds = {
                accessToken: "expired_token",
                refreshToken: "refresh_me",
                expiresAt: new Date(Date.now() - 1000).toISOString(),
            };

            vi.spyOn(axios, "post").mockRejectedValue(new Error("Network Error"));

            await expect(adapter.auth.authenticate(creds)).rejects.toThrow(
                ErpAuthError,
            );
        });
    });

    describe("Invoices", () => {
        it("should fetch and map receivable invoices correctly", async () => {
            const mockInvoices = [
                {
                    InvoiceID: "inv1",
                    Type: "ACCREC",
                    Status: "AUTHORISED",
                    DueDate: `/Date(${Date.now() + 100000000}+0000)/`,
                    AmountDue: 100,
                    Total: 100,
                    Contact: { ContactID: "cont1" },
                },
            ];
            mockApiGet.mockResolvedValue({ data: { Invoices: mockInvoices } });

            const result = await adapter.invoicesRecievable!.fetch();

            expect(mockApiGet).toHaveBeenCalledWith("/Invoices", expect.objectContaining({
                params: expect.objectContaining({ Where: expect.stringContaining('Type=="ACCREC"') })
            }));
            expect(result.length).toBe(1);
            expect(result[0]!.type).toBe("AR");
        });

        it("should fetch and map payable invoices correctly", async () => {
            const mockInvoices = [
                {
                    InvoiceID: "inv2",
                    Type: "ACCPAY",
                    Status: "AUTHORISED",
                    AmountDue: 50,
                    Total: 50,
                },
            ];
            mockApiGet.mockResolvedValue({ data: { Invoices: mockInvoices } });

            const result = await adapter.invoicesPayable!.fetch();

            expect(mockApiGet).toHaveBeenCalledWith("/Invoices", expect.objectContaining({
                params: expect.objectContaining({ Where: expect.stringContaining('Type=="ACCPAY"') })
            }));
            expect(result.length).toBe(1);
            expect(result[0]!.type).toBe("AP");
        });
    });

    describe("Contacts", () => {
        it("should fetch contacts correctly", async () => {
            mockApiGet.mockResolvedValue({
                data: {
                    Contacts: [
                        {
                            ContactID: "c1",
                            Name: "Customer 1",
                            IsCustomer: true,
                            IsSupplier: false,
                        },
                        {
                            ContactID: "s1",
                            Name: "Supplier 1",
                            IsCustomer: false,
                            IsSupplier: true,
                        },
                        {
                            ContactID: "b1",
                            Name: "Both 1",
                            IsCustomer: true,
                            IsSupplier: true,
                        },
                    ],
                },
            });

            const result = await adapter.contacts.fetch();
            expect(result).toHaveLength(3);
            expect(result[0]!.type).toBe("CUSTOMER");
            expect(result[1]!.type).toBe("SUPPLIER");
            expect(result[2]!.type).toBe("BOTH");
        });
    });

    describe("Accounts", () => {
        it("should map accounts properly", async () => {
            mockApiGet.mockResolvedValue({
                data: {
                    Accounts: [
                        {
                            AccountID: "a1",
                            Code: "200",
                            Name: "Sales",
                            Class: "REVENUE",
                            Status: "ACTIVE",
                        },
                        {
                            AccountID: "a2",
                            Code: "400",
                            Name: "Advertising",
                            Class: "EXPENSE",
                            Status: "ARCHIVED",
                        },
                    ],
                },
            });

            const result = await adapter.accounts.fetch();
            expect(result).toHaveLength(2);
            expect(result[0]!.type).toBe("REVENUE");
            expect(result[0]!.isActive).toBe(true);

            expect(result[1]!.type).toBe("EXPENSE");
            expect(result[1]!.isActive).toBe(false);
        });
    });

    describe("Dashboard Metrics", () => {
        it("should calculate correctly", async () => {
            vi.spyOn(adapter.invoicesRecievable!, "fetch").mockResolvedValue([
                { id: "1", type: "AR", status: "UNPAID", openAmount: 100 } as any,
            ]);
            vi.spyOn(adapter.invoicesPayable!, "fetch").mockResolvedValue([
                { id: "2", type: "AP", status: "OVERDUE", openAmount: 50 } as any,
            ]);

            mockApiGet.mockResolvedValue({
                data: {
                    Reports: [
                        {
                            Rows: [
                                {
                                    RowType: "Section",
                                    Rows: [
                                        {
                                            RowType: "SummaryRow",
                                            Cells: [{}, {}, {}, {}, { Value: "1500.5" }],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            });

            const metrics = await adapter.dashboard.getMetrics();
            expect(metrics.totalAR).toBe(100);
            expect(metrics.totalAP).toBe(50);
            expect(metrics.overdueCount).toBe(1);
            expect(metrics.overdueTotal).toBe(50);
            expect(metrics.cashPosition).toBe(1500.5);
        });
    });
});
