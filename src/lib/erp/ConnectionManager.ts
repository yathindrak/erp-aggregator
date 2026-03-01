import { isAfter } from "date-fns";
import type { PrismaClient } from "../../../generated/prisma";
import { db } from "@/server/db";
import {
	adapterRegistry,
	type AdapterRegistry,
} from "./adapters/AdapterRegistry";
import type { IErpAdapterPlugin } from "./adapters/base";
import { decryptBlob, encryptBlob } from "./encryption-service";

type ErpCredentialInput = {
	expiresAt?: string | number | Date;
	accessToken?: string;
	[key: string]: unknown;
};

export class ConnectionManager {
	constructor(
		private db: PrismaClient,
		private registry: AdapterRegistry,
	) {}

	/**
	 * Persist (or update) an ERP connection for a client.
	 */
	async connectErp(
		clientId: string,
		erpName: string,
		credentials: ErpCredentialInput,
	) {
		if (!this.registry.supports(erpName)) {
			throw new Error(`Unsupported ERP: "${erpName}"`);
		}

		// We enforce that a client can only be connected to max 1 ERP at a time for simplicity.
		const existingConnections = await this.getAllConnections(clientId);
		if (existingConnections.length > 0) {
			const hasOtherErp = existingConnections.some(
				(c) => c.erpName !== erpName,
			);
			if (hasOtherErp) {
				const connectedErpName = existingConnections[0]?.erpName;
				throw new Error(
					`Client is already connected to ${connectedErpName}. A client can only have one active ERP connection.`,
				);
			}
		}

		const adapter = this.registry.create(erpName);

		const finalCredentials = { ...credentials };

		try {
			const newToken = await adapter.auth.authenticate(credentials);
			if (newToken && typeof newToken === "string") {
				finalCredentials.accessToken = newToken;
			}
		} catch (e: unknown) {
			const error = e as { message?: string };
			throw new Error(
				`Failed to authenticate with ${erpName}: ${error.message || "invalid credentials"}`,
			);
		}

		const encryptedCredentials = encryptBlob(finalCredentials);

		return this.db.connection.upsert({
			where: { clientId_erpName: { clientId, erpName } },
			update: {
				credentials: encryptedCredentials
					? JSON.stringify(encryptedCredentials)
					: undefined,
				tokenExpiresAt: credentials.expiresAt
					? new Date(credentials.expiresAt)
					: null,
			},
			create: {
				clientId,
				erpName,
				credentials: encryptedCredentials
					? JSON.stringify(encryptedCredentials)
					: undefined,
				tokenExpiresAt: credentials.expiresAt
					? new Date(credentials.expiresAt)
					: null,
			},
		});
	}

	async getConnection(clientId: string, erpName: string) {
		return this.db.connection.findUnique({
			where: { clientId_erpName: { clientId, erpName } },
		});
	}

	async getAllConnections(clientId: string) {
		return this.db.connection.findMany({ where: { clientId } });
	}

	async deleteConnection(clientId: string, erpName: string) {
		return this.db.connection.delete({
			where: { clientId_erpName: { clientId, erpName } },
		});
	}

	/**
	 * Resolve & authenticate an adapter for a given client.
	 */
	async getAdapter(
		clientId: string,
		erpName: string,
	): Promise<IErpAdapterPlugin> {
		const connection = await this.getConnection(clientId, erpName);

		if (!connection) {
			throw new Error(
				`No ERP connection found for client "${clientId}"${erpName ? ` (ERP: ${erpName})` : ""}. ` +
					`Please set up a connection first.`,
			);
		}

		if (
			connection.tokenExpiresAt &&
			isAfter(new Date(), connection.tokenExpiresAt)
		) {
			throw new Error(
				`Token for ${connection.erpName} has expired. Please reconnect your ${connection.erpName} account.`,
			);
		}

		const adapter = this.registry.create(connection.erpName);

		let credentials: Record<string, unknown> = {};
		if (connection.credentials) {
			const rawBlob =
				typeof connection.credentials === "string"
					? JSON.parse(connection.credentials)
					: { ...(connection.credentials as Record<string, unknown>) };

			// Decrypt from the database storage vault securely
			credentials = (decryptBlob(rawBlob) as Record<string, unknown>) || {};
		}

		const newToken = await adapter.auth.authenticate(credentials);

		if (
			newToken &&
			typeof newToken === "string" &&
			newToken !== credentials.accessToken
		) {
			credentials.accessToken = newToken;

			// Re-encrypt updated tokens before database insert
			const reEncrypted = encryptBlob(credentials);
			await this.db.connection.update({
				where: { id: connection.id },
				data: {
					credentials: reEncrypted ? JSON.stringify(reEncrypted) : undefined,
				},
			});
		}

		return adapter;
	}
}

export const connectionManager = new ConnectionManager(
	db as unknown as PrismaClient,
	adapterRegistry,
);
