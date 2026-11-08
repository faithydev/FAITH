/**
 * Sign in with Apple, server side. Apple needs four values from an Apple Developer account
 * (paid membership): a Services ID (APPLE_CLIENT_ID), the Team ID, a key ID and that key's
 * private .p8 key. Without all four the provider stays off and its button stays disabled.
 *
 * Flow: authorize with response_mode=form_post, exchange the code with a short-lived ES256
 * client secret, then verify Apple's id_token against Apple's published keys before trusting it.
 */
import { createPublicKey, sign, verify, type JsonWebKey } from 'node:crypto';
import { env } from '../core/env';

const ISSUER = 'https://appleid.apple.com';

export const appleConfigured = () => !!(env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY);

const b64url = (data: Buffer | string) => Buffer.from(data).toString('base64url');

/** The private key may arrive with literal "\n" sequences from a hosting dashboard. */
const privateKey = () => env.APPLE_PRIVATE_KEY!.replace(/\\n/g, '\n');

export function appleAuthorizeUrl(redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: env.APPLE_CLIENT_ID!, redirect_uri: redirectUri, response_type: 'code',
    response_mode: 'form_post', scope: 'name email', state,
  });
  return `${ISSUER}/auth/authorize?${q}`;
}

/** Apple's client secret is a JWT signed with the developer's ES256 key, valid for minutes here. */
function clientSecret(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: env.APPLE_KEY_ID }));
  const payload = b64url(JSON.stringify({ iss: env.APPLE_TEAM_ID, iat: now, exp: now + 300, aud: ISSUER, sub: env.APPLE_CLIENT_ID }));
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), { key: privateKey(), dsaEncoding: 'ieee-p1363' });
  return `${header}.${payload}.${b64url(signature)}`;
}

type AppleClaims = { iss: string; aud: string; exp: number; sub: string; email?: string; email_verified?: boolean | string };

async function verifyIdToken(idToken: string): Promise<AppleClaims> {
  const [h, p, s] = idToken.split('.');
  if (!h || !p || !s) throw new Error('malformed id_token');
  const header = JSON.parse(Buffer.from(h, 'base64url').toString()) as { kid: string; alg: string };
  if (header.alg !== 'RS256') throw new Error('unexpected id_token algorithm');
  const keys = (await (await fetch(`${ISSUER}/auth/keys`)).json()) as { keys: (JsonWebKey & { kid: string })[] };
  const jwk = keys.keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('unknown signing key');
  const ok = verify('RSA-SHA256', Buffer.from(`${h}.${p}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(s, 'base64url'));
  if (!ok) throw new Error('bad id_token signature');
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString()) as AppleClaims;
  if (claims.iss !== ISSUER || claims.aud !== env.APPLE_CLIENT_ID || claims.exp * 1000 < Date.now()) throw new Error('id_token claims rejected');
  return claims;
}

/** Exchanges the authorization code and returns the verified identity. */
export async function appleIdentity(code: string, redirectUri: string): Promise<{ sub: string; email: string; emailVerified: boolean }> {
  const res = await fetch(`${ISSUER}/auth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.APPLE_CLIENT_ID!, client_secret: clientSecret(), code, grant_type: 'authorization_code', redirect_uri: redirectUri }),
  });
  if (!res.ok) throw new Error(`apple token exchange failed: ${res.status}`);
  const { id_token } = (await res.json()) as { id_token: string };
  const claims = await verifyIdToken(id_token);
  return { sub: claims.sub, email: claims.email ?? '', emailVerified: claims.email_verified === true || claims.email_verified === 'true' };
}
