// Avis des familles : invitation après la cérémonie, formulaire, validation admin, affichage.
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { createTestDb } from './d1-test-db.mjs';

const { db, DB } = createTestDb();
const origin = 'https://test.example';
const sent = [];
globalThis.fetch = async (url, init) => {
  assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
  sent.push(JSON.parse(init.body));
  return new Response('{}', { status: 201 });
};
const env = { DB, NZOZI_OPEN_SIGNUP: 'true', NZOZI_ADMIN_EMAILS: 'admin@example.test', BREVO_API_KEY: 'cle-test', BREVO_SENDER_EMAIL: 'contact@mon-nzonzi.fr' };
const who = id => ({ 'oai-authenticated-user-id': id, 'oai-authenticated-user-email': id + '@example.test' });
const api = (path, id, method = 'GET', data, from = origin) => worker.fetch(new Request(origin + path, { method, headers: { ...(id ? who(id) : {}), Origin: from, 'Content-Type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}) }), env);
const get = async path => worker.fetch(new Request(origin + path), env);
const text = async path => (await get(path)).text();
const day = 24 * 3600 * 1000;
const isoDay = offset => new Date(Date.now() + offset * day).toISOString().slice(0, 10);
const runCron = async () => { const waits = []; await worker.scheduled({}, env, { waitUntil: p => waits.push(p) }); await Promise.all(waits); };

// Un nzonzi publié.
const profile = { firstName: 'Élodie', lastName: 'Nsimba', contactEmail: 'elodie@example.test', city: 'Créteil', region: 'Île-de-France', languages: 'français, lingala', bio: 'Je prépare les échanges entre les familles.', rate: '255' };
assert.equal((await api('/api/profil', 'nzonzi', 'PUT', profile)).status, 200);
const mine = (await (await api('/api/admin/profils', 'admin')).json()).profiles[0];
const { slug } = await (await api('/api/admin/profils', 'admin', 'POST', { userId: 'nzonzi', action: 'approve', updatedAt: mine.updatedAt })).json();

// Demandes de familles (formulaire de la fiche).
let ipCount = 0;
const contact = async (data) => {
  ipCount++;
  const form = { reference: crypto.randomUUID(), nom: 'Famille Mbemba', email: 'famille@example.test', ville: 'Paris', lieu: 'Pas encore défini', message: 'Bonjour, nous préparons une dot.', accord: 'oui', site: '', ...data };
  const r = await worker.fetch(new Request(origin + '/nzonzi/' + slug, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded', 'CF-Connecting-IP': '203.0.113.' + ipCount }, body: new URLSearchParams(form) }), env);
  assert.equal(r.status, 303);
  return form.reference;
};
const past = await contact({ date: isoDay(-5) });                                   // cérémonie passée : invitée
const future = await contact({ email: 'futur@example.test', date: isoDay(20) });      // cérémonie à venir : pas encore
const again = await contact({ email: 'FAMILLE@example.test', date: isoDay(-4) });     // même famille, même nzonzi : une seule invitation
const noDate = await contact({ email: 'sansdate@example.test', nom: 'Jean Kabasele' }); // sans date : 45 jours après la demande
const tooOld = await contact({ email: 'ancien@example.test', date: isoDay(-200) });   // trop ancien : pas d'invitation
const failed = await contact({ email: 'echec@example.test', date: isoDay(-5) });
db.prepare("UPDATE contact_requests SET status = 'failed' WHERE reference = ?").run(failed);
sent.length = 0;

// Profil sans avis : rien d'affiché comme note.
let fiche = await text('/nzonzi/' + slug);
assert.match(fiche, /Avis des familles/);
assert.match(fiche, /Pas encore d’avis pour Élodie/);
assert.doesNotMatch(fiche, /class="rating"/);

// Tâche planifiée : une invitation pour la cérémonie passée.
await runCron();
assert.equal(sent.length, 1);
assert.deepEqual(sent[0].to, [{ email: 'famille@example.test' }]);
assert.match(sent[0].subject, /Comment s’est passée votre cérémonie avec Élodie/);
const link = sent[0].textContent.match(/https:\/\/mon-nzonzi\.fr\/avis\/([A-Za-z0-9_-]+)/);
assert.ok(link, 'lien dans l’email');
const token = link[1];
assert.match(sent[0].htmlContent, /Donner mon avis/);
// Le lien n'est jamais stocké en clair.
assert.doesNotMatch(JSON.stringify(db.prepare('SELECT * FROM reviews').all()), new RegExp(token));
await runCron();
assert.equal(sent.length, 1, 'pas de doublon');
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM reviews').get().n, 1);
for (const ref of [future, again, noDate, tooOld, failed]) assert.equal(db.prepare('SELECT COUNT(*) AS n FROM reviews WHERE reference = ?').get(ref).n, 0);

// Sans date : invitation 45 jours après la demande (bouton de l'admin).
db.prepare('UPDATE contact_requests SET created_at = ? WHERE reference = ?').run(new Date(Date.now() - 46 * day).toISOString(), noDate);
assert.equal((await api('/api/admin/avis', 'nzonzi', 'POST', { action: 'invite' })).status, 403);
const invite = await (await api('/api/admin/avis', 'admin', 'POST', { action: 'invite' })).json();
assert.deepEqual(invite, { sent: 1, failed: 0 });
assert.deepEqual(sent[1].to, [{ email: 'sansdate@example.test' }]);
assert.match(sent[1].textContent, /https:\/\/test\.example\/avis\//);
const token2 = sent[1].textContent.match(/\/avis\/([A-Za-z0-9_-]+)/)[1];
sent.length = 0;

// Lien : formulaire privé, non indexé, sans référent.
const formPage = await get('/avis/' + token);
assert.equal(formPage.status, 200);
assert.equal(formPage.headers.get('X-Robots-Tag'), 'noindex, nofollow');
assert.equal(formPage.headers.get('Referrer-Policy'), 'no-referrer');
const formHtml = await formPage.text();
assert.match(formHtml, /Comment s’est passée votre cérémonie avec <strong>Élodie Nsimba<\/strong>/);
assert.match(formHtml, /value="Famille M\."/);
assert.match(formHtml, /name="note" value="5"/);
assert.equal((await get('/avis/inconnu')).status, 404);
assert.equal((await get('/avis/' + 'A'.repeat(43))).status, 404);

// Envoi de l'avis : contrôles.
const post = (tk, data, from = origin) => worker.fetch(new Request(origin + '/avis/' + tk, { method: 'POST', headers: { Origin: from, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data) }), env);
const review = { note: '5', commentaire: 'Élodie a guidé nos deux familles avec <b>respect</b> et beaucoup de patience.', nom: 'Famille M.', accord: 'oui' };
assert.equal((await post(token, review, 'https://pirate.example')).status, 403);
assert.match(await (await post(token, { ...review, note: '0' })).text(), /Choisissez une note/);
assert.match(await (await post(token, { ...review, note: '6' })).text(), /Choisissez une note/);
assert.match(await (await post(token, { ...review, commentaire: 'Bien.' })).text(), /au moins 20 caractères/);
assert.match(await (await post(token, { ...review, nom: ' ' })).text(), /nom à afficher/);
const noConsent = await (await post(token, { ...review, accord: '' })).text();
assert.match(noConsent, /Cochez la case/);
assert.match(noConsent, /&lt;b&gt;respect&lt;\/b&gt;/);
assert.equal(sent.length, 0);
const ok = await post(token, review);
assert.equal(ok.status, 303);
assert.equal(ok.headers.get('Location'), '/avis/' + token);
assert.equal(sent.length, 1);
assert.deepEqual(sent[0].to, [{ email: 'admin@example.test' }]);
assert.match(sent[0].subject, /Nouvel avis à valider : 5\/5 pour Élodie Nsimba/);
assert.match(await text('/avis/' + token), /votre avis <strong>est bien arrivé/);
// Un seul avis par lien.
assert.equal((await post(token, { ...review, note: '1' })).status, 200);
assert.equal(db.prepare('SELECT rating FROM reviews WHERE status = ?').get('pending').rating, 5);
assert.equal(sent.length, 1);

// En attente : rien de publié.
assert.doesNotMatch(await text('/nzonzi/' + slug), /guidé nos deux familles/);

// Admin : accès réservé, liste, validation.
assert.equal((await api('/api/admin/avis', 'nzonzi')).status, 403);
assert.equal((await api('/api/admin/avis')).status, 401);
const list = await (await api('/api/admin/avis', 'admin')).json();
assert.equal(list.reviews.length, 1);
assert.equal(list.invited, 1);
assert.equal(list.reviews[0].status, 'pending');
const ref = list.reviews[0].reference;
assert.equal(ref, past);
assert.equal((await api('/api/admin/avis', 'admin', 'POST', { reference: ref, action: 'approve' }, 'https://pirate.example')).status, 403);
assert.equal((await api('/api/admin/avis', 'admin', 'POST', { reference: ref, action: 'reject' })).status, 400);
assert.equal((await api('/api/admin/avis', 'admin', 'POST', { reference: ref, action: 'reject', reason: 99 })).status, 400);
assert.equal((await api('/api/admin/avis', 'admin', 'POST', { reference: 'inconnue', action: 'approve' })).status, 404);
assert.equal((await api('/api/admin/avis', 'admin', 'POST', { reference: ref, action: 'approve' })).status, 200);
assert.deepEqual(sent[1].to, [{ email: 'elodie@example.test' }]);
assert.match(sent[1].subject, /nouvel avis est publié/);
assert.deepEqual(sent[1].replyTo, { email: 'admin@example.test', name: 'Mon Nzonzi' });
assert.match(await text('/'), /class="rating"/);

// Fiche : note moyenne, avis échappé, avis vérifié.
fiche = await text('/nzonzi/' + slug);
assert.match(fiche, /guidé nos deux familles avec &lt;b&gt;respect&lt;\/b&gt;/);
assert.match(fiche, /Famille M\./);
assert.match(fiche, /Avis vérifié/);
assert.match(fiche, /Note moyenne : 5,0 sur 5/);
assert.match(fiche, /1 avis/);
assert.doesNotMatch(fiche, /famille@example\.test/);
const home = await text('/');
assert.match(home, /<strong>5,0<\/strong>/);

// Deuxième avis : moyenne recalculée.
assert.equal((await post(token2, { ...review, note: '4', commentaire: 'Très bonne préparation, un peu de retard le jour J.', nom: 'Jean K.' })).status, 303);
const ref2 = (await (await api('/api/admin/avis', 'admin')).json()).reviews.find(r => r.status === 'pending').reference;
assert.equal((await api('/api/admin/avis', 'admin', 'POST', { reference: ref2, action: 'approve' })).status, 200);
assert.match(await text('/nzonzi/' + slug), /Note moyenne : 4,5 sur 5/);
assert.match(await text('/nzonzi/' + slug), /2 avis/);

// Retrait avec motif : la famille est prévenue, l'avis disparaît.
sent.length = 0;
assert.equal((await api('/api/admin/avis', 'admin', 'POST', { reference: ref2, action: 'reject', reason: 2 })).status, 200);
assert.deepEqual(sent[0].to, [{ email: 'sansdate@example.test' }]);
assert.match(sent[0].subject, /retiré/);
assert.match(sent[0].textContent, /Avis sans rapport avec la cérémonie/);
fiche = await text('/nzonzi/' + slug);
assert.doesNotMatch(fiche, /un peu de retard/);
assert.match(fiche, /Note moyenne : 5,0 sur 5/);

// Lien expiré (90 jours).
db.prepare("INSERT INTO reviews (reference, profile_slug, family_email, family_name, token_hash, status, invited_at) VALUES ('vieux', ?, 'v@example.test', 'V', 'h-vieux', 'invited', ?)").run(slug, new Date(Date.now() - 91 * day).toISOString());
db.prepare("UPDATE reviews SET token_hash = ? WHERE reference = 'vieux'").run(await sha256('B'.repeat(43)));
const expired = await get('/avis/' + 'B'.repeat(43));
assert.equal(expired.status, 410);
assert.match(await expired.text(), /a expiré/);

// Sans Brevo : aucune invitation.
sent.length = 0;
db.prepare('UPDATE contact_requests SET ceremony_date = ? WHERE reference = ?').run(isoDay(-3), future);
await worker.scheduled({}, { ...env, BREVO_API_KEY: undefined }, { waitUntil: () => {} });
assert.equal(sent.length, 0);

// Pages légales.
assert.match(await text('/cgu'), /id="avis"/);
assert.match(await text('/confidentialite'), /<strong>Avis<\/strong>/);

console.log('Avis des familles : OK');

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
