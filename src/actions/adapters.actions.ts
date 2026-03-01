"use server";

import { actionClient } from "@/lib/safe-action";
import { adapterRegistry } from "@/lib/erp/adapters/AdapterRegistry";

export const getAdapters = actionClient.action(async () => {
	return adapterRegistry.getAvailableAdaptersMetadata();
});
