export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import axios from 'axios';
import { connectionManager } from '@/lib/erp/ConnectionManager';
import { env } from '@/env';

const APP_URL = env.APP_URL;
const XERO_REDIRECT_URI = `${APP_URL}/api/integrations/xero/callback`;
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token';
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections';

const SUCCESS_PATH = '/connections?xero_status=success';
const FAILURE_PATH = '/connections?xero_status=failure';

type XeroStatePayload = {
    clientId: string;
    csrf: string;
    codeVerifier: string;
};

function createRedirect(path: string, params?: Record<string, string | undefined>) {
    const url = new URL(path, APP_URL);
    if (params) {
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, value);
            }
        }
    }
    return NextResponse.redirect(url);
}

export async function GET(request: Request): Promise<NextResponse> {
    const { searchParams } = new URL(request.url);
    const errorParam = searchParams.get('error');
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (errorParam) {
        return createRedirect(FAILURE_PATH, { xero_error: errorParam });
    }

    if (!code || !state) {
        return createRedirect(FAILURE_PATH, { xero_error: 'missing_params' });
    }

    let statePayload: XeroStatePayload;
    try {
        statePayload = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8')) as XeroStatePayload;
        if (!statePayload?.clientId || !statePayload?.codeVerifier) {
            throw new Error('state missing required fields');
        }
    } catch (error) {
        console.error('[xeroOAuth] failed to decode state', error);
        return createRedirect(FAILURE_PATH, { xero_error: 'invalid_state' });
    }

    const { clientId, codeVerifier } = statePayload;

    const appClientId = env.XERO_CLIENT_ID;
    const clientSecret = env.XERO_CLIENT_SECRET;

    try {
        const tokenParams = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: XERO_REDIRECT_URI,
            client_id: appClientId,
            client_secret: clientSecret,
            code_verifier: codeVerifier
        });

        const tokenResponse = await axios.post(
            XERO_TOKEN_URL,
            tokenParams.toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const tokenData = tokenResponse.data ?? {};
        const accessToken: string = tokenData.access_token;
        const refreshToken: string = tokenData.refresh_token;

        if (!accessToken || !refreshToken) {
            console.error('[xeroOAuth] missing tokens', tokenData);
            return createRedirect(FAILURE_PATH, { xero_error: 'token_exchange_failed' });
        }

        const expiresInSeconds = tokenData.expires_in || 1800;
        const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

        // Fetch the connected tenant
        const connectionsResponse = await axios.get(XERO_CONNECTIONS_URL, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json'
            }
        });
        const connections: Array<{ id?: string; tenantId?: string }> = Array.isArray(
            connectionsResponse.data
        )
            ? connectionsResponse.data
            : [];

        if (!connections.length || !connections[0]) {
            console.error('[xeroOAuth] no connections returned');
            return createRedirect(FAILURE_PATH, { xero_error: 'no_connections' });
        }

        const xeroTenantId = connections[0].tenantId;

        if (!xeroTenantId) {
            return createRedirect(FAILURE_PATH, { xero_error: 'missing_tenant_id' });
        }

        const credentials = {
            accessToken,
            refreshToken,
            expiresAt,
            tenantId: xeroTenantId
        };

        await connectionManager.connectErp(clientId, 'xero', credentials);

        return createRedirect(SUCCESS_PATH);
    } catch (error) {
        console.error('[xeroOAuth] callback error', error);
        return createRedirect(FAILURE_PATH, { xero_error: 'oauth_failed' });
    }
}
