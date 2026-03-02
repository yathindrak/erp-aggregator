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
	) { }

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

		const existing = await this.db.connection.findUnique({
			where: { clientId },
		});

		if (existing && existing.erpName !== erpName) {
			await this.db.connection.delete({ where: { clientId } });
		}

		const adapter = this.registry.create(erpName);

		const finalCredentials = { ...credentials };

		try {
			const newToken = await adapter.auth.authenticate(credentials);
			if (newToken) {
				if (typeof newToken === "string") {
					finalCredentials.accessToken = newToken;
				} else if (typeof newToken === "object") {
					Object.assign(finalCredentials, newToken);
				}
			}
		} catch (e: unknown) {
			const error = e as { message?: string };
			throw new Error(
				`Failed to authenticate with ${erpName}: ${error.message || "invalid credentials"}`,
			);
		}

		const encryptedCredentials = encryptBlob(finalCredentials);

		return this.db.connection.upsert({
			where: { clientId },
			update: {
				erpName,
				credentials: encryptedCredentials
					? JSON.stringify(encryptedCredentials)
					: undefined,
				reauthRequired: false,
				tokenExpiresAt: finalCredentials.expiresAt
					? new Date(finalCredentials.expiresAt as string | number | Date)
					: null,
			},
			create: {
				clientId,
				erpName,
				credentials: encryptedCredentials
					? JSON.stringify(encryptedCredentials)
					: undefined,
				reauthRequired: false,
				tokenExpiresAt: finalCredentials.expiresAt
					? new Date(finalCredentials.expiresAt as string | number | Date)
					: null,
			},
		});
	}

	async getConnection(clientId: string) {
		return this.db.connection.findUnique({
			where: { clientId },
		});
	}

	async getAllConnections(clientId: string) {
		return this.db.connection.findMany({ where: { clientId } });
	}

	async deleteConnection(clientId: string) {
		return this.db.connection.delete({
			where: { clientId },
		});
	}

	/**
	 * Resolve & authenticate an adapter for a given client.
	 */
	async getAdapter(
		clientId: string,
		erpName?: string, // No longer strictly needed but kept for backward compatibility
	): Promise<IErpAdapterPlugin> {
		const connection = await this.getConnection(clientId);

		if (!connection) {
			throw new Error(
				`No ERP connection found for client "${clientId}"${erpName ? ` (ERP: ${erpName})` : ""}. ` +
				`Please set up a connection first.`,
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

		try {
			const newToken = await adapter.auth.authenticate(credentials);

			if (newToken) {
				let needsUpdate = false;
				let newExpiresAt = connection.tokenExpiresAt;

				if (typeof newToken === "string" && newToken !== credentials.accessToken) {
					credentials.accessToken = newToken;
					needsUpdate = true;
				} else if (typeof newToken === "object") {
					Object.assign(credentials, newToken);
					needsUpdate = true;
					if ("expiresAt" in newToken && newToken.expiresAt) {
						newExpiresAt = new Date(newToken.expiresAt as string | number | Date);
					}
				}

				if (needsUpdate || connection.reauthRequired) {
					const reEncrypted = encryptBlob(credentials);
					await this.db.connection.update({
						where: { id: connection.id },
						data: {
							credentials: reEncrypted ? JSON.stringify(reEncrypted) : undefined,
							tokenExpiresAt: newExpiresAt,
							reauthRequired: false, // Reset on successful re-auth
						},
					});
				}
			}
		} catch (e: unknown) {
			// If authentication fails, mark it as needing re-authorization
			await this.db.connection.update({
				where: { id: connection.id },
				data: { reauthRequired: true },
			});
			throw e;
		}

		return adapter;
	}
}

export const connectionManager = new ConnectionManager(
	db as unknown as PrismaClient,
	adapterRegistry,
);
