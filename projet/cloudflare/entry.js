// Point d'entrée Cloudflare Workers (hors de la plateforme Sites).
//
// Le code du prototype lit l'identité dans les en-têtes oai-authenticated-user-*,
// que Sites remplissait lui-même. Ici, ces en-têtes viendraient du navigateur et
// pourraient être falsifiés : on les supprime systématiquement, puis on les
// recrée uniquement à partir d'un jeton Cloudflare Access vérifié
// (signature RS256, audience, émetteur, expiration).
//
// Variables à définir dans Cloudflare :
//   ACCESS_TEAM_DOMAIN  ex. "mon-equipe.cloudflareaccess.com" (ou l'URL « JWKS » complète)
//   ACCESS_AUD          « AUD tag » de l'application Access (plusieurs : séparés par des virgules)
//   NZOZI_ALLOWED_EMAILS adresses des partenaires autorisés, séparées par des virgules
import worker from '../dist/server/index.js';

const IDENTITY_HEADERS = ['oai-authenticated-user-id', 'oai-authenticated-user-email'];
const CERTS_TTL_MS = 60 * 60 * 1000;
let certsCache = { url: '', keys: null, at: 0 };

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}
function decodeJson(part) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)));
}
function readToken(request) {
  const header = request.headers.get('cf-access-jwt-assertion');
  if (header) return header;
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return match ? match[1] : '';
}
async function accessKeys(teamDomain, fetcher) {
  const url = `https://${teamDomain}/cdn-cgi/access/certs`;
  if (certsCache.url === url && certsCache.keys && Date.now() - certsCache.at < CERTS_TTL_MS) return certsCache.keys;
  const response = await fetcher(url);
  if (!response.ok) throw new Error('Certificats Access indisponibles');
  const { keys } = await response.json();
  certsCache = { url, keys, at: Date.now() };
  return keys;
}

export async function verifyAccessToken(token, env, fetcher = fetch) {
  // Accepte « equipe.cloudflareaccess.com » ou l'URL JWKS complète copiée depuis le tableau de bord.
  const teamDomain = (env.ACCESS_TEAM_DOMAIN || '').trim().replace(/^https?:\/\//, '').split('/')[0];
  // Plusieurs applications Access possibles (workers.dev et mon-nzonzi.fr) : AUD séparés par des virgules.
  const allowedAudiences = (env.ACCESS_AUD || '').split(',').map(value => value.trim()).filter(Boolean);
  if (!token || !teamDomain || !allowedAudiences.length) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  let header, payload;
  try { header = decodeJson(parts[0]); payload = decodeJson(parts[1]); } catch { return null; }
  if (header.alg !== 'RS256' || !header.kid) return null;
  const jwk = (await accessKeys(teamDomain, fetcher)).find(key => key.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64UrlToBytes(parts[2]),
    new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!valid) return null;
  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.some(value => allowedAudiences.includes(value))) return null;
  if (payload.iss !== `https://${teamDomain}`) return null;
  if (typeof payload.exp !== 'number' || payload.exp < now) return null;
  if (typeof payload.nbf === 'number' && payload.nbf > now + 60) return null;
  if (!payload.sub || !payload.email) return null;
  return { id: String(payload.sub), email: String(payload.email).toLowerCase() };
}

export async function withVerifiedIdentity(request, env, fetcher = fetch) {
  const headers = new Headers(request.headers);
  for (const name of IDENTITY_HEADERS) headers.delete(name);
  let identity = null;
  try { identity = await verifyAccessToken(readToken(request), env, fetcher); } catch { identity = null; }
  if (identity) {
    headers.set('oai-authenticated-user-id', identity.id);
    headers.set('oai-authenticated-user-email', identity.email);
  }
  return new Request(request, { headers });
}

export default {
  async fetch(request, env, ctx) {
    return worker.fetch(await withVerifiedIdentity(request, env), env, ctx);
  },
  // Tâche planifiée (wrangler.toml) : invitations des familles à donner leur avis.
  async scheduled(event, env, ctx) {
    return worker.scheduled(event, env, ctx);
  },
};
