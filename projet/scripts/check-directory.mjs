import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../dist/server/index.js';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../drizzle/0001_demo_requests.sql', import.meta.url), 'utf8'));
const env = {
  NZOZI_ALLOWED_EMAILS: 'partner@example.test',
  SHOW_DEMO_PROFILES: 'true',
  DB: { prepare(sql) {
    const statement = db.prepare(sql);
    return { bind(...args) { return {
      first: () => statement.get(...args),
      all: () => ({ results: statement.all(...args) }),
      run: () => statement.run(...args),
    }; } };
  } },
};
const origin = 'https://prototype.example.test';
const owner = { 'oai-authenticated-user-id': 'owner', 'oai-authenticated-user-email': 'partner@example.test' };
const family = { 'oai-authenticated-user-id': 'family', 'oai-authenticated-user-email': 'family@example.test' };
const visit = (path, init) => worker.fetch(new Request(new URL(path, origin), init), env);
const html = async (path, headers) => (await visit(path, { headers })).text();

// Sans le drapeau de démonstration, aucun profil fictif n'est publié.
const publicEnv = { ...env, SHOW_DEMO_PROFILES: undefined };
const publicHome = await (await worker.fetch(new Request(new URL('/', origin)), publicEnv)).text();
assert.match(publicHome, /Les premiers nzonzi arrivent bientôt/);
assert.doesNotMatch(publicHome, /Jean Mavungu|Patrick Ilunga|André Mbuyi/);
assert.equal((await worker.fetch(new Request(new URL('/nzonzi/jean-mavungu', origin)), publicEnv)).status, 404);

const home = await html('/');
assert.match(home, /3 profils trouvés/);
assert.doesNotMatch(home, /net-slider/);
assert.match(await html('/?q=andre'), /1 profil trouvé/);
assert.match(await html('/?q=saint+denis&region=%C3%8Ele-de-France&communaute=Kongo'), /Jean Mavungu/);
assert.match(await html('/?region=Hauts-de-France&communaute=Kongo'), /Aucun profil/);
assert.doesNotMatch(await html('/?q=%3Cimg%20onerror%3Dx%3E'), /<img onerror=x>/);
assert.equal((await visit('/nzonzi/inconnu')).status, 404);
assert.equal((await visit('/partenaire', { headers: family })).status, 403);

const slug = '/nzonzi/jean-mavungu';
assert.match(home, /class="motion-scene"/);
assert.match(home, /Rejouer l’animation/);
assert.match(home, /<img class="brand-logo" src="\/assets\/mon-nzonzi\.webp" alt="Mon Nzonzi"/);
const logo = await visit('/assets/mon-nzonzi.webp');
assert.equal(logo.headers.get('Content-Type'), 'image/webp');
assert.equal(new TextDecoder().decode((await logo.arrayBuffer()).slice(8, 12)), 'WEBP');
assert.match(await html('/partenaire'), /class="brand-logo"/);
assert.match(home, /prefers-reduced-motion:reduce/);
assert.doesNotMatch(home, /\/illustrations\/(?:rencontre|jean-mavungu|patrick-ilunga|andre-mbuyi)\.webp/);
assert.equal((await visit('/illustrations/jean-mavungu.webp')).status, 404);
const font = await visit('/assets/playfair-display.woff2');
assert.equal(font.headers.get('Content-Type'), 'font/woff2');
assert.equal(new TextDecoder().decode((await font.arrayBuffer()).slice(0, 4)), 'wOF2');
assert.match(await html('/assets/playfair-license.txt'), /SIL OPEN FONT LICENSE/);
const fiche = await html(slug + '?communaute=Kongo');
assert.match(fiche, /data-motion-profile="jean-mavungu"/);
assert.match(fiche, /300\s*€/);
assert.match(fiche, /href="\/\?communaute=Kongo#nzonzi"/);
const reference = fiche.match(/name="reference" value="([^"]+)"/)[1];

const data = { reference, ville: 'Saint-Ouen', date: '2026-12-12', message: 'Demande fictive <test> $&' };
const send = (body, identity = owner, source = origin) => visit(slug, {
  method: 'POST', headers: { ...identity, Origin: source }, body: new URLSearchParams(body),
});
assert.equal((await send(data, {})).status, 401);
assert.equal((await send(data, owner, 'https://autre.test')).status, 403);
assert.equal((await send({ ...data, date: '2026-02-31' })).status, 400);
const submitted = await send(data);
assert.equal(submitted.status, 303);
const receipt = submitted.headers.get('Location');
assert.match(await html(receipt, owner), /Demande de démonstration enregistrée/);
assert.doesNotMatch(await html(receipt, family), /Demande de démonstration enregistrée/);
assert.equal((await send(data)).status, 303);
assert.equal(db.prepare('SELECT COUNT(*) AS count FROM demo_requests').get().count, 1);
const inbox = await html('/partenaire', owner);
assert.match(inbox, /Saint-Ouen/);
assert.match(inbox, /Demande fictive &lt;test&gt; \$&amp;/);
assert.match(inbox, /id="net"/);
const outfit = await visit('/assets/outfit.woff2');
assert.equal(outfit.headers.get('Content-Type'), 'font/woff2');
assert.match(await html('/assets/outfit-license.txt'), /SIL Open Font License/);
assert.match(home, /Vous êtes nzonzi/);
console.log('Répertoire, filtres combinés, animations, police, tarif, demande, reçu, protection et boîte de démo : OK.');
