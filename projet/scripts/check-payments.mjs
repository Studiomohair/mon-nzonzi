// Réservations payantes : acompte, solde bloqué, confirmation, litige, remboursement (Stripe et Brevo simulés).
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import worker from '../dist/server/index.js';
import { createTestDb } from './d1-test-db.mjs';

const { db, DB } = createTestDb();
const origin = 'https://test.example';
const sent = [];
const stripe = [];
let accountReady = false;
let sessionCount = 0;
const sessions = new Map();
globalThis.fetch = async (url, init = {}) => {
  if (url === 'https://api.brevo.com/v3/smtp/email') { sent.push(JSON.parse(init.body)); return new Response('{}', { status: 201 }); }
  assert.ok(url.startsWith('https://api.stripe.com/v1/'), url);
  assert.equal(init.headers.Authorization, 'Bearer sk_test_cle');
  const path = url.slice('https://api.stripe.com/v1'.length).split('?')[0];
  const params = Object.fromEntries(new URLSearchParams(init.body || ''));
  stripe.push({ method: init.method, path, params, idem: init.headers['Idempotency-Key'] });
  const ok = data => new Response(JSON.stringify(data), { status: 200 });
  if (path === '/accounts' && init.method === 'POST') return ok({ id: 'acct_nz' });
  if (path === '/account_links') return ok({ url: 'https://connect.stripe.com/setup/e/acct_nz' });
  if (path === '/accounts/acct_nz') return ok({ id: 'acct_nz', details_submitted: accountReady, payouts_enabled: accountReady, capabilities: { transfers: accountReady ? 'active' : 'inactive' }, requirements: { currently_due: accountReady ? [] : ['external_account'] } });
  if (path === '/accounts/acct_nz/login_links') return ok({ url: 'https://connect.stripe.com/express/x' });
  if (path === '/checkout/sessions' && init.method === 'POST') {
    const id = 'cs_test_' + (++sessionCount);
    const session = { id, url: 'https://checkout.stripe.com/c/pay/' + id, status: 'open', payment_status: 'unpaid', metadata: { booking_id: params['metadata[booking_id]'], part: params['metadata[part]'] }, client_reference_id: params.client_reference_id, payment_intent: 'pi_' + sessionCount };
    sessions.set(id, session);
    return ok(session);
  }
  if (path.startsWith('/checkout/sessions/')) return ok(sessions.get(path.split('/')[3]));
  if (path.startsWith('/payment_intents/')) return ok({ id: path.split('/')[2], latest_charge: 'ch_' + path.split('_')[2] });
  if (path === '/transfers') return ok({ id: 'tr_' + stripe.length });
  if (path.startsWith('/transfers/')) return ok({ id: 'trr_1' });
  if (path === '/refunds') return ok({ id: 're_' + stripe.length });
  throw new Error('Appel Stripe inattendu : ' + init.method + ' ' + path);
};
const base = { DB, NZOZI_OPEN_SIGNUP: 'true', NZOZI_ADMIN_EMAILS: 'admin@example.test', BREVO_API_KEY: 'cle-test', BREVO_SENDER_EMAIL: 'contact@mon-nzonzi.fr' };
const env = { ...base, STRIPE_SECRET_KEY: 'sk_test_cle', STRIPE_WEBHOOK_SECRET: 'whsec_test', PAYMENTS_TEST_EMAILS: 'nzonzi@example.test' };
const who = id => ({ 'oai-authenticated-user-id': id, 'oai-authenticated-user-email': id + '@example.test' });
const api = (path, id, method = 'GET', data, e = env) => worker.fetch(new Request(origin + path, { method, headers: { ...(id ? who(id) : {}), Origin: origin, 'Content-Type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}) }), e);
const page = async (path, id, e = env) => (await worker.fetch(new Request(origin + path, { headers: id ? who(id) : {} }), e)).text();
const form = (path, data, e = env) => worker.fetch(new Request(origin + path, { method: 'POST', redirect: 'manual', headers: { Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data) }), e);
const day = 24 * 3600 * 1000;
const isoDay = offset => new Date(Date.now() + offset * day).toISOString().slice(0, 10);
const realNow = Date.now;
const travel = days => { Date.now = () => realNow() + days * day; };
const signed = (event, secret = 'whsec_test') => {
  const body = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', secret).update(t + '.' + body).digest('hex');
  return new Request(origin + '/stripe/webhook', { method: 'POST', headers: { 'Stripe-Signature': `t=${t},v1=${sig}`, 'Content-Type': 'application/json' }, body });
};
const pay = async (sessionId, e = env) => {
  const s = sessions.get(sessionId);
  s.status = 'complete'; s.payment_status = 'paid';
  return worker.fetch(signed({ type: 'checkout.session.completed', livemode: false, data: { object: s } }), e);
};
const booking = id => db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);

// Un nzonzi publié (rate 255 € → prix fiche 300 €) et deux demandes de familles.
const profile = { firstName: 'Élodie', lastName: 'Nsimba', contactEmail: 'elodie@example.test', phone: '0600000000', city: 'Créteil', region: 'Île-de-France', languages: 'français, lingala', bio: 'Je prépare les échanges entre les familles.', rate: '255' };
assert.equal((await api('/api/profil', 'nzonzi', 'PUT', profile)).status, 200);
const mine = (await (await api('/api/admin/profils', 'admin')).json()).profiles[0];
const { slug } = await (await api('/api/admin/profils', 'admin', 'POST', { userId: 'nzonzi', action: 'approve', updatedAt: mine.updatedAt })).json();
let ip = 0;
const contact = async data => {
  const f = { reference: crypto.randomUUID(), nom: 'Famille Mbemba', email: 'famille@example.test', ville: 'Paris', lieu: 'Pas encore défini', message: 'Bonjour, nous préparons une dot.', accord: 'oui', site: '', ...data };
  const r = await worker.fetch(new Request(origin + '/nzonzi/' + slug, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded', 'CF-Connecting-IP': '203.0.113.' + (++ip) }, body: new URLSearchParams(f) }), env);
  assert.equal(r.status, 303);
  return f.reference;
};
const far = await contact({ date: isoDay(120) });
const near = await contact({ email: 'proche@example.test', nom: 'Famille Kongo', date: isoDay(5) });
sent.length = 0;

// Interrupteur : sans clé Stripe, ou pour un nzonzi non testeur, rien ne change.
for (const e of [base, { ...env, PAYMENTS_TEST_EMAILS: '' }]) {
  const html = await page('/partenaire', 'nzonzi', e);
  assert.doesNotMatch(html, /Mes <strong>paiements/);
  assert.doesNotMatch(html, /Accepter et fixer le prix/);
  assert.equal((await api('/api/reservations', 'nzonzi', 'POST', { action: 'accept', reference: far }, e)).status, 404);
}
assert.doesNotMatch(await page('/partenaire/admin', 'admin', base), /Réservations et paiements/);
assert.doesNotMatch(await page('/cgu'), /Paiement, annulation et remboursement/);
// Clé live refusée sans PAYMENTS_LIVE.
assert.doesNotMatch(await page('/partenaire', 'nzonzi', { ...env, STRIPE_SECRET_KEY: 'sk_live_x' }), /Mes <strong>paiements/);
assert.equal(stripe.length, 0);

// Espace du nzonzi testeur : activer les paiements avant d'accepter.
let html = await page('/partenaire', 'nzonzi');
assert.match(html, /Mode test/);
assert.match(html, /Activer mes paiements/);
assert.match(html, /activez d’abord vos paiements/);
assert.equal((await api('/api/paiements/stripe', 'nzonzi', 'POST', { action: 'onboard' }, env)).status, 200);
assert.equal((await api('/api/paiements/stripe', 'nzonzi', 'POST', { action: 'onboard' }, env, )).status, 200);
const created = stripe.filter(c => c.path === '/accounts');
assert.equal(created.length, 1, 'un seul compte Stripe');
assert.equal(created[0].params.type, 'express');
assert.equal(created[0].params.country, 'FR');
assert.equal(created[0].params['capabilities[transfers][requested]'], 'true');
assert.equal((await worker.fetch(new Request(origin + '/api/paiements/stripe', { method: 'POST', headers: { ...who('nzonzi'), Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{"action":"onboard"}' }), env)).status, 403);
// Inscription pas terminée : impossible d'accepter.
let r = await api('/api/reservations', 'nzonzi', 'POST', { action: 'accept', reference: far, date: isoDay(120), base: '300' });
assert.equal(r.status, 409);
assert.match(await page('/partenaire', 'nzonzi'), /Terminer mon inscription Stripe/);
accountReady = true;
html = await page('/partenaire?stripe=retour', 'nzonzi');
assert.match(html, /Paiements activés/);
assert.match(html, /Accepter et fixer le prix/);

// Un autre nzonzi ne peut pas accepter cette demande.
assert.equal((await api('/api/reservations', 'autre', 'POST', { action: 'accept', reference: far, date: isoDay(120), base: '300' }, { ...env, PAYMENTS_TEST_EMAILS: 'autre@example.test' })).status, 404);
// Validations.
for (const bad of [{ date: '2020-01-01', base: '300' }, { date: isoDay(120), base: 'abc' }, { date: isoDay(120), base: '5' }, { date: isoDay(120), base: '300', extra: '-3' }]) {
  assert.equal((await api('/api/reservations', 'nzonzi', 'POST', { action: 'accept', reference: far, ...bad })).status, 400, JSON.stringify(bad));
}

// Cérémonie dans 120 jours : acompte 30 % tout de suite, solde à partir de J-80.
sent.length = 0;
r = await api('/api/reservations', 'nzonzi', 'POST', { action: 'accept', reference: far, date: isoDay(120), base: '300', extra: '50', note: 'Je viens de Lyon.' });
assert.equal(r.status, 200);
const farId = (await r.json()).id;
let b = booking(farId);
assert.equal(b.amount_cents, 35000);
assert.equal(b.deposit_cents, 10500);
assert.equal(b.balance_cents, 24500);
assert.equal(b.status, 'accepted');
assert.equal(sent.length, 1);
assert.deepEqual(sent[0].to, [{ email: 'famille@example.test' }]);
assert.match(sent[0].subject, /\[TEST\] Élodie a accepté votre demande/);
assert.match(sent[0].textContent, /acompte 105,00/);
assert.ok(sent[0].textContent.includes('/reservation/' + b.token));
assert.equal((await api('/api/reservations', 'nzonzi', 'POST', { action: 'accept', reference: far, date: isoDay(120), base: '300' })).status, 409, 'une seule réservation en cours');
html = await page('/partenaire', 'nzonzi');
assert.match(html, /Acceptée · en attente de l’acompte/);

// Page de la famille.
const farLink = '/reservation/' + b.token;
html = await page(farLink);
assert.match(html, /Payer l’acompte · 105,00/);
assert.match(html, /Annulation et remboursement/);
assert.match(html, /Mode test/);
assert.match(html, /Je viens de Lyon/);
assert.doesNotMatch(html, /elodie@example\.test/, 'coordonnées du nzonzi masquées avant paiement');
assert.equal((await worker.fetch(new Request(origin + '/reservation/inconnu-inconnu-inconnu-1'), env)).status, 404);
r = await form(farLink, { action: 'pay', part: 'deposit' });
assert.equal(r.status, 400, 'case des conditions obligatoire');
r = await form(farLink, { action: 'pay', part: 'balance', accord: 'oui' });
assert.equal(r.status, 409, 'solde pas encore payable');
r = await form(farLink, { action: 'pay', part: 'deposit', accord: 'oui' });
assert.equal(r.status, 303);
assert.equal(r.headers.get('Location'), 'https://checkout.stripe.com/c/pay/cs_test_1');
const checkout = stripe.find(c => c.path === '/checkout/sessions');
assert.equal(checkout.params['line_items[0][price_data][unit_amount]'], '10500');
assert.equal(checkout.params['metadata[part]'], 'deposit');
assert.equal(checkout.params['payment_intent_data[transfer_data][destination]'], undefined, 'argent encaissé par la plateforme');
// Double clic : la session ouverte est réutilisée.
r = await form(farLink, { action: 'pay', part: 'deposit', accord: 'oui' });
assert.equal(r.headers.get('Location'), 'https://checkout.stripe.com/c/pay/cs_test_1');
assert.equal(sessionCount, 1);

// Webhook : signature obligatoire.
assert.equal((await worker.fetch(signed({ type: 'checkout.session.completed', livemode: false, data: { object: {} } }, 'whsec_autre'), env)).status, 400);
sent.length = 0;
assert.equal((await pay('cs_test_1')).status, 200);
b = booking(farId);
assert.equal(b.status, 'reserved');
assert.equal(b.deposit_intent, 'pi_1');
assert.equal(sent.length, 2);
assert.match(sent[0].subject, /Reçu de votre paiement · Acompte · 105,00/);
assert.match(sent[0].textContent, /elodie@example\.test/, 'coordonnées du nzonzi après l’acompte');
assert.deepEqual(sent[1].to, [{ email: 'elodie@example.test' }]);
assert.deepEqual(sent[1].bcc, [{ email: 'admin@example.test' }]);
assert.match(sent[1].subject, /Famille Mbemba a réservé/);
assert.match(sent[1].textContent, /89,25/);
// Même événement reçu deux fois : rien de plus.
assert.equal((await worker.fetch(signed({ type: 'checkout.session.completed', livemode: false, data: { object: sessions.get('cs_test_1') } }), env)).status, 200);
assert.equal(sent.length, 2);
html = await page(farLink);
assert.match(html, /acompte payé/);
assert.match(html, /pourra être payé à partir du/);
// Le nzonzi ne peut plus annuler seul.
assert.equal((await api('/api/reservations', 'nzonzi', 'POST', { action: 'cancel', id: farId })).status, 409);

// Tâche quotidienne : acompte versé après 14 jours, email du solde à J-80.
const cron = async days => { const waits = []; const res = await worker.scheduled({}, env, { waitUntil: p => waits.push(p) }); await Promise.all(waits); return res; };
const runAt = async days => { travel(days); await cron(); Date.now = realNow; };
stripe.length = 0;
await runAt(13);
assert.equal(stripe.filter(c => c.path === '/transfers').length, 0, 'acompte pas encore versé');
sent.length = 0;
await runAt(15);
const deposit = stripe.find(c => c.path === '/transfers');
assert.equal(deposit.params.amount, '8925');
assert.equal(deposit.params.destination, 'acct_nz');
assert.equal(deposit.params.source_transaction, 'ch_1');
assert.ok(booking(farId).deposit_released_at);
assert.ok(sent.some(m => /Acompte versé : 89,25/.test(m.subject)));
assert.ok(!sent.some(m => /solde/i.test(m.subject)), 'solde pas encore payable');
sent.length = 0;
await runAt(41);
assert.equal(sent.filter(m => /Réglez le solde/.test(m.subject)).length, 1);
await runAt(42);
assert.equal(sent.filter(m => /Réglez le solde/.test(m.subject)).length, 1, 'un seul email');

// Cérémonie proche (5 jours) : acompte puis solde tout de suite.
r = await api('/api/reservations', 'nzonzi', 'POST', { action: 'accept', reference: near, date: isoDay(5), base: '300' });
const nearId = (await r.json()).id;
const nearLink = '/reservation/' + booking(nearId).token;
await form(nearLink, { action: 'pay', part: 'deposit', accord: 'oui' });
await pay('cs_test_2');
assert.equal(booking(nearId).status, 'reserved');
// Retour de Stripe avant le webhook : la session est vérifiée directement.
assert.match(await page(nearLink), /Payer le solde · 210,00/);
r = await form(nearLink, { action: 'pay', part: 'balance', accord: 'oui' });
assert.equal(r.status, 303);
const s3 = sessions.get('cs_test_3');
s3.status = 'complete'; s3.payment_status = 'paid';
sent.length = 0;
html = await page(nearLink + '?retour=ok');
assert.match(html, /entièrement réglée/);
assert.equal(booking(nearId).status, 'paid');
assert.equal(booking(nearId).balance_intent, 'pi_3');
assert.ok(sent.some(m => /Reçu de votre paiement · Solde/.test(m.subject)));
// Webhook arrivé ensuite : aucun doublon. Second paiement réel : remboursé automatiquement.
await pay('cs_test_3');
assert.equal(sent.filter(m => /Reçu de votre paiement · Solde/.test(m.subject)).length, 1);
const dup = { ...s3, id: 'cs_dup', payment_intent: 'pi_dup' };
stripe.length = 0;
await worker.fetch(signed({ type: 'checkout.session.completed', livemode: false, data: { object: dup } }), env);
assert.equal(stripe.find(c => c.path === '/refunds').params.payment_intent, 'pi_dup');
// Avant la cérémonie : pas de confirmation possible.
assert.equal((await form(nearLink, { action: 'confirm' })).status, 409);

// Après la cérémonie : email de confirmation, puis la famille confirme → solde versé.
sent.length = 0;
await runAt(6);
assert.equal(sent.filter(m => /s’est-elle bien passée/.test(m.subject) && m.to[0].email === 'proche@example.test').length, 1);
travel(6);
html = await page(nearLink);
assert.match(html, /Oui, tout s’est bien passé/);
stripe.length = 0;
sent.length = 0;
r = await form(nearLink, { action: 'confirm' });
assert.equal(r.status, 303);
Date.now = realNow;
b = booking(nearId);
assert.equal(b.status, 'released');
assert.equal(b.released_by, 'family');
const transfers = stripe.filter(c => c.path === '/transfers');
assert.deepEqual(transfers.map(t => t.params.amount), ['17850'], 'solde (l’acompte a été versé le jour de la cérémonie)');
assert.ok(b.deposit_released_at);
assert.ok(sent.some(m => /Solde versé : 178,50/.test(m.subject)));

// Litige : réservation lointaine, solde payé, la famille signale une absence.
travel(41);
r = await form(farLink, { action: 'pay', part: 'balance', accord: 'oui' });
assert.equal(r.status, 303);
await pay('cs_test_' + sessionCount);
assert.equal(booking(farId).status, 'paid');
travel(121);
assert.equal((await form(farLink, { action: 'dispute', message: 'court' })).status, 400);
sent.length = 0;
r = await form(farLink, { action: 'dispute', message: 'Le nzonzi n’est jamais venu le jour de la cérémonie.' });
assert.equal(r.status, 303);
assert.equal(booking(farId).status, 'disputed');
assert.ok(sent.some(m => /Litige signalé/.test(m.subject) && m.to[0].email === 'admin@example.test'));
assert.ok(sent.some(m => /a signalé un problème/.test(m.subject) && m.to[0].email === 'elodie@example.test'));
stripe.length = 0;
await cron();
assert.equal(stripe.filter(c => c.path === '/transfers').length, 0, 'litige : pas de versement automatique');
Date.now = realNow;

// Admin : liste, puis remboursement total (solde + acompte déjà versé → reprise sur le compte du nzonzi).
const list = await (await api('/api/admin/paiements', 'admin')).json();
assert.equal(list.mode, 'test');
const row = list.bookings.find(x => x.id === farId);
assert.equal(row.status, 'disputed');
assert.equal(row.refundable, 35000);
assert.equal((await api('/api/admin/paiements', 'nzonzi')).status, 403);
assert.equal((await api('/api/admin/paiements', 'admin', 'POST', { id: farId, action: 'refund', amount: '350' })).status, 400, 'motif obligatoire');
assert.equal((await api('/api/admin/paiements', 'admin', 'POST', { id: farId, action: 'refund', amount: '400', reason: 0 })).status, 400);
stripe.length = 0;
sent.length = 0;
r = await api('/api/admin/paiements', 'admin', 'POST', { id: farId, action: 'refund', amount: '350', reason: 0 });
assert.equal(r.status, 200);
assert.equal((await r.json()).status, 'refunded');
const calls = stripe.map(c => c.method + ' ' + c.path + ' ' + (c.params.amount || ''));
assert.deepEqual(calls, ['POST /refunds 24500', 'POST /transfers/tr_1/reversals ' + (10500 - 1575), 'POST /refunds 10500'].map(s => s.replace('tr_1', booking(farId).deposit_transfer)));
assert.equal(booking(farId).status, 'refunded');
assert.ok(sent.some(m => /Votre remboursement de 350,00/.test(m.subject)));
assert.match(await page(farLink), /a été remboursée/);
assert.match(await page('/partenaire/admin', 'admin'), /Réservations et paiements/);

// Refus d'une demande.
const third = await contact({ email: 'trois@example.test', date: isoDay(60) });
sent.length = 0;
assert.equal((await api('/api/reservations', 'nzonzi', 'POST', { action: 'decline', reference: third })).status, 200);
assert.match(sent[0].subject, /n’est pas disponible/);

// Messagerie : coordonnées masquées tant que l'acompte n'est pas payé.
sent.length = 0;
const fourth = await contact({ email: 'quatre@example.test', nom: 'Famille Loemba', date: isoDay(90), message: 'Appelez-moi au 06 12 34 56 78 ou famille.loemba@gmail.com, cérémonie le 12/06/2027 pour 300 €.' });
const nzMail = sent.find(m => m.to.some(t => t.email === 'elodie@example.test'));
assert.ok(nzMail, 'le nzonzi est prévenu');
assert.doesNotMatch(nzMail.htmlContent, /06 12 34 56 78|loemba@gmail|quatre@example\.test/);
assert.ok(!nzMail.replyTo, 'pas de réponse directe à la famille');
const famMail = sent.find(m => m.to.some(t => t.email === 'quatre@example.test'));
const talkLink = famMail.htmlContent.match(/\/echange\/([A-Za-z0-9_-]+)/);
assert.ok(talkLink, 'lien de messagerie dans la confirmation de la famille');
html = await page('/partenaire', 'nzonzi');
assert.match(html, /\[coordonnées masquées\]/);
assert.match(html, /12\/06\/2027 pour 300 €/, 'dates et prix non masqués');
assert.doesNotMatch(html, /06 12 34 56 78|loemba@gmail|quatre@example\.test/);
sent.length = 0;
r = await api('/api/messages', 'nzonzi', 'POST', { reference: fourth, body: 'Bonjour ! Écrivez-moi sur elodie arobase gmail point com ou au +33 6 11 22 33 44, wa.me/33611223344' });
assert.equal(r.status, 200);
let saved = db.prepare('SELECT * FROM messages WHERE reference = ? ORDER BY id DESC').get(fourth);
assert.equal(saved.sender, 'nzonzi');
assert.equal(saved.masked, 1);
assert.doesNotMatch(saved.body, /gmail|33 6 11|wa\.me/);
assert.match(saved.body, /^Bonjour ! /);
assert.match(sent[0].htmlContent, new RegExp('/echange/' + talkLink[1]));
assert.equal((await api('/api/messages', 'autre', 'POST', { reference: fourth, body: 'Bonjour' })).status, 404, 'un autre compte ne peut pas écrire');
assert.equal((await api('/api/messages', 'nzonzi', 'POST', { reference: fourth, body: '   ' })).status, 400);
// Côté famille.
const talkPath = '/echange/' + talkLink[1];
html = await page(talkPath);
assert.match(html, /Écrivez-moi sur/);
assert.match(html, /Appelez-moi au \[coordonnées masquées\]/);
assert.equal((await page('/echange/' + 'x'.repeat(30))).includes('Écrivez-moi'), false);
sent.length = 0;
r = await form(talkPath, { body: 'Merci, mon numéro : 0612345678.' });
assert.equal(r.status, 303);
assert.match(r.headers.get('Location'), /envoye=1&masque=1/);
assert.match(sent[0].to[0].email, /elodie@example\.test/);
assert.doesNotMatch(sent[0].htmlContent, /0612345678/);
assert.match(sent[0].htmlContent, /partenaire#demande-/);
r = await worker.fetch(new Request(origin + talkPath, { method: 'POST', headers: { Origin: 'https://ailleurs.example', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'body=coucou' }), env);
assert.equal(r.status, 403);
// Limite de messages par jour.
for (let i = db.prepare("SELECT COUNT(*) AS n FROM messages WHERE reference = ? AND sender = 'family'").get(fourth).n; i < 20; i++) assert.equal((await form(talkPath, { body: 'Message ' + i })).status, 303);
assert.equal((await form(talkPath, { body: 'Un de trop' })).status, 429);
// Après l'acompte (réservation proche payée), plus de masquage.
r = await api('/api/messages', 'nzonzi', 'POST', { reference: near, body: 'Mon numéro : 06 11 22 33 44' });
assert.equal(r.status, 200);
saved = db.prepare('SELECT * FROM messages WHERE reference = ? ORDER BY id DESC').get(near);
assert.equal(saved.masked, 0);
assert.match(saved.body, /06 11 22 33 44/);

// CGU : section paiement seulement quand les paiements sont ouverts à tous.
assert.match(await page('/cgu', null, { ...env, PAYMENTS_ENABLED: 'true' }), /Paiement, annulation et remboursement/);
assert.doesNotMatch(await page('/cgu', null, env), /Paiement, annulation et remboursement/);

console.log('Réservations payantes : OK');
