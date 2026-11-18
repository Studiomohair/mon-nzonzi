// Contrôle de l'authentification Cloudflare Access (cloudflare/entry.js).
import assert from 'node:assert/strict';
import { verifyAccessToken, withVerifiedIdentity } from '../cloudflare/entry.js';

const team = 'equipe-test.cloudflareaccess.com';
const env = { ACCESS_TEAM_DOMAIN: team, ACCESS_AUD: 'aud-test' };
const b64 = data => Buffer.from(typeof data === 'string' ? data : JSON.stringify(data)).toString('base64url');
const { privateKey, publicKey } = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const other = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'k1' };
let certCalls = 0;
const fetcher = async url => { certCalls++; assert.equal(url, `https://${team}/cdn-cgi/access/certs`); return new Response(JSON.stringify({ keys: [jwk] })); };
const now = Math.floor(Date.now() / 1000);
async function sign(payload, key = privateKey, header = { alg: 'RS256', kid: 'k1' }) {
  const data = b64(header) + '.' + b64(payload);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(data));
  return data + '.' + Buffer.from(sig).toString('base64url');
}
const good = { aud: ['aud-test'], iss: `https://${team}`, sub: 'user-1', email: 'Partner@Example.test', exp: now + 600, iat: now };

assert.deepEqual(await verifyAccessToken(await sign(good), env, fetcher), { id: 'user-1', email: 'partner@example.test' });
assert.equal(await verifyAccessToken(await sign({ ...good, aud: ['autre'] }), env, fetcher), null, 'audience');
assert.equal(await verifyAccessToken(await sign({ ...good, iss: 'https://pirate.example' }), env, fetcher), null, 'émetteur');
assert.equal(await verifyAccessToken(await sign({ ...good, exp: now - 5 }), env, fetcher), null, 'expiré');
assert.equal(await verifyAccessToken(await sign(good, other.privateKey), env, fetcher), null, 'mauvaise signature');
assert.equal(await verifyAccessToken(await sign(good, privateKey, { alg: 'none', kid: 'k1' }), env, fetcher), null, 'alg none');
assert.equal(await verifyAccessToken(await sign(good), {}, fetcher), null, 'configuration absente');
assert.deepEqual(await verifyAccessToken(await sign(good),
  { ...env, ACCESS_TEAM_DOMAIN: `https://${team}/cdn-cgi/access/certs` }, fetcher), { id: 'user-1', email: 'partner@example.test' }, 'URL JWKS complète');
assert.equal(await verifyAccessToken('pas.un.jeton', env, fetcher), null);
assert.equal(certCalls, 1, 'certificats mis en cache');

// Les en-têtes d'identité envoyés par le navigateur sont toujours supprimés.
const forged = await withVerifiedIdentity(new Request('https://site.test/partenaire', {
  headers: { 'oai-authenticated-user-id': 'pirate', 'oai-authenticated-user-email': 'partner@example.test' } }), env, fetcher);
assert.equal(forged.headers.get('oai-authenticated-user-id'), null);
assert.equal(forged.headers.get('oai-authenticated-user-email'), null);

// Un jeton valide (en-tête ou cookie) remplace l'identité.
const viaHeader = await withVerifiedIdentity(new Request('https://site.test/', {
  headers: { 'cf-access-jwt-assertion': await sign(good), 'oai-authenticated-user-id': 'pirate' } }), env, fetcher);
assert.equal(viaHeader.headers.get('oai-authenticated-user-id'), 'user-1');
assert.equal(viaHeader.headers.get('oai-authenticated-user-email'), 'partner@example.test');
const viaCookie = await withVerifiedIdentity(new Request('https://site.test/', {
  headers: { cookie: 'a=b; CF_Authorization=' + await sign(good) } }), env, fetcher);
assert.equal(viaCookie.headers.get('oai-authenticated-user-id'), 'user-1');

// Le corps d'une requête POST est conservé.
const post = await withVerifiedIdentity(new Request('https://site.test/api/profil', { method: 'POST', body: 'x=1' }), env, fetcher);
assert.equal(await post.text(), 'x=1');

console.log('check-access: OK');
