import { describe, it, expect, vi } from "vitest";
import { AdapterRegistry } from "./AdapterRegistry";
import { TripletexAdapter } from "./tripletex";
import { XeroAdapter } from "./xero";

vi.mock("@/env", () => ({
    env: {},
}));

describe("AdapterRegistry", () => {
    it("should map available adapters correctly", () => {
        const registry = new AdapterRegistry({
            testERP: () => new XeroAdapter(),
            otherERP: () => new TripletexAdapter(),
        } as any);

        const metadata = registry.getAvailableAdaptersMetadata();
        expect(metadata).toHaveLength(2);
        expect(metadata[0]!.id).toBe("xero");
        expect(metadata[1]!.id).toBe("tripletex");
    });

    it("should create supported adapter", () => {
        const registry = new AdapterRegistry({
            testERP: () => new XeroAdapter(),
        } as any);

        const adapter = registry.create("testERP");
        expect(adapter).toBeInstanceOf(XeroAdapter);
    });

    it("should throw error for unsupported adapter", () => {
        const registry = new AdapterRegistry({
            testERP: () => new XeroAdapter(),
        } as any);

        expect(() => registry.create("invalidERP")).toThrow(
            'Unsupported ERP: "invalidERP"',
        );
    });

    it("should check if adapter is supported", () => {
        const registry = new AdapterRegistry({
            testERP: () => new XeroAdapter(),
        } as any);

        expect(registry.supports("testERP")).toBe(true);
        expect(registry.supports("invalidERP")).toBe(false);
    });
});
