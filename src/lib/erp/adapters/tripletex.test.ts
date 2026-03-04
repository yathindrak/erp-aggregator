import { describe, it, expect, vi, beforeEach } from "vitest";
import { TripletexAdapter } from "./tripletex";
import { ErpAuthError } from "../../api-utils";
import * as apiClient from "./api-client";
import { addDays, subDays } from "date-fns";
import type { CanonicalInvoice } from "../models/canonical";

describe("TripletexAdapter", () => {
    let adapter: TripletexAdapter;
    let mockApiGet: any;
    let mockApiPut: any;

    beforeEach(() => {
        vi.clearAllMocks();

        const mockAxiosInstance = {
            defaults: {
                auth: null,
            },
            get: vi.fn(),
            put: vi.fn(),
        };

        vi.spyOn(apiClient, "createApiClient").mockReturnValue(
            mockAxiosInstance as any,
        );

        adapter = new TripletexAdapter();
        mockApiGet = (adapter as any).api.get;
        mockApiPut = (adapter as any).api.put;
    });

    describe("Metadata", () => {
        it("should expose correct metadata", () => {
            expect(adapter.metadata.id).toBe("tripletex");
            expect(adapter.metadata.name).toBe("Tripletex");
        });
    });

    describe("Auth", () => {
        it("should validate existing valid session token", async () => {
            const creds = {
                accessToken: "session123",
                expiresAt: addDays(new Date(), 10).toISOString(),
            };

            const result = await adapter.auth.authenticate(creds);
            expect((adapter as any).api.defaults.auth).toEqual({
                username: "0",
                password: "session123",
            });
            expect(result).toBe("session123");
            expect(mockApiGet).not.toHaveBeenCalled();
        });

        it("should ping when missing expiresAt but having access token", async () => {
            const creds = { accessToken: "session123" };
            mockApiGet.mockResolvedValueOnce({});

            const result = await adapter.auth.authenticate(creds);
            expect(mockApiGet).toHaveBeenCalledWith("/token/session/%3EwhoAmI");
            expect(result).toBe("session123");
        });

        it("should clear auth on ping failure", async () => {
            const creds = { accessToken: "bad_session" };
            mockApiGet.mockRejectedValueOnce({ response: { status: 401 } });

            await expect(adapter.auth.authenticate(creds)).rejects.toThrow(
                "Missing client tokens",
            );
            expect((adapter as any).api.defaults.auth).toBeUndefined();
        });

        it("should recreate missing token when consumer and employee tokens exist", async () => {
            const creds = { consumerToken: "consumer", employeeToken: "employee" };
            mockApiPut.mockResolvedValueOnce({
                data: { value: { token: "new_token" } },
            });

            const result = await adapter.auth.authenticate(creds);
            expect(mockApiPut).toHaveBeenCalledWith(
                "/token/session/:create",
                null,
                expect.objectContaining({
                    params: expect.objectContaining({
                        consumerToken: "consumer",
                        employeeToken: "employee",
                    }),
                }),
            );

            expect(typeof result).toBe("object");
            if (typeof result === "object") {
                expect(result.accessToken).toBe("new_token");
                expect(result.consumerToken).toBe("consumer");
            }
            expect((adapter as any).api.defaults.auth).toEqual({
                username: "0",
                password: "new_token",
            });
        });
    });

    describe("Invoices", () => {
        it("should fetch AR invoices correctly", async () => {
            mockApiGet.mockResolvedValueOnce({
                data: {
                    values: [
                        {
                            id: 1,
                            invoiceDate: "2024-01-01",
                            amountCurrencyOutstanding: 100,
                            customer: { id: 123 },
                            currency: { code: "NOK" },
                        },
                    ],
                },
            });

            const invoices = await adapter.invoicesRecievable.fetch();
            expect(mockApiGet).toHaveBeenCalledWith("/invoice", expect.any(Object));
            expect(invoices).toHaveLength(1);
            expect(invoices[0]!.type).toBe("AR");
        });

        it("should fetch AP invoices correctly", async () => {
            mockApiGet.mockResolvedValueOnce({
                data: {
                    values: [
                        {
                            id: 2,
                            invoiceDate: "2024-01-02",
                            amountCurrency: -50,
                            outstandingAmount: 50,
                            supplier: { id: 456 },
                            currency: { code: "EUR" },
                        },
                    ],
                },
            });

            const invoices = await adapter.invoicesPayable.fetch();
            expect(mockApiGet).toHaveBeenCalledWith("/supplierInvoice", expect.any(Object));
            expect(invoices).toHaveLength(1);
            expect(invoices[0]!.type).toBe("AP");
        });
    });

    describe("Dashboard Metrics", () => {
        it("should fetch and calculate metrics correctly", async () => {
            vi.spyOn(adapter.invoicesRecievable, "fetch").mockResolvedValue([
                { type: "AR", openAmount: 200, status: "UNPAID" } as any,
                { type: "AR", openAmount: 50, status: "OVERDUE" } as any,
            ]);
            vi.spyOn(adapter.invoicesPayable, "fetch").mockResolvedValue([
                { type: "AP", openAmount: 100, status: "UNPAID" } as any,
            ]);

            mockApiGet.mockResolvedValueOnce({
                data: { values: [{ closingBalanceCurrency: 50000 }] },
            });

            const metrics = await adapter.dashboard.getMetrics();
            expect(metrics.totalAR).toBe(250);
            expect(metrics.totalAP).toBe(100);
            expect(metrics.overdueCount).toBe(1);
            expect(metrics.overdueTotal).toBe(50);
            expect(metrics.cashPosition).toBe(50000);
        });
    });

    describe("Contacts", () => {
        it("should fetch customers and suppliers correctly", async () => {
            mockApiGet.mockImplementation((url: string) => {
                if (url === "/customer") {
                    return Promise.resolve({
                        data: {
                            values: [
                                {
                                    id: 1,
                                    name: "Customer1",
                                    address: {
                                        street: "Road 1",
                                        city: "Oslo",
                                        postalCode: "0100",
                                        countryCode: "NO",
                                    },
                                },
                            ],
                        },
                    });
                }
                if (url === "/supplier") {
                    return Promise.resolve({
                        data: {
                            values: [{ id: 2, name: "Supplier1", email: "sup@sup.com" }],
                        },
                    });
                }
                return Promise.reject();
            });

            const contacts = await adapter.contacts.fetch();
            expect(contacts).toHaveLength(2);
            expect(contacts[0]!.type).toBe("CUSTOMER");
            expect(contacts[1]!.type).toBe("SUPPLIER");
        });
    });

    describe("Accounts", () => {
        it("should correctly map types", async () => {
            mockApiGet.mockResolvedValueOnce({
                data: {
                    values: [
                        {
                            id: 1,
                            number: 1000,
                            name: "Assets",
                            type: "ASSETS",
                            isInactive: false,
                        },
                        {
                            id: 2,
                            number: 3000,
                            name: "Rev",
                            type: "OPERATING_REVENUES",
                            isInactive: true,
                        },
                    ],
                },
            });

            const accounts = await adapter.accounts.fetch();
            expect(accounts).toHaveLength(2);
            expect(accounts[0]!.type).toBe("ASSET");
            expect(accounts[1]!.type).toBe("REVENUE");
        });
    });
});
