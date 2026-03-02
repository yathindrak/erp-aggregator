import type { IErpAdapterPlugin } from "./base";
import { TripletexAdapter } from "./tripletex";
import { XeroAdapter } from "./xero";
import { EconomicAdapter } from "./economic";

// To add a new erp, just add its factory here
const ADAPTER_FACTORIES: Record<string, () => IErpAdapterPlugin<any>> = {
	tripletex: () => new TripletexAdapter(),
	xero: () => new XeroAdapter(),
	economic: () => new EconomicAdapter(),
};

export class AdapterRegistry {
	constructor(
		private factories: Record<
			string,
			() => IErpAdapterPlugin<any>
		> = ADAPTER_FACTORIES,
	) { }

	getAvailableAdaptersMetadata() {
		return Object.values(this.factories).map((factory) => {
			const instance = factory();
			return instance.metadata;
		});
	}

	// Create a fresh un-authenticated adapter instance for a given ERP
	create(erpName: string): IErpAdapterPlugin<any> {
		const factory = this.factories[erpName];
		if (!factory) {
			throw new Error(
				`Unsupported ERP: "${erpName}". Available: ${Object.keys(this.factories).join(", ")}`,
			);
		}
		return factory();
	}

	supports(erpName: string): boolean {
		return erpName in this.factories;
	}
}

export const adapterRegistry = new AdapterRegistry();
