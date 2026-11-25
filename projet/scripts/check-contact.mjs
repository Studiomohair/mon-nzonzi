// Formulaire de contact famille → nzonzi et alertes admin (Brevo simulé).
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { createTestDb } from './d1-test-db.mjs';

const { db, DB } = createTestDb();
const origin = 'https://test.example';
const sent = [];
let brevoUp = true;
globalThis.fetch = async (url, init) => {
  assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(init.headers['api-key'], 'cle-test');
  sent.push(JSON.parse(init.body));
  return new Response('{}', { status: brevoUp ? 201 : 500 });
};
const brevo = { BREVO_API_KEY: 'cle-test', BREVO_SENDER_EMAIL: 'contact@mon-nzonzi.fr' };
const env = { DB, NZOZI_OPEN_SIGNUP: 'true', NZOZI_ADMIN_EMAILS: 'admin@example.test', ...brevo };
const who = id => ({ 'oai-authenticated-user-id': id, 'oai-authenticated-user-email': id + '@example.test' });
const api = (path, id, method = 'GET', data, e = env) => worker.fetch(new Request(origin + path, { method, headers: { ...who(id), Origin: origin, 'Content-Type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}) }), e);
const profile = { firstName: 'Élodie', lastName: 'Nsimba', contactEmail: 'elodie@example.test', city: 'Créteil', region: 'Île-de-France', languages: 'français, lingala', bio: 'Je prépare les échanges entre les familles.', rate: '255' };

// Alerte admin : une seule tant que le profil attend la validation.
assert.equal((await api('/api/profil', 'nzonzi', 'PUT', profile)).status, 200);
assert.equal(sent.length, 1);
assert.deepEqual(sent[0].to, [{ email: 'admin@example.test' }]);
assert.match(sent[0].subject, /Nouveau profil à valider : Élodie Nsimba/);
assert.match(sent[0].textContent, /https:\/\/test\.example\/partenaire\/admin/);
assert.equal((await api('/api/profil', 'nzonzi', 'PUT', { ...profile, city: 'Ivry' })).status, 200);
assert.equal(sent.length, 1);
// Sans clé Brevo : aucune alerte, l'enregistrement fonctionne.
const noMail = { ...env, BREVO_API_KEY: undefined };
assert.equal((await api('/api/profil', 'autre', 'PUT', profile, noMail)).status, 200);
assert.equal(sent.length, 1);

// Validation : le nzonzi est prévenu que sa fiche est en ligne.
const list = (await (await api('/api/admin/profils', 'admin')).json()).profiles;
const mine = list.find(p => p.userId === 'nzonzi');
const { slug } = await (await api('/api/admin/profils', 'admin', 'POST', { userId: 'nzonzi', action: 'approve', updatedAt: mine.updatedAt })).json();
assert.equal(sent.length, 2);
assert.deepEqual(sent[1].to, [{ email: 'elodie@example.test' }]);
assert.match(sent[1].textContent, /https:\/\/test\.example\/nzonzi\/elodie-nsimba/);
// Une modification d'un profil publié déclenche une nouvelle alerte « modifié ».
assert.equal((await api('/api/profil', 'nzonzi', 'PUT', { ...profile, city: 'Vitry' })).status, 200);
assert.match(sent[2].subject, /Profil modifié à valider/);
sent.length = 0;

// Formulaire : masqué sans clé Brevo, visible avec.
const page = async (e = env, path = '/nzonzi/' + slug) => (await worker.fetch(new Request(origin + path), e)).text();
assert.doesNotMatch(await page(noMail), /<form method="post"/);
assert.equal((await worker.fetch(new Request(origin + '/nzonzi/' + slug, { method: 'POST', headers: { Origin: origin } }), noMail)).status, 405);
const fiche = await page();
assert.match(fiche, /<form method="post" action="\/nzonzi\/elodie-nsimba#contact">/);
assert.match(fiche, /name="accord"/);
assert.doesNotMatch(fiche, /elodie@example\.test/);

let ip = '203.0.113.1';
const form = { reference: crypto.randomUUID(), nom: 'Famille Mbemba', email: 'famille@example.test', telephone: '0611223344', ville: 'Paris', date: '2027-06-12', message: 'Bonjour <b>Élodie</b>, nous préparons une dot.', accord: 'oui', site: '' };
const post = (data, from = origin, path = '/nzonzi/' + slug) => worker.fetch(new Request(origin + path, { method: 'POST', headers: { Origin: from, 'Content-Type': 'application/x-www-form-urlencoded', 'CF-Connecting-IP': ip }, body: new URLSearchParams(data) }), env);

assert.equal((await post(form, 'https://pirate.example')).status, 403);
assert.equal((await post({ ...form, accord: '' })).status, 400);
assert.equal((await post({ ...form, email: 'pas-un-email' })).status, 400);
assert.equal((await post({ ...form, date: '2027-02-31' })).status, 400);
assert.equal((await post({ ...form, message: '' })).status, 400);
const refused = await (await post({ ...form, accord: '' })).text();
assert.match(refused, /Cochez la case/);
assert.match(refused, /Famille Mbemba/);
assert.equal(sent.length, 0);

// Champ piège rempli : réponse normale, rien d'envoyé.
assert.equal((await post({ ...form, reference: crypto.randomUUID(), site: 'http://spam' })).status, 303);
assert.equal(sent.length, 0);

// Envoi réussi : email au nzonzi, copie cachée à l'équipe, réponse directe à la famille.
const ok = await post(form);
assert.equal(ok.status, 303);
assert.equal(ok.headers.get('Location'), '/nzonzi/elodie-nsimba?envoye=1#contact');
assert.equal(sent.length, 2);
assert.deepEqual(sent[0].to, [{ email: 'elodie@example.test' }]);
assert.match(sent[0].textContent, /https:\/\/test\.example\/partenaire#demandes/);
// Confirmation à la famille avec récapitulatif.
assert.deepEqual(sent[1].to, [{ email: 'famille@example.test' }]);
assert.equal(sent[1].bcc, undefined);
assert.match(sent[1].subject, /Votre demande a bien été transmise à Élodie/);
assert.match(sent[1].textContent, /Ville de la cérémonie : Paris/);
assert.deepEqual(sent[0].bcc, [{ email: 'admin@example.test' }]);
assert.deepEqual(sent[0].replyTo, { email: 'famille@example.test', name: 'Famille Mbemba' });
assert.equal(sent[0].sender.email, 'contact@mon-nzonzi.fr');
assert.match(sent[0].textContent, /0611223344/);
assert.match(sent[0].textContent, /12 juin 2027/);
assert.match(sent[0].htmlContent, /&lt;b&gt;Élodie&lt;\/b&gt;/);
assert.match(await page(env, '/nzonzi/' + slug + '?envoye=1'), /Merci, votre demande a été envoyée/);
assert.equal(db.prepare('SELECT status FROM contact_requests WHERE reference = ?').get(form.reference).status, 'sent');
// Double envoi (rechargement) : pas de second email.
assert.equal((await post(form)).status, 303);
assert.equal(sent.length, 2);

// Échec Brevo : la famille est prévenue et peut réessayer.
brevoUp = false;
const failed = await post({ ...form, reference: crypto.randomUUID() });
assert.equal(failed.status, 502);
assert.match(await failed.text(), /n’a pas pu être envoyée/);
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM contact_requests WHERE status = 'failed'").get().n, 1);
brevoUp = true;

// Limite : 5 demandes par heure et par adresse IP.
for (let i = 0; i < 3; i++) assert.equal((await post({ ...form, reference: crypto.randomUUID() })).status, 303);
assert.equal((await post({ ...form, reference: crypto.randomUUID() })).status, 429);
ip = '203.0.113.2';
assert.equal((await post({ ...form, reference: crypto.randomUUID() })).status, 303);
assert.doesNotMatch(JSON.stringify(db.prepare('SELECT ip_hash FROM contact_requests').all()), /203\.0\.113/);

// Conservation : les demandes de plus de 12 mois sont purgées.
db.prepare("INSERT INTO contact_requests (reference, profile_slug, family_name, family_email, ceremony_city, message, ip_hash, status, created_at) VALUES ('ancienne', 'x', 'x', 'x@x.x', 'x', 'x', 'h', 'sent', '2024-01-01T00:00:00.000Z')").run();
ip = '203.0.113.3';
assert.equal((await post({ ...form, reference: crypto.randomUUID() })).status, 303);
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM contact_requests WHERE reference = 'ancienne'").get().n, 0);

// L'admin voit les demandes ; un nzonzi non.
const admin = await (await api('/api/admin/profils', 'admin')).json();
assert.ok(admin.requests.some(r => r.name === 'Famille Mbemba' && r.status === 'sent'));
assert.equal((await api('/api/admin/profils', 'nzonzi')).status, 403);

// Espace nzonzi : le nzonzi voit ses demandes envoyées, échappées ; les autres non.
const space = async id => (await worker.fetch(new Request(origin + '/partenaire', { headers: who(id) }), env)).text();
const inbox = await space('nzonzi');
assert.match(inbox, /Mes <strong>demandes<\/strong>/);
assert.match(inbox, /Famille Mbemba/);
assert.match(inbox, /href="mailto:famille@example\.test"/);
assert.match(inbox, /href="tel:0611223344"/);
assert.match(inbox, /Bonjour &lt;b&gt;Élodie&lt;\/b&gt;/);
assert.match(inbox, /12 juin 2027/);
assert.doesNotMatch(inbox, /x@x\.x/);
assert.match(inbox, new RegExp('data-ref="' + form.reference + '"'));

// « Indiquer à la famille que j'ai reçu la demande » : la famille est prévenue une seule fois ; un autre nzonzi ne peut pas.
const markRead = (id, reference, from = origin) => worker.fetch(new Request(origin + '/api/demandes', { method: 'POST', headers: { ...who(id), Origin: from, 'Content-Type': 'application/json' }, body: JSON.stringify({ reference }) }), env);
sent.length = 0;
assert.equal((await markRead('nzonzi', form.reference, 'https://pirate.example')).status, 403);
assert.equal((await worker.fetch(new Request(origin + '/api/demandes', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ reference: form.reference }) }), env)).status, 401);
assert.equal((await markRead('autre', form.reference)).status, 404);
assert.equal((await markRead('nzonzi', 'inconnue')).status, 404);
assert.equal(sent.length, 0);
const read = await markRead('nzonzi', form.reference);
assert.equal(read.status, 200);
assert.ok((await read.json()).readAt);
assert.equal(sent.length, 1);
assert.deepEqual(sent[0].to, [{ email: 'famille@example.test' }]);
assert.match(sent[0].subject, /Élodie a bien reçu votre demande/);
assert.equal((await markRead('nzonzi', form.reference)).status, 200);
assert.equal(sent.length, 1);
assert.match(await space('nzonzi'), /Réception confirmée à la famille le /);
// Admin : lue, ou en retard après 48 h sans lecture.
db.prepare("UPDATE contact_requests SET created_at = '2026-01-01T00:00:00.000Z' WHERE reference != ? AND status = 'sent'").run(form.reference);
const adminView = (await (await api('/api/admin/profils', 'admin')).json()).requests;
assert.ok(adminView.find(r => r.readAt));
assert.ok(adminView.some(r => !r.readAt && r.status === 'sent'));
assert.match(await (await api('/partenaire/admin', 'admin')).text(), /Réception non confirmée depuis plus de 48 h/);

const other = await space('autre');
assert.doesNotMatch(other, /Famille Mbemba/);
assert.match(other, /dès que votre fiche sera en ligne/);

// Profil non publié : pas de contact possible.
assert.equal((await post(form, origin, '/nzonzi/inconnu')).status, 404);
console.log('Contact famille → nzonzi, consentement, anti-spam, limite, purge, alertes admin et email de publication : OK.');
