export type InvoiceStatus = "DRAFT" | "UNPAID" | "PAID" | "OVERDUE" | "VOIDED";

export type InvoiceType = "AR" | "AP";

export interface CanonicalInvoice {
	id: string;
	type: InvoiceType;
	status: InvoiceStatus;
	issueDate: string;
	dueDate: string;
	currency: string;
	totalAmount: number;
	openAmount: number; // Outstanding amount
	// Maps to either a Customer ID (for AR invoices) or a Supplier ID (for AP invoices).
	contactId: string;
}

export type ContactType = "CUSTOMER" | "SUPPLIER" | "BOTH";

export interface CanonicalContact {
	id: string;
	name: string;
	type: ContactType;
	email?: string;
	phone?: string;
	vatNumber?: string;
	address?: CanonicalAddress;
}

export interface CanonicalAddress {
	street: string;
	city: string;
	postalCode: string;
	countryCode: string;
}

export type AccountType =
	| "ASSET"
	| "LIABILITY"
	| "EQUITY"
	| "REVENUE"
	| "EXPENSE";

export interface CanonicalAccount {
	id: string;
	code: string; // Nominal code like "3000" or "4000"
	name: string;
	type: AccountType;
	isActive: boolean;
}

export interface CanonicalJournalEntry {
	id: string;
	date: string;
	description: string;
	voucherType?: string | null;
	lines: CanonicalJournalLine[];
}

export interface CanonicalJournalLine {
	accountId: string; // Maps to canonical account id
	amount: number; // Positive for Debit, Negative for Credit
	taxAmount?: number;
}

export interface CanonicalPayment {
	id: string;
	date: string;
	amount: number;
	currency: string;
	invoiceId?: string; // Optional link to an invoice
	bankAccountId?: string; // Optional link to a bank account
}

export interface CanonicalProduct {
	id: string;
	name: string;
	code?: string;
	description?: string;
	unitPrice?: number;
	currency?: string;
}

