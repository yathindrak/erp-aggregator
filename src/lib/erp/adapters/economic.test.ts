import { describe, it, expect, vi, beforeEach } from "vitest";
import { EconomicAdapter } from "./economic";
import { ErpAuthError } from "../../api-utils";
import * as apiClient from "./api-client";

vi.mock("@/env", () => ({
	env: {
		ECONOMIC_APP_SECRET_TOKEN: "env_app_token",
		NEXT_PUBLIC_ECONOMIC_APP_PUBLIC_TOKEN: "public_token",
	},
}));

describe("EconomicAdapter", () => {
	let adapter: EconomicAdapter;
	let mockApiGet: any;

	beforeEach(() => {
		vi.clearAllMocks();

		const mockAxiosInstance = {
			defaults: {
				headers: {
					common: {},
				},
			},
			get: vi.fn(),
		};

		vi.spyOn(apiClient, "createApiClient").mockReturnValue(
			mockAxiosInstance as any,
		);

		adapter = new EconomicAdapter();
		mockApiGet = (adapter as any).api.get;
	});

	describe("Metadata", () => {
		it("should expose correct metadata", () => {
			expect(adapter.metadata.id).toBe("economic");
			expect(adapter.metadata.name).toBe("e-conomic");
		});
	});

	describe("Auth", () => {
		it("should authenticate with app token and grant token", async () => {
			const creds = { appSecretToken: "app", agreementGrantToken: "grant" };
			mockApiGet.mockResolvedValueOnce({});

			const result = await adapter.auth.authenticate(creds);

			expect((adapter as any).api.defaults.headers.common["X-AppSecretToken"]).toBe("app");
			expect((adapter as any).api.defaults.headers.common["X-AgreementGrantToken"]).toBe("grant");
			expect(result).toEqual({
				accessToken: "app:grant",
				appSecretToken: "app",
				agreementGrantToken: "grant",
			});
		});

		it("should parse combined access token", async () => {
			const creds = { accessToken: "parsed_app:parsed_grant" };
			mockApiGet.mockResolvedValueOnce({});

			const result = await adapter.auth.authenticate(creds);

			expect((adapter as any).api.defaults.headers.common["X-AppSecretToken"]).toBe("parsed_app");
			expect((adapter as any).api.defaults.headers.common["X-AgreementGrantToken"]).toBe("parsed_grant");
			expect(result).toBe("parsed_app:parsed_grant");
		});

		it("should throw ErpAuthError if missing tokens", async () => {
			await expect(adapter.auth.authenticate({ agreementGrantToken: "" })).rejects.toThrow("Missing e-conomic credentials");
		});

		it("should throw ErpAuthError on failed verification", async () => {
			const creds = { appSecretToken: "bad", agreementGrantToken: "bad" };
			mockApiGet.mockRejectedValueOnce({
				response: { data: { message: "Invalid token" } },
			});

			await expect(adapter.auth.authenticate(creds)).rejects.toThrow("Invalid token");
		});
	});

	describe("Invoices", () => {
		it("should fetch and map AR invoices correctly", async () => {
			const mockInvoices = [
				{
					invoiceNumber: 1,
					date: "2023-01-01",
					dueDate: "2023-02-01",
					currency: "DKK",
					grossAmount: 100,
					remainder: 100,
					customer: { customerNumber: "c1" },
				},
			];
			mockApiGet.mockResolvedValueOnce({ data: { collection: mockInvoices } });

			const result = await adapter.invoicesRecievable!.fetch();

			expect(mockApiGet).toHaveBeenCalledWith("/invoices/booked", expect.any(Object));
			expect(result).toHaveLength(1);
			expect(result[0]!.type).toBe("AR");
			expect(result[0]!.id).toBe("1");
		});
	});

	describe("Dashboard Metrics", () => {
		it("should calculate correctly", async () => {
			vi.spyOn(adapter.invoicesRecievable!, "fetch").mockResolvedValue([
				{ id: "1", type: "AR", status: "UNPAID", openAmount: 200 } as any,
				{ id: "2", type: "AR", status: "OVERDUE", openAmount: 50 } as any,
			]);

			mockApiGet.mockResolvedValueOnce({
				data: {
					collection: [
						{ name: "Bank Kasse", accountType: "status", balance: 12000 },
						{ name: "Regular Account", accountType: "status", balance: 500 },
					],
				},
			});

			const metrics = await adapter.dashboard.getMetrics();
			expect(metrics.totalAR).toBe(250);
			expect(metrics.totalAP).toBe(0);
			expect(metrics.overdueCount).toBe(1);
			expect(metrics.overdueTotal).toBe(50);
			expect(metrics.cashPosition).toBe(12000);
		});
	});

	describe("Contacts", () => {
		it("should fetch contacts and format them properly", async () => {
			mockApiGet
				.mockResolvedValueOnce({
					data: {
						collection: [{ customerNumber: "c1", name: "Cust1", email: "c@c.c" }],
					},
				})
				.mockResolvedValueOnce({
					data: {
						collection: [{ supplierNumber: "s1", name: "Supp1", corporateIdentificationNumber: "vat123" }],
					},
				});

			const contacts = await adapter.contacts.fetch();
			expect(contacts).toHaveLength(2);
			expect(contacts[0]!.type).toBe("CUSTOMER");
			expect(contacts[0]!.email).toBe("c@c.c");
			expect(contacts[1]!.type).toBe("SUPPLIER");
			expect(contacts[1]!.vatNumber).toBe("vat123");
		});
	});

	describe("Accounts", () => {
		it("should fetch and properly categorize accounts", async () => {
			mockApiGet.mockResolvedValueOnce({
				data: {
					collection: [
						{ accountNumber: 1000, name: "Sales", accountType: "profitAndLoss" },
						{ accountNumber: 4000, name: "Consulting Expense", accountType: "profitAndLoss" },
						{ accountNumber: 5500, name: "Bank", accountType: "status" },
						{ accountNumber: 8000, name: "Loan", accountType: "status" },
					],
				},
			});

			const accounts = await adapter.accounts.fetch();
			expect(accounts).toHaveLength(4);
			expect(accounts[0]!.type).toBe("REVENUE");
			expect(accounts[1]!.type).toBe("EXPENSE");
			expect(accounts[2]!.type).toBe("ASSET");
			expect(accounts[3]!.type).toBe("LIABILITY");
		});
	});
});
