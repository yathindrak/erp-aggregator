export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { env } from '@/env';

const XERO_AUTHORIZE_URL = 'https://login.xero.com/identity/connect/authorize';
const XERO_SCOPES = 'openid profile email offline_access accounting.transactions accounting.journals.read accounting.reports.read accounting.contacts accounting.settings.read';

function toBase64Url(buffer: Buffer): string {
    return buffer
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function createPkcePair(): { verifier: string; challenge: string } {
    const verifier = toBase64Url(crypto.randomBytes(64));
    const challenge = toBase64Url(crypto.createHash('sha256').update(verifier).digest());
    return { verifier, challenge };
}

export async function GET(request: Request): Promise<NextResponse> {
    const { searchParams } = new URL(request.url);
    const clientIdParam = searchParams.get('clientId');

    if (!clientIdParam) {
        return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    const clientId = env.XERO_CLIENT_ID;

    const APP_URL = env.APP_URL;
    const XERO_REDIRECT_URI = `${APP_URL}/api/integrations/xero/callback`;

    const csrfToken = toBase64Url(crypto.randomBytes(24));
    const { verifier, challenge } = createPkcePair();
    const statePayload = {
        clientId: clientIdParam,
        csrf: csrfToken,
        codeVerifier: verifier
    };
    const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url');

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: String(clientId),
        redirect_uri: XERO_REDIRECT_URI,
        scope: XERO_SCOPES,
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256'
    });

    const authorizeUrl = `${XERO_AUTHORIZE_URL}?${params.toString()}`;
    return NextResponse.redirect(authorizeUrl);
}
