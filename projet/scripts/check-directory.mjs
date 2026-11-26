// Annuaire public, filtres, fiches, ressources et pages légales (sans profils fictifs).
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { createTestDb } from './d1-test-db.mjs';

const { db, DB } = createTestDb();
const publish = (id, slug, data) => db.prepare("INSERT INTO nzozi_profiles (user_id, profile_json, updated_at, email, status, published_json, slug, reviewed_at) VALUES (?, ?, ?, ?, 'approved', ?, ?, ?)")
  .run(id, JSON.stringify(data), '2026-11-20T10:00:00.000Z', id + '@example.test', JSON.stringify(data), slug, '2026-11-20T10:00:00.000Z');
const base = { contactEmail: 'prive@example.test', phone: '0600000000', bio: 'J’accompagne les familles avec patience.', services: 'Préparation\nPrise de parole' };
publish('u1', 'jean-mavungu', { ...base, firstName: 'Jean', lastName: 'Mavungu', city: 'Saint-Denis', region: 'Île-de-France', languages: 'français, lingala, kikongo', community: 'Kongo', rate: '255' });
publish('u2', 'andre-mbuyi', { ...base, firstName: 'André', lastName: 'Mbuyi', city: 'Lille', region: 'Hauts-de-France', languages: 'français, lingala', community: 'Mongo', rate: '170' });
const env = { DB, NZOZI_ALLOWED_EMAILS: 'partner@example.test' };
const origin = 'https://prototype.example.test';
const visit = (path, init, e = env) => worker.fetch(new Request(new URL(path, origin), init), e);
const html = async (path, headers) => (await visit(path, { headers })).text();

// Sans base ni profil validé : message d'attente, aucun ancien profil fictif.
const empty = await (await visit('/', {}, {})).text();
assert.match(empty, /Les premiers nzonzi arrivent bientôt/);
assert.equal((await visit('/presentation')).status, 404);

const home = await html('/');
assert.match(home, /2 profils trouvés/);
assert.doesNotMatch(home, /démo|démonstration|fictif|Prototype privé/i);
assert.doesNotMatch(home, /net-slider|prive@example\.test|0600000000/);
assert.match(await html('/?q=andre'), /1 profil trouvé/);
assert.match(await html('/?q=saint+denis&region=%C3%8Ele-de-France&communaute=Kongo'), /Jean Mavungu/);
assert.match(await html('/?region=Hauts-de-France&communaute=Kongo'), /Aucun profil/);
assert.doesNotMatch(await html('/?q=%3Cimg%20onerror%3Dx%3E'), /<img onerror=x>/);
assert.equal((await visit('/nzonzi/inconnu')).status, 404);
assert.equal((await visit('/partenaire', { headers: { 'oai-authenticated-user-id': 'family', 'oai-authenticated-user-email': 'family@example.test' } })).status, 403);

// Fiche : prix total, retour filtré, pas de coordonnées privées, pas de formulaire sans Brevo.
const fiche = await html('/nzonzi/jean-mavungu?communaute=Kongo');
assert.match(fiche, /data-motion-profile="jean-mavungu"/);
assert.match(fiche, /300\s*€/);
assert.match(fiche, /href="\/\?communaute=Kongo#nzonzi"/);
assert.match(fiche, /La prise de contact en ligne ouvre très bientôt/);
assert.doesNotMatch(fiche, /<form method="post"|prive@example\.test|0600000000|démonstration/);
assert.equal((await visit('/nzonzi/jean-mavungu', { method: 'POST', headers: { Origin: origin } })).status, 405);

// Ressources, animations, logo, polices, favicon, Instagram.
assert.match(home, /class="motion-scene"/);
assert.match(home, /Rejouer l’animation/);
assert.match(home, /prefers-reduced-motion:reduce/);
assert.match(home, /<img class="brand-logo" src="\/assets\/mon-nzonzi\.webp" alt="Mon Nzonzi"/);
assert.match(home, /src="\/assets\/mon-nzonzi-clair\.webp"/);
const logo = await visit('/assets/mon-nzonzi.webp');
assert.equal(logo.headers.get('Content-Type'), 'image/webp');
assert.equal(new TextDecoder().decode((await logo.arrayBuffer()).slice(8, 12)), 'WEBP');
assert.match(await html('/partenaire', { 'oai-authenticated-user-id': 'p', 'oai-authenticated-user-email': 'partner@example.test' }), /class="brand-logo"/);
const font = await visit('/assets/playfair-display.woff2');
assert.equal(font.headers.get('Content-Type'), 'font/woff2');
assert.match(await html('/assets/playfair-license.txt'), /SIL OPEN FONT LICENSE/);
const outfit = await visit('/assets/outfit.woff2');
assert.equal(outfit.headers.get('Content-Type'), 'font/woff2');
assert.equal(new TextDecoder().decode((await outfit.arrayBuffer()).slice(0, 4)), 'wOF2');
assert.match(await html('/assets/outfit-license.txt'), /SIL Open Font License/);
assert.equal((await visit('/assets/favicon.png')).headers.get('Content-Type'), 'image/png');
assert.match(home, /rel="icon"/);
assert.match(home, /Vous êtes nzonzi/);
assert.match(home, /href="https:\/\/www\.instagram\.com\/monnzonzi\/"/);

// Pages légales, liées depuis le pied de page de chaque page.
for (const [path, title] of [['/mentions-legales', 'Mentions légales'], ['/confidentialite', 'Politique de confidentialité'], ['/cgu', 'Conditions d’utilisation']]) {
  const response = await visit(path);
  assert.equal(response.status, 200, path);
  const page = await response.text();
  assert.match(page, new RegExp('<h1>' + title + '</h1>'));
  assert.match(home, new RegExp('href="' + path + '"'));
  assert.match(fiche, new RegExp('href="' + path + '"'));
  assert.equal((await visit(path, { method: 'POST' })).status, 405);
}
const mentions = await html('/mentions-legales');
assert.match(mentions, /SIRET à compléter/);
assert.match(mentions, /<dt>SIREN<\/dt><dd>882 137 425<\/dd>/);
assert.match(mentions, /service édité par MiAgency/);
assert.match(mentions, /<dt>Statut<\/dt><dd>Entrepreneur individuel \(EI\), micro-entreprise<\/dd>/);
assert.match(mentions, /<dd>Sanda MIGUEL EI<\/dd>/);
assert.match(mentions, /Sanda MIGUEL, pour MiAgency/);
assert.match(mentions, /mailto:contact@mon-nzonzi.fr/);
assert.match(mentions, /Adresse à compléter/);
assert.match(mentions, /Cloudflare, Inc\./);
assert.match(await html('/confidentialite'), /CNIL/);
console.log('Annuaire sans profils fictifs, filtres, fiches, ressources et pages légales : OK.');
