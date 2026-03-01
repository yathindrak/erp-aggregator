import CryptoJS from 'crypto-js';
import { env } from '@/env';

export function encrypt(text: string | null | undefined): string | null {
	if (!text) return null;
	return CryptoJS.AES.encrypt(text, env.ENCRYPTION_KEY).toString();
}

export function decrypt(ciphertext: string | null | undefined): string | null {
	if (!ciphertext) return null;

	try {
		const bytes = CryptoJS.AES.decrypt(ciphertext, env.ENCRYPTION_KEY);
		return bytes.toString(CryptoJS.enc.Utf8);
	} catch (e) {
		// Catch cases where the string isn't actually encrypted yet
		return ciphertext;
	}
}

/**
 * Takes a JSON object (like an auth credentials blob) and returns a new object
 * with all the string primitive values encrypted.
 */
export function encryptBlob(data: Record<string, any>): Record<string, any> {
	const encrypted: Record<string, any> = {};
	for (const key of Object.keys(data)) {
		const value = data[key];
		if (typeof value === "string") {
			encrypted[key] = encrypt(value);
		} else {
			encrypted[key] = value;
		}
	}
	return encrypted;
}

/**
 * Takes a JSON object containing encrypted string primitives and decrypts them.
 */
export function decryptBlob(data: Record<string, any> | null): Record<string, any> | null {
	if (!data) return null;
	const decrypted: Record<string, any> = {};
	for (const key of Object.keys(data)) {
		const value = data[key];
		if (typeof value === "string") {
			decrypted[key] = decrypt(value);
		} else {
			decrypted[key] = value;
		}
	}
	return decrypted;
}
