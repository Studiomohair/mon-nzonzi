import { PAYMENT_RULES, SITE_ORIGIN, adminEmails, catalogHeaders, escapeHtml, formatDate, icon, layout, mailButton, mailDetails, paymentRulesHtml, sendMail } from './catalog.js';

// ——— Réservation et paiement sur la plateforme (Stripe Connect, comptes Express) ———
// 1. La famille envoie une demande depuis la fiche (formulaire existant).
// 2. Le nzonzi l'accepte dans son espace : il confirme la date et fixe le prix (prix de sa fiche + frais éventuels).
// 3. La famille paie un acompte (30 %) sur Mon Nzonzi pour réserver. Il est versé au nzonzi 14 jours plus tard
//    (fin du délai de rétractation), ou le jour de la cérémonie si elle a lieu avant : il couvre ses frais.
// 4. La famille paie le solde (70 %) à partir de PAY_WINDOW_DAYS jours avant la cérémonie. Il reste bloqué
//    chez Stripe, sur le compte de Mon Nzonzi (« separate charges and transfers »).
// 5. Après la cérémonie, la famille confirme que tout s'est bien passé : le solde (85 %) est transféré au nzonzi.
//    Elle peut aussi signaler un problème : l'argent reste bloqué et l'équipe décide (remboursement ou versement).
//    Sans réponse au bout de RELEASE_AFTER_DAYS jours, le versement est automatique.
// Stripe n'est pas un service de séquestre et limite la conservation des fonds à 90 jours pour la France :
// d'où le solde à J-80 au plus tôt, le versement automatique et les alertes à 75 jours.
//
// Interrupteurs (secrets du Worker, tous facultatifs) :
//   STRIPE_SECRET_KEY      clé secrète Stripe. Sans elle, rien ne change sur le site.
//                          Une clé « sk_live_ » est refusée tant que PAYMENTS_LIVE n'est pas "true".
//   STRIPE_WEBHOOK_SECRET  secret de signature du webhook (whsec_…), adresse /stripe/webhook.
//   PAYMENTS_TEST_EMAILS   emails de connexion des nzonzi qui voient les réservations payantes (phase de test).
//   PAYMENTS_ENABLED       "true" : ouvert à tous les nzonzi + section des CGU.
//   PAYMENTS_LIVE          "true" : autorise une clé live (vrais paiements). Uniquement avec l'accord de la propriétaire.
const PAY_COMMISSION = 0.15;
const PAY_MIN_CENTS = 1000;          // 10 €
const PAY_MAX_CENTS = 2000000;       // 20 000 €
const PAY_DEPOSIT_SHARE = PAYMENT_RULES.depositPercent / 100;   // acompte payé à la réservation
const PAY_WINDOW_DAYS = PAYMENT_RULES.balanceDays;   // solde payable à partir de J-80 (fonds conservés 90 jours au plus)
const DEPOSIT_RELEASE_DAYS = PAYMENT_RULES.withdrawalDays;   // acompte versé au nzonzi après le délai de rétractation
const RELEASE_AFTER_DAYS = PAYMENT_RULES.autoReleaseDays;   // sans réponse de la famille, versement automatique
const PAY_NOTE_MAX = 500;
const PAY_SIGNATURE_TOLERANCE_S = 300;
const PAY_DAY_MS = 24 * 3600 * 1000;
const BOOKING_STATES = {
  accepted: 'Acceptée · en attente de l’acompte', reserved: 'Réservée · acompte payé', paid: 'Payée · solde bloqué jusqu’à la cérémonie',
  disputed: 'Problème signalé · en attente de l’équipe', released: 'Terminée · versée au nzonzi', refunded: 'Remboursée', cancelled: 'Annulée', declined: 'Refusée',
};
const PAY_REFUND_REASONS = ['Absence ou annulation du nzonzi', 'Annulation par la famille', 'Rétractation de la famille', 'Litige sur la prestation', 'Paiement en double', 'Autre'];
const payEuroFormat = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const payEuro = cents => payEuroFormat.format(cents / 100);
const payFee = cents => Math.round(cents * PAY_COMMISSION);
const PARTS = ['deposit', 'balance'];
const PART_LABEL = { deposit: 'Acompte', balance: 'Solde' };
const payDeposit = amount => Math.min(amount, Math.max(100, Math.round(amount * PAY_DEPOSIT_SHARE / 100) * 100));
// Montant encore payé (après remboursements) et part du nzonzi, pour un acompte ou un solde.
const partKept = (b, part) => b[part + '_paid_at'] ? b[part + '_cents'] - b[part + '_refunded'] : 0;
const partNet = (b, part) => { const kept = partKept(b, part); return kept - payFee(kept); };
const payNetAll = b => PARTS.reduce((t, part) => t + partNet(b, part), 0);
const payPaidAll = b => PARTS.reduce((t, part) => t + (b[part + '_paid_at'] ? b[part + '_cents'] : 0), 0);
const payRefundedAll = b => b.deposit_refunded + b.balance_refunded;
// Acompte versé au nzonzi après le délai de rétractation, ou le jour de la cérémonie si elle a lieu avant.
const depositDueAt = b => Math.min(new Date(b.deposit_paid_at).getTime() + DEPOSIT_RELEASE_DAYS * PAY_DAY_MS, payDay(b.ceremony_date) - 12 * 3600 * 1000);
const payChanges = result => Number(result?.meta?.changes ?? result?.changes ?? 0);
const payEmailSet = value => new Set(String(value || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
const payHeaders = { ...catalogHeaders, 'X-Robots-Tag': 'noindex, nofollow' };
const payRef = id => String(id).slice(0, 8).toUpperCase();
const payDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? new Date(value + 'T12:00:00Z').getTime() : NaN;
const payToday = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
const payOpensOn = date => new Date(payDay(date) - PAY_WINDOW_DAYS * PAY_DAY_MS).toISOString().slice(0, 10);
const payWindowOpen = (date, now = Date.now()) => payDay(date) - now <= PAY_WINDOW_DAYS * PAY_DAY_MS;
const payCeremonyPassed = (date, now = Date.now()) => payToday(now) > date;
const payFmtDay = date => formatDate.format(new Date(payDay(date)));
function payJson(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
function payPage(html, status = 200) {
  return new Response(html, { status, headers: { ...payHeaders, 'Content-Type': 'text/html; charset=utf-8' } });
}
function payToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function payText(lines) {
  return lines.filter(line => line !== null && line !== undefined && line !== false).filter((line, i, all) => line !== '' || all[i - 1] !== '').join('\n');
}
async function payLater(ctx, promise) {
  const safe = Promise.resolve(promise).catch(() => false);
  if (ctx?.waitUntil) ctx.waitUntil(safe); else await safe;
}
// « 150 », « 150,5 », « 150.50 » → centimes ; null si invalide.
export function payCents(value) {
  const text = String(value ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(text)) return null;
  return Math.round(Number(text) * 100);
}

// 'test', 'live' ou null (paiements indisponibles).
export function stripeMode(env) {
  const key = String(env?.STRIPE_SECRET_KEY || '');
  if (/^(sk|rk)_test_/.test(key)) return 'test';
  if (/^(sk|rk)_live_/.test(key)) return env?.PAYMENTS_LIVE === 'true' ? 'live' : null;
  return null;
}
const payLivemode = env => stripeMode(env) === 'live' ? 1 : 0;
// Le nzonzi connecté utilise-t-il les réservations payantes ?
export function paymentsEnabledFor(env, email) {
  if (!stripeMode(env) || !env?.DB) return false;
  return env.PAYMENTS_ENABLED === 'true' || payEmailSet(env.PAYMENTS_TEST_EMAILS).has(String(email || '').toLowerCase());
}

function stripeForm(data, prefix = '', out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(data || {})) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === 'object') stripeForm(Array.isArray(value) ? Object.fromEntries(value.map((v, i) => [i, v])) : value, name, out);
    else out.append(name, String(value));
  }
  return out;
}
async function stripeCall(env, method, path, params, idempotencyKey) {
  const body = stripeForm(params).toString();
  const headers = { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY };
  if (method === 'POST') headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await fetch('https://api.stripe.com/v1' + path + (method === 'GET' && body ? '?' + body : ''), { method, headers, ...(method === 'POST' ? { body } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || 'Stripe indisponible');
  return data;
}

// Signature des webhooks : en-tête Stripe-Signature « t=…,v1=… », HMAC-SHA256 de « t.payload ».
export async function verifyStripeSignature(payload, header, secret, now = Date.now()) {
  if (!header || !secret) return false;
  const parts = String(header).split(',').map(part => part.split('='));
  const timestamp = Number(parts.find(([k]) => k === 't')?.[1]);
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!Number.isFinite(timestamp) || !signatures.length || Math.abs(now / 1000 - timestamp) > PAY_SIGNATURE_TOLERANCE_S) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(timestamp + '.' + payload)));
  const expected = [...mac].map(b => b.toString(16).padStart(2, '0')).join('');
  return signatures.some(signature => {
    if (signature.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  });
}

// ——— Compte Stripe du nzonzi ———
async function payAccount(env, userId) {
  return env.DB.prepare('SELECT * FROM stripe_accounts WHERE user_id = ? AND livemode = ?').bind(userId, payLivemode(env)).first();
}
const payAccountReady = row => Boolean(row && row.details_submitted && row.transfers_active);
async function payRefreshAccount(env, row) {
  if (!row) return row;
  try {
    const account = await stripeCall(env, 'GET', '/accounts/' + encodeURIComponent(row.account_id));
    const next = {
      details_submitted: account.details_submitted ? 1 : 0,
      transfers_active: account.capabilities?.transfers === 'active' ? 1 : 0,
      payouts_enabled: account.payouts_enabled ? 1 : 0,
      requirements_due: (account.requirements?.currently_due?.length || 0) + (account.requirements?.past_due?.length || 0),
      updated_at: new Date().toISOString(),
    };
    await env.DB.prepare('UPDATE stripe_accounts SET details_submitted = ?, transfers_active = ?, payouts_enabled = ?, requirements_due = ?, updated_at = ? WHERE user_id = ? AND livemode = ?')
      .bind(next.details_submitted, next.transfers_active, next.payouts_enabled, next.requirements_due, next.updated_at, row.user_id, row.livemode).run();
    return { ...row, ...next };
  } catch {
    return row;
  }
}

// ——— Espace nzonzi ———
// Renvoie la section « Paiements » (compte Stripe) et, pour chaque demande de famille,
// le bloc « Accepter / Refuser » ou l'état de la réservation (clé : référence de la demande).
export async function partnerBookings(env, url, userId, email, requests) {
  const empty = { section: '', extras: new Map() };
  if (!paymentsEnabledFor(env, email)) return empty;
  let account = null, bookings = [], profile = null;
  try {
    const mine = await env.DB.prepare('SELECT slug, published_json, profile_json FROM nzozi_profiles WHERE user_id = ?').bind(userId).first();
    if (mine) profile = JSON.parse(mine.published_json || mine.profile_json);
    account = await payAccount(env, userId);
    if (account && (!payAccountReady(account) || url.searchParams.has('stripe'))) account = await payRefreshAccount(env, account);
    ({ results: bookings } = await env.DB.prepare('SELECT * FROM bookings WHERE user_id = ? AND livemode = ? ORDER BY created_at DESC LIMIT 100').bind(userId, payLivemode(env)).all());
  } catch {
    return { section: `<section class="inbox" id="paiements" aria-labelledby="payments-title"><h2 id="payments-title">Mes <strong>paiements</strong></h2><p class="result">Les paiements sont momentanément indisponibles. Rechargez la page.</p></section>`, extras: new Map() };
  }
  const test = stripeMode(env) === 'test';
  const ready = payAccountReady(account);
  const fiche = profile && Number(profile.rate) > 0 ? Math.round(Math.round(Number(profile.rate) * 100) / (1 - PAY_COMMISSION)) : 0;
  const latest = new Map();
  for (const b of bookings) if (!latest.has(b.reference)) latest.set(b.reference, b);
  const extras = new Map();
  for (const r of requests || []) {
    const b = latest.get(r.reference);
    if (b && b.status !== 'cancelled' && b.status !== 'declined') { extras.set(r.reference, payBookingState(b)); continue; }
    const again = b ? `<p class="note">${b.status === 'declined' ? 'Vous avez refusé cette demande.' : 'La réservation précédente a été annulée.'}</p>` : '';
    if (!ready) { extras.set(r.reference, `<div class="booking">${again}<p class="note">Pour accepter cette demande et que la famille réserve sur Mon Nzonzi, <a class="link" href="#paiements">activez d’abord vos paiements</a>.</p></div>`); continue; }
    const date = /^\d{4}-\d{2}-\d{2}$/.test(r.ceremony_date || '') ? r.ceremony_date : '';
    extras.set(r.reference, `<div class="booking">${again}
      <details class="booking-accept"><summary class="btn">Accepter et fixer le prix</summary>
      <form class="booking-form" data-ref="${escapeHtml(r.reference)}" novalidate>
        <div class="two-fields">
          <label class="field"><span>Date de la cérémonie</span><input type="date" name="date" required value="${escapeHtml(date)}" min="${payToday()}"></label>
          <label class="field"><span>Prix de votre fiche (€)</span><input name="base" inputmode="decimal" required value="${fiche ? String(fiche / 100).replace('.', ',') : ''}"></label>
        </div>
        <label class="field"><span>Frais de déplacement ou options (€) <span class="optional">(facultatif)</span></span><input name="extra" inputmode="decimal" placeholder="0"></label>
        <p class="price-box" aria-live="polite"><span>La famille paie <strong class="b-total">—</strong><br><span class="note">acompte à la réservation : <span class="b-deposit">—</span> · vous recevez au total <span class="b-net">—</span> (commission 15 % : <span class="b-fee">—</span>)</span></span></p>
        <label class="field"><span>Message pour la famille <span class="optional">(facultatif)</span></span><textarea name="note" maxlength="${PAY_NOTE_MAX}" placeholder="Ex. Je serai présent dès 14 h pour préparer l’échange avec la famille de la mariée."></textarea></label>
        <p class="note">La famille réserve en payant un acompte de ${PAYMENT_RULES.depositPercent} % sur Mon Nzonzi : il vous est versé ${DEPOSIT_RELEASE_DAYS} jours plus tard (fin du délai de rétractation). Le solde est payé à partir de ${PAY_WINDOW_DAYS} jours avant la cérémonie et vous est versé après la cérémonie, quand la famille confirme que tout s’est bien passé (ou automatiquement ${RELEASE_AFTER_DAYS} jours après sans réponse).</p>
        <div class="save-row"><button class="btn" type="submit">Confirmer et envoyer à la famille</button><p class="b-status" role="status" aria-live="polite"></p></div>
      </form></details>
      <button type="button" class="btn secondary booking-decline" data-ref="${escapeHtml(r.reference)}">Refuser</button>
    </div>`);
  }
  const banner = test ? '<p class="pay-test" role="note"><strong>Mode test</strong> · aucun vrai paiement. Carte de test : 4242 4242 4242 4242, date future, n’importe quel code.</p>' : '';
  let step;
  if (!account) step = `<p>Pour que les familles puissent réserver et payer sur Mon Nzonzi, activez vos paiements une seule fois. Notre partenaire Stripe vous demande votre identité et votre RIB (environ 5 minutes).</p>
      <p><button type="button" class="btn" data-stripe="onboard">${icon('lock')} Activer mes paiements</button></p>`;
  else if (!ready) step = `<p class="status" data-state="pending">Votre inscription Stripe n’est pas terminée${account.requirements_due ? ' : des informations manquent encore' : ' ou est en cours de vérification'}.</p>
      <p><button type="button" class="btn" data-stripe="onboard">Terminer mon inscription Stripe</button></p>`;
  else step = `<p class="status" data-state="approved">${icon('check')} Paiements activés.${account.payouts_enabled ? ' Les sommes versées arrivent ensuite sur votre compte bancaire.' : ' Stripe vérifie encore votre compte bancaire.'}</p>
      <p><button type="button" class="btn secondary" data-stripe="dashboard">Voir mes virements sur Stripe</button></p>`;
  let toCome = 0, received = 0;
  for (const b of bookings) for (const part of PARTS) {
    if (b[part + '_released_at']) received += partNet(b, part);
    else if (b[part + '_paid_at'] && !['refunded', 'cancelled'].includes(b.status)) toCome += partNet(b, part);
  }
  const section = `<section class="inbox" id="paiements" aria-labelledby="payments-title">
    <h2 id="payments-title">Mes <strong>paiements</strong></h2>
    ${banner}
    <div class="panel pay-step">${step}<p id="stripe-status" class="note" role="status" aria-live="polite"></p>
    ${bookings.some(b => b.deposit_paid_at) ? `<p>Payé par les familles, à recevoir : <strong>${payEuro(toCome)}</strong> · Déjà versé : <strong>${payEuro(received)}</strong></p>` : ''}</div>
  </section>
  <style>
  .pay-test{margin:12px 0;padding:12px 16px;border-radius:12px;background:#F3E1D9;border:1px dashed var(--bordeaux);font-size:15px}
  .pay-step{padding:clamp(18px,3vw,26px);margin-top:14px;display:grid;gap:10px}.pay-step .status{margin-top:0}
  .booking{margin-top:14px;padding-top:14px;border-top:1px solid var(--line);display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start}
  .booking .note{flex-basis:100%}
  .booking-accept{flex:1 1 100%}.booking-accept summary{list-style:none;display:inline-flex;min-height:42px;padding:8px 18px;font-size:15px}.booking-accept summary::-webkit-details-marker{display:none}
  .booking-accept[open] summary{margin-bottom:12px}
  .booking-form{display:grid;gap:12px}
  .booking-decline{min-height:42px;padding:8px 18px;font-size:15px}
  .booking-state{margin-top:14px;padding:12px 16px;border-radius:12px;background:var(--blanc);border-left:5px solid var(--sage);display:grid;gap:4px}
  .booking-state[data-state="reserved"],.booking-state[data-state="paid"],.booking-state[data-state="released"]{background:var(--success);border-left-color:var(--olive)}
  .booking-state[data-state="disputed"]{background:#F3E1D9;border-left-color:var(--bordeaux)}
  .booking-state .btn{justify-self:start;min-height:42px;padding:8px 18px;font-size:15px;margin-top:6px}
  </style>
  <script>
  (() => {
    const post = async (path, data) => { const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Action impossible. Réessayez.'); return d; };
    const say = (el, text) => { if (el) el.textContent = text; };
    for (const button of document.querySelectorAll('[data-stripe]')) button.addEventListener('click', async () => {
      button.disabled = true; say(document.getElementById('stripe-status'), 'Ouverture de Stripe…');
      try { const d = await post('/api/paiements/stripe', { action: button.dataset.stripe }); window.location.href = d.url; }
      catch (error) { say(document.getElementById('stripe-status'), error.message); button.disabled = false; }
    });
    const fmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
    const cents = v => { const t = String(v || '').trim().replace(/\\s/g, '').replace(',', '.'); if (!t) return 0; return /^\\d{1,6}(\\.\\d{1,2})?$/.test(t) ? Math.round(Number(t) * 100) : null; };
    const deposit = total => Math.min(total, Math.max(100, Math.round(total * ${PAY_DEPOSIT_SHARE} / 100) * 100));
    for (const form of document.querySelectorAll('.booking-form')) {
      const update = () => { const b = cents(form.elements.base.value), e = cents(form.elements.extra.value); const ok = b && e !== null; const total = ok ? b + e : 0; const d = deposit(total); const fee = Math.round(d * ${PAY_COMMISSION}) + Math.round((total - d) * ${PAY_COMMISSION}); form.querySelector('.b-total').textContent = ok ? fmt.format(total / 100) : '—'; form.querySelector('.b-deposit').textContent = ok ? fmt.format(d / 100) : '—'; form.querySelector('.b-net').textContent = ok ? fmt.format((total - fee) / 100) : '—'; form.querySelector('.b-fee').textContent = ok ? fmt.format(fee / 100) : '—'; };
      form.addEventListener('input', update); update();
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const status = form.querySelector('.b-status'), button = form.querySelector('button[type=submit]');
        if (!form.elements.date.value) { say(status, 'Indiquez la date de la cérémonie.'); form.elements.date.focus(); return; }
        const total = (cents(form.elements.base.value) || 0) + (cents(form.elements.extra.value) || 0);
        if (!cents(form.elements.base.value) || cents(form.elements.extra.value) === null || total < ${PAY_MIN_CENTS} || total > ${PAY_MAX_CENTS}) { say(status, 'Vérifiez les montants (total entre ${PAY_MIN_CENTS / 100} € et ${PAY_MAX_CENTS / 100} €).'); return; }
        button.disabled = true; say(status, 'Envoi…');
        try { await post('/api/reservations', { action: 'accept', reference: form.dataset.ref, date: form.elements.date.value, base: form.elements.base.value, extra: form.elements.extra.value, note: form.elements.note.value }); window.location.reload(); }
        catch (error) { say(status, error.message); button.disabled = false; }
      });
    }
    for (const button of document.querySelectorAll('.booking-decline')) button.addEventListener('click', async () => {
      if (!window.confirm('Refuser cette demande ? La famille sera prévenue que vous n’êtes pas disponible.')) return;
      button.disabled = true;
      try { await post('/api/reservations', { action: 'decline', reference: button.dataset.ref }); window.location.reload(); }
      catch (error) { button.disabled = false; button.textContent = error.message; }
    });
    for (const button of document.querySelectorAll('.booking-cancel')) button.addEventListener('click', async () => {
      if (!window.confirm('Annuler cette réservation ? La famille sera prévenue.')) return;
      button.disabled = true;
      try { await post('/api/reservations', { action: 'cancel', id: button.dataset.id }); window.location.reload(); }
      catch (error) { button.disabled = false; button.textContent = error.message; }
    });
  })();
  </script>`;
  return { section, extras };
}
function payBookingState(b) {
  const day = v => formatDate.format(new Date(v));
  const depositLine = !b.deposit_paid_at ? '' : b.deposit_released_at
    ? `Acompte de ${payEuro(b.deposit_cents)} payé : ${payEuro(partNet(b, 'deposit'))} vous ont été versés le ${day(b.deposit_released_at)}.`
    : `Acompte de ${payEuro(b.deposit_cents)} payé le ${day(b.deposit_paid_at)} : ${payEuro(partNet(b, 'deposit'))} vous seront versés le ${day(depositDueAt(b))}.`;
  const balanceOpen = payWindowOpen(b.ceremony_date) ? 'dès maintenant' : 'à partir du ' + payFmtDay(payOpensOn(b.ceremony_date));
  const lines = {
    accepted: `Réservation acceptée pour ${payEuro(b.amount_cents)} (cérémonie du ${payFmtDay(b.ceremony_date)}). La famille a reçu le lien pour payer l’acompte de ${payEuro(b.deposit_cents)}.`,
    reserved: `${depositLine} Solde de ${payEuro(b.balance_cents)} : la famille peut le payer ${balanceOpen}.`,
    paid: `${depositLine} Solde de ${payEuro(b.balance_cents)} payé le ${b.balance_paid_at ? day(b.balance_paid_at) : ''} : ${payEuro(partNet(b, 'balance'))} vous seront versés après la cérémonie du ${payFmtDay(b.ceremony_date)}, quand la famille l’aura confirmée.`,
    disputed: `La famille a signalé un problème après la cérémonie. L’équipe Mon Nzonzi vous contacte. Le versement de ${payEuro(partNet(b, 'balance'))} est suspendu.`,
    released: `Tout vous a été versé : ${payEuro(payNetAll(b))}.`,
    refunded: `La famille a été remboursée (${payEuro(payRefundedAll(b))}).`,
  };
  const cancel = b.status === 'accepted' ? `<button type="button" class="btn secondary booking-cancel" data-id="${escapeHtml(b.id)}">Annuler la réservation</button>` : '';
  return `<div class="booking-state" data-state="${escapeHtml(b.status)}"><strong>${escapeHtml(BOOKING_STATES[b.status] || b.status)}</strong><span>${escapeHtml(lines[b.status] || '')}</span>${b.note ? `<span class="note">Votre message : ${escapeHtml(b.note)}</span>` : ''}${cancel}</div>`;
}

async function payReadJson(request, url, max = 4000) {
  if (request.method !== 'POST') return { error: payJson({ error: 'Méthode non autorisée.' }, 405) };
  if (request.headers.get('Origin') !== url.origin) return { error: payJson({ error: 'Origine non autorisée.' }, 403) };
  if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) return { error: payJson({ error: 'Format non autorisé.' }, 415) };
  const body = await request.text();
  if (body.length > max) return { error: payJson({ error: 'Requête trop volumineuse.' }, 413) };
  try { const input = JSON.parse(body); if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error(); return { input }; } catch { return { error: payJson({ error: 'Requête invalide.' }, 400) }; }
}

// /api/paiements/stripe : inscription Stripe (Express) et accès au tableau de bord Express.
// /api/reservations : accepter, refuser une demande ; annuler une réservation sans acompte payé.
export async function partnerPaymentsApi(request, env, url, ctx, userId, email) {
  if (!paymentsEnabledFor(env, email)) return payJson({ error: 'Paiements indisponibles.' }, 404);
  const { input, error } = await payReadJson(request, url);
  if (error) return error;
  const livemode = payLivemode(env);
  try {
    if (url.pathname === '/api/paiements/stripe') {
      let account = await payAccount(env, userId);
      if (input.action === 'dashboard') {
        if (!account) return payJson({ error: 'Activez d’abord vos paiements.' }, 409);
        const link = await stripeCall(env, 'POST', '/accounts/' + encodeURIComponent(account.account_id) + '/login_links');
        return payJson({ url: link.url });
      }
      if (input.action !== 'onboard') return payJson({ error: 'Requête invalide.' }, 400);
      if (!account) {
        const mine = await env.DB.prepare('SELECT slug, published_json FROM nzozi_profiles WHERE user_id = ?').bind(userId).first();
        const created = await stripeCall(env, 'POST', '/accounts', {
          type: 'express', country: 'FR', email, default_currency: 'eur',
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          business_profile: { mcc: '7299', product_description: 'Accompagnement des cérémonies de dot (nzonzi) réservé via Mon Nzonzi', url: mine?.published_json && mine.slug ? url.origin + '/nzonzi/' + mine.slug : undefined },
          metadata: { user_id: userId },
        }, 'account-' + livemode + '-' + userId);
        const now = new Date().toISOString();
        await env.DB.prepare('INSERT INTO stripe_accounts (user_id, livemode, account_id, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, livemode) DO NOTHING')
          .bind(userId, livemode, created.id, email, now, now).run();
        account = await payAccount(env, userId);
      }
      const link = await stripeCall(env, 'POST', '/account_links', {
        account: account.account_id, type: 'account_onboarding',
        refresh_url: url.origin + '/partenaire?stripe=relance#paiements',
        return_url: url.origin + '/partenaire?stripe=retour#paiements',
      });
      return payJson({ url: link.url });
    }

    if (input.action === 'cancel') {
      if (typeof input.id !== 'string' || input.id.length > 100) return payJson({ error: 'Requête invalide.' }, 400);
      const row = await payBooking(env, 'b.id = ? AND b.user_id = ?', input.id, userId);
      if (!row) return payJson({ error: 'Réservation introuvable.' }, 404);
      const done = await env.DB.prepare("UPDATE bookings SET status = 'cancelled', cancelled_at = ? WHERE id = ? AND status = 'accepted'").bind(new Date().toISOString(), row.id).run();
      if (!payChanges(done)) return payJson({ error: 'La famille a déjà payé l’acompte : écrivez-nous pour annuler, elle sera remboursée.' }, 409);
      if (row.deposit_session) { try { await stripeCall(env, 'POST', '/checkout/sessions/' + encodeURIComponent(row.deposit_session) + '/expire'); } catch {} }
      await payLater(ctx, sendMail(env, payFamilyMail(row, 'cancelled', url.origin)));
      return payJson({ status: 'cancelled' });
    }

    if (input.action !== 'accept' && input.action !== 'decline') return payJson({ error: 'Requête invalide.' }, 400);
    const { reference } = input;
    if (typeof reference !== 'string' || !reference || reference.length > 100) return payJson({ error: 'Requête invalide.' }, 400);
    const req = await env.DB.prepare("SELECT c.reference, c.family_name, c.family_email, c.ceremony_city, c.ceremony_date, p.slug, p.published_json, p.profile_json FROM contact_requests c JOIN nzozi_profiles p ON p.slug = c.profile_slug WHERE c.reference = ? AND p.user_id = ? AND c.status != 'pending'").bind(reference, userId).first();
    if (!req) return payJson({ error: 'Demande introuvable.' }, 404);
    const active = await env.DB.prepare("SELECT id FROM bookings WHERE reference = ? AND status NOT IN ('cancelled', 'declined')").bind(reference).first();
    if (active) return payJson({ error: 'Cette demande a déjà une réservation en cours.' }, 409);
    const now = new Date().toISOString();
    const base = { id: crypto.randomUUID(), token: payToken(), reference, profile_slug: req.slug, user_id: userId, family_name: req.family_name, family_email: req.family_email, ceremony_city: req.ceremony_city, livemode, created_at: now, published_json: req.published_json, profile_json: req.profile_json };
    const insert = (b, status) => env.DB.prepare('INSERT INTO bookings (id, token, reference, profile_slug, user_id, family_name, family_email, ceremony_date, ceremony_city, base_cents, extra_cents, amount_cents, deposit_cents, balance_cents, note, livemode, account_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(b.id, b.token, b.reference, b.profile_slug, b.user_id, b.family_name, b.family_email, b.ceremony_date, b.ceremony_city, b.base_cents, b.extra_cents, b.amount_cents, b.deposit_cents, b.balance_cents, b.note, b.livemode, b.account_id, status, b.created_at).run();
    if (input.action === 'decline') {
      await insert({ ...base, ceremony_date: req.ceremony_date || '', base_cents: 0, extra_cents: 0, amount_cents: 0, deposit_cents: 0, balance_cents: 0, note: '', account_id: '' }, 'declined');
      await payLater(ctx, sendMail(env, payFamilyMail(base, 'declined', url.origin)));
      return payJson({ status: 'declined' });
    }
    const date = String(input.date || '');
    const baseCents = payCents(input.base);
    const extraCents = input.extra == null || String(input.extra).trim() === '' ? 0 : payCents(input.extra);
    const note = typeof input.note === 'string' ? input.note.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(payDay(date)) || new Date(payDay(date)).toISOString().slice(0, 10) !== date) return payJson({ error: 'Vérifiez la date de la cérémonie.' }, 400);
    if (date < payToday() || payDay(date) - Date.now() > 3 * 365 * PAY_DAY_MS) return payJson({ error: 'La date de la cérémonie doit être à venir (3 ans au plus).' }, 400);
    if (!baseCents || extraCents === null) return payJson({ error: 'Vérifiez les montants.' }, 400);
    const amount = baseCents + extraCents;
    if (amount < PAY_MIN_CENTS || amount > PAY_MAX_CENTS) return payJson({ error: `Le total doit être entre ${PAY_MIN_CENTS / 100} € et ${PAY_MAX_CENTS / 100} €.` }, 400);
    if (note.length > PAY_NOTE_MAX) return payJson({ error: 'Message trop long.' }, 400);
    let account = await payAccount(env, userId);
    if (account && !payAccountReady(account)) account = await payRefreshAccount(env, account);
    if (!payAccountReady(account)) return payJson({ error: 'Terminez d’abord votre inscription Stripe.' }, 409);
    const deposit = payDeposit(amount);
    const booking = { ...base, ceremony_date: date, base_cents: baseCents, extra_cents: extraCents, amount_cents: amount, deposit_cents: deposit, balance_cents: amount - deposit, note, account_id: account.account_id, status: 'accepted' };
    await insert(booking, 'accepted');
    const sent = await sendMail(env, payFamilyMail(booking, 'accepted', url.origin));
    return payJson({ id: booking.id, status: 'accepted', emailed: sent, link: url.origin + '/reservation/' + booking.token });
  } catch {
    return payJson({ error: 'Action impossible pour le moment. Réessayez.' }, 503);
  }
}

async function payBooking(env, where, ...args) {
  return env.DB.prepare(`SELECT b.*, p.published_json, p.profile_json FROM bookings b LEFT JOIN nzozi_profiles p ON p.user_id = b.user_id WHERE ${where}`).bind(...args).first();
}
const payNz = row => { try { return JSON.parse(row.published_json || row.profile_json); } catch { return { firstName: 'Votre nzonzi', lastName: '' }; } };
const testLine = test => test ? '<p style="margin:0 0 14px;padding:10px 14px;border:1px dashed #8C3D20;border-radius:10px;background:#F3E1D9;font-size:13px"><strong>Mode test</strong> · aucun vrai paiement.</p>' : '';
const payH1 = (lead, strong) => `<h1 style="margin:0 0 14px;font-size:26px;line-height:1.2;font-weight:normal">${lead} <strong>${strong}</strong></h1>`;

// Emails envoyés à la famille, selon l'étape de la réservation.
function payFamilyMail(row, step, origin) {
  const nz = payNz(row);
  const who = [nz.firstName, nz.lastName].filter(Boolean).join(' ');
  const link = origin + '/reservation/' + row.token;
  const test = !row.livemode;
  const tag = test ? '[TEST] ' : '';
  const hi = `Bonjour ${escapeHtml(row.family_name)},`;
  const date = row.ceremony_date && !Number.isNaN(payDay(row.ceremony_date)) ? payFmtDay(row.ceremony_date) : '';
  const summary = () => mailDetails([['Nzonzi', who], ['Cérémonie', [date, row.ceremony_city].filter(Boolean).join(' · ')], ['Prix', row.base_cents ? payEuro(row.base_cents) : ''], ['Frais', row.extra_cents ? payEuro(row.extra_cents) : ''], ['Total', payEuro(row.amount_cents)], ['Acompte', payEuro(row.deposit_cents) + ' à la réservation'], ['Solde', payEuro(row.balance_cents) + (date ? ' à partir du ' + payFmtDay(payOpensOn(row.ceremony_date)) : '')], ['Référence', payRef(row.id)]]);
  const note = row.note ? `<div style="margin:0 0 22px;padding:16px 18px;border-left:4px solid #8C3D20;background:#F6F4EF;border-radius:0 12px 12px 0;white-space:pre-wrap">${escapeHtml(row.note)}</div>` : '';
  const end = 'L’équipe Mon Nzonzi';
  if (step === 'accepted') {
    const line = `Pour réserver, payez l’acompte de ${payEuro(row.deposit_cents)} sur Mon Nzonzi. Le solde (${payEuro(row.balance_cents)}) se paie à partir du ${payFmtDay(payOpensOn(row.ceremony_date))} : il reste bloqué et n’est versé à ${nz.firstName} qu’après la cérémonie, quand vous aurez confirmé que tout s’est bien passé.`;
    return {
      to: [row.family_email], subject: `${tag}${nz.firstName} a accepté votre demande`,
      html: `${testLine(test)}${payH1(hi, `${escapeHtml(nz.firstName)} a accepté votre demande.`)}${summary()}${note}<p style="margin:0 0 18px">${escapeHtml(line)}</p><p style="margin:0">${mailButton('Payer l’acompte de ' + payEuro(row.deposit_cents), link)}</p>`,
      text: payText([`Bonjour ${row.family_name},`, '', `${who} a accepté votre demande.`, '', date ? `Cérémonie : ${date}` : '', `Total : ${payEuro(row.amount_cents)} (acompte ${payEuro(row.deposit_cents)}, solde ${payEuro(row.balance_cents)})`, row.note ? `Message : ${row.note}` : '', '', line, link, '', end]),
    };
  }
  if (step === 'payable') {
    const line = `Le solde de votre réservation (${payEuro(row.balance_cents)}) peut maintenant être réglé. Il reste bloqué et n’est versé à ${nz.firstName} qu’après la cérémonie, quand vous aurez confirmé que tout s’est bien passé.`;
    return {
      to: [row.family_email], subject: `${tag}Réglez le solde de votre réservation avec ${nz.firstName}`,
      html: `${testLine(test)}${payH1(hi, `vous pouvez régler le solde de votre réservation avec ${escapeHtml(nz.firstName)}.`)}<p style="margin:0 0 18px">${escapeHtml(line)}</p><p style="margin:0">${mailButton('Payer le solde de ' + payEuro(row.balance_cents), link)}</p>`,
      text: payText([`Bonjour ${row.family_name},`, '', line, link, '', end]),
    };
  }
  if (step === 'declined') {
    return {
      to: [row.family_email], subject: `${tag}${nz.firstName} n’est pas disponible`,
      html: `${testLine(test)}${payH1(hi, `${escapeHtml(nz.firstName)} n’est malheureusement pas disponible pour votre cérémonie.`)}<p style="margin:0 0 18px">D’autres nzonzi peuvent vous accompagner.</p><p style="margin:0">${mailButton('Voir les nzonzi', origin + '/#nzonzi')}</p>`,
      text: payText([`Bonjour ${row.family_name},`, '', `${who} n’est malheureusement pas disponible pour votre cérémonie. D’autres nzonzi peuvent vous accompagner : ${origin}/#nzonzi`, '', end]),
    };
  }
  if (step === 'cancelled') {
    return {
      to: [row.family_email], subject: `${tag}Votre réservation avec ${nz.firstName} est annulée`,
      html: `${testLine(test)}${payH1(hi, `votre réservation avec ${escapeHtml(nz.firstName)} a été annulée.`)}<p style="margin:0 0 18px">Aucun paiement n’avait été fait. Vous pouvez trouver un autre nzonzi sur Mon Nzonzi.</p><p style="margin:0">${mailButton('Voir les nzonzi', origin + '/#nzonzi')}</p>`,
      text: payText([`Bonjour ${row.family_name},`, '', `Votre réservation avec ${who} a été annulée. Aucun paiement n’avait été fait.`, `Autres nzonzi : ${origin}/#nzonzi`, '', end]),
    };
  }
  if (step === 'paid-deposit' || step === 'paid-balance') {
    const part = step === 'paid-deposit' ? 'deposit' : 'balance';
    const amount = row[part + '_cents'];
    const when = formatDate.format(new Date(row[part + '_paid_at'] || Date.now()));
    const protect = part === 'deposit'
      ? `Votre réservation est confirmée. L’acompte est versé à ${nz.firstName} dans ${DEPOSIT_RELEASE_DAYS} jours (fin du délai de rétractation) pour préparer la cérémonie. Le solde (${payEuro(row.balance_cents)}) se paie à partir du ${payFmtDay(payOpensOn(row.ceremony_date))} : nous vous enverrons un email.`
      : `Votre argent est protégé : le solde reste bloqué chez notre partenaire de paiement Stripe. ${nz.firstName} ne le reçoit qu’après la cérémonie, quand vous aurez confirmé que tout s’est bien passé. En cas de problème, vous pourrez nous le signaler.`;
    const contact = part === 'deposit' && (nz.contactEmail || nz.phone) ? `Pour préparer la cérémonie, vous pouvez joindre ${nz.firstName} : ${[nz.contactEmail, nz.phone].filter(Boolean).join(' · ')}.` : '';
    return {
      to: [row.family_email], subject: `${tag}Reçu de votre paiement · ${PART_LABEL[part]} · ${payEuro(amount)}`,
      html: `${testLine(test)}<p style="margin:0 0 6px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#726B4F">Reçu de paiement</p>${payH1(`Merci ${escapeHtml(row.family_name)},`, part === 'deposit' ? 'votre réservation est confirmée.' : 'votre réservation est entièrement réglée.')}
${mailDetails([['Référence', payRef(row.id)], ['Payé le', when], ['Objet', PART_LABEL[part] + ' · cérémonie de dot'], ['Nzonzi', who], ['Cérémonie', [date, row.ceremony_city].filter(Boolean).join(' · ')], ['Montant payé', payEuro(amount)], ['Dont commission', payEuro(payFee(amount)) + ' (Mon Nzonzi, 15 %)']])}
<p style="margin:0 0 18px">${escapeHtml(protect)}</p>${contact ? `<p style="margin:0 0 18px">${escapeHtml(contact)}</p>` : ''}
<p style="margin:0">${mailButton('Voir ma réservation', link, true)}</p>`,
      text: payText([`Bonjour ${row.family_name},`, '', 'Votre paiement est bien reçu. Merci !', '', `Référence : ${payRef(row.id)}`, `Payé le : ${when}`, `Objet : ${PART_LABEL[part]} · cérémonie de dot`, `Nzonzi : ${who}`, date ? `Cérémonie : ${date}` : '', `Montant payé : ${payEuro(amount)} (dont commission Mon Nzonzi 15 % : ${payEuro(payFee(amount))})`, '', protect, contact, '', `Votre réservation : ${link}`, '', end]),
    };
  }
  if (step === 'confirm') {
    return {
      to: [row.family_email], subject: `${tag}Votre cérémonie avec ${nz.firstName} s’est-elle bien passée ?`,
      html: `${testLine(test)}${payH1(hi, `votre cérémonie avec ${escapeHtml(nz.firstName)} s’est-elle bien passée ?`)}<p style="margin:0 0 18px">Confirmez-le en un clic : ${escapeHtml(nz.firstName)} recevra alors le solde. Si ${escapeHtml(nz.firstName)} n’est pas venu ou en cas de problème, signalez-le : le paiement reste bloqué et notre équipe vous contacte.</p>
<p style="margin:0 0 18px">${mailButton('Répondre', link)}</p><p style="margin:0;color:#726B4F;font-size:13px">Sans réponse de votre part dans les ${RELEASE_AFTER_DAYS} jours, le solde sera versé à ${escapeHtml(nz.firstName)}.</p>`,
      text: payText([`Bonjour ${row.family_name},`, '', `Votre cérémonie avec ${who} s’est-elle bien passée ?`, `Confirmez-le ou signalez un problème ici : ${link}`, '', `Sans réponse dans les ${RELEASE_AFTER_DAYS} jours, le solde sera versé à ${nz.firstName}.`, '', end]),
    };
  }
  throw new Error('Étape inconnue');
}
function payNzonziMail(env, row, step, origin) {
  const nz = payNz(row);
  const test = !row.livemode;
  const tag = test ? '[TEST] ' : '';
  const date = payFmtDay(row.ceremony_date);
  const space = origin + '/partenaire#demandes';
  const messages = {
    'paid-deposit': [`${row.family_name} a réservé`, `${row.family_name} a payé l’acompte de ${payEuro(row.deposit_cents)} : la cérémonie du ${date} est réservée. Vous recevrez ${payEuro(partNet(row, 'deposit'))} le ${row.deposit_paid_at ? formatDate.format(new Date(depositDueAt(row))) : ''} (après le délai de rétractation de la famille). Pour préparer la cérémonie : ${row.family_email}.`],
    'paid-balance': [`${row.family_name} a payé le solde`, `${row.family_name} a payé le solde de ${payEuro(row.balance_cents)} pour la cérémonie du ${date}. Vous recevrez ${payEuro(partNet(row, 'balance'))} après la cérémonie, dès que la famille l’aura confirmée (ou automatiquement ${RELEASE_AFTER_DAYS} jours après, sans réponse de sa part).`],
    'released-deposit': [`Acompte versé : ${payEuro(partNet(row, 'deposit'))}`, `L’acompte de la cérémonie avec ${row.family_name} (${date}) vous a été versé : ${payEuro(partNet(row, 'deposit'))}. Il arrive sur votre compte bancaire selon le calendrier de virement Stripe.`],
    released: [`Solde versé : ${payEuro(partNet(row, 'balance'))}`, `Le solde de la cérémonie avec ${row.family_name} (${date}) vous a été versé : ${payEuro(partNet(row, 'balance'))}. Il arrive sur votre compte bancaire selon le calendrier de virement Stripe (en général quelques jours).`],
    disputed: [`${row.family_name} a signalé un problème`, `${row.family_name} a signalé un problème pour la cérémonie du ${date}. Le versement du solde est suspendu le temps que l’équipe Mon Nzonzi échange avec vous et la famille. Nous vous contactons rapidement.`],
    refunded: [`Remboursement de ${row.family_name}`, `Un remboursement de ${payEuro(row.last_refund || payRefundedAll(row))} a été fait à ${row.family_name} (cérémonie du ${date}). Motif : ${row.refund_reason || 'non précisé'}.`],
  };
  const [title, body] = messages[step];
  return {
    to: [nz.contactEmail].filter(Boolean), bcc: adminEmails(env),
    subject: tag + title,
    html: `${testLine(test)}${payH1(`Bonjour ${escapeHtml(nz.firstName)},`, escapeHtml(title) + '.')}<p style="margin:0 0 18px">${escapeHtml(body)}</p><p style="margin:0">${mailButton('Voir mes réservations', space, true)}</p>`,
    text: payText([`Bonjour ${nz.firstName},`, '', body, '', `Vos réservations : ${space}`, '', 'L’équipe Mon Nzonzi']),
  };
}

// ——— Page de la famille : /reservation/<lien> (acompte, solde, puis confirmation après la cérémonie) ———
function payMessage(title, text, status = 200) {
  return payPage(layout(title, `<main class="legal" id="main"><div class="shell"><p class="kicker">Réservation</p><h1>${title}</h1><p>${text}</p><p style="margin-top:22px"><a class="btn secondary" href="/">Retour à Mon Nzonzi</a></p></div></main>`), status);
}
// Partie à payer maintenant (acompte, solde) ou null.
function payDue(row, now = Date.now()) {
  if (row.status === 'accepted' && !payCeremonyPassed(row.ceremony_date, now)) return 'deposit';
  if (row.status === 'reserved' && payWindowOpen(row.ceremony_date, now) && !payCeremonyPassed(row.ceremony_date, now)) return 'balance';
  return null;
}
function payView(row, state = {}) {
  const nz = payNz(row);
  const who = [nz.firstName, nz.lastName].filter(Boolean).join(' ');
  const test = !row.livemode;
  const date = payFmtDay(row.ceremony_date);
  const paidLabel = part => row[part + '_paid_at'] ? ' · payé le ' + formatDate.format(new Date(row[part + '_paid_at'])) : '';
  const details = [['Famille', row.family_name], ['Nzonzi', who], ['Cérémonie', [date, row.ceremony_city].filter(Boolean).join(' · ')], ['Prix', payEuro(row.base_cents)], ['Frais de déplacement ou options', row.extra_cents ? payEuro(row.extra_cents) : ''],
    ['Acompte (' + PAYMENT_RULES.depositPercent + ' %)', payEuro(row.deposit_cents) + paidLabel('deposit')], ['Solde', payEuro(row.balance_cents) + (paidLabel('balance') || ' · à partir du ' + payFmtDay(payOpensOn(row.ceremony_date)))], ['Référence', payRef(row.id)]]
    .filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v)}</dd>`).join('');
  const error = state.error ? `<div class="feedback error" role="alert">${escapeHtml(state.error)}</div>` : '';
  const due = payDue(row);
  let action;
  if (due && state.returned) {
    action = `<div class="feedback" role="status"><p><strong>Paiement en cours de confirmation.</strong></p><p>Vous recevrez un reçu par email dans quelques instants. Vous pouvez recharger cette page.</p></div>`;
  } else if (due) {
    const amount = row[due + '_cents'];
    const intro = due === 'deposit'
      ? `<p>Pour réserver ${escapeHtml(nz.firstName)}, payez l’acompte de <strong>${payEuro(amount)}</strong>. Il lui est versé ${DEPOSIT_RELEASE_DAYS} jours plus tard pour préparer la cérémonie. Le solde se paiera à partir du ${payFmtDay(payOpensOn(row.ceremony_date))} et restera bloqué jusqu’après la cérémonie.</p>`
      : `<p>Acompte payé, merci. Vous pouvez maintenant régler le solde de <strong>${payEuro(amount)}</strong>. Il reste bloqué et n’est versé à ${escapeHtml(nz.firstName)} qu’après la cérémonie, quand vous aurez confirmé que tout s’est bien passé.</p>`;
    action = `${error}${state.cancelled ? '<div class="feedback" role="status">Paiement interrompu. Vous pouvez réessayer quand vous le souhaitez.</div>' : ''}
      <form method="post" class="pay-box"><input type="hidden" name="action" value="pay"><input type="hidden" name="part" value="${due}">
        ${intro}
        <label class="check"><input type="checkbox" name="accord" value="oui" required><span>J’ai lu les conditions d’annulation et de remboursement ci-dessous et les <a href="/cgu" target="_blank">conditions d’utilisation</a>. Si la cérémonie a lieu dans les ${PAYMENT_RULES.withdrawalDays} jours, je demande qu’elle soit réalisée avant la fin du délai de rétractation.</span></label>
        <button class="btn" type="submit">${icon('lock')} Payer ${due === 'deposit' ? 'l’acompte' : 'le solde'} · ${payEuro(amount)}</button>
        <p class="note">Paiement par carte sur la page sécurisée de notre partenaire Stripe. Mon Nzonzi ne voit jamais votre numéro de carte.</p>
      </form>`;
  } else if (row.status === 'reserved') {
    action = `<div class="feedback" role="status"><p><strong>Réservation confirmée, acompte payé.</strong></p><p>${payCeremonyPassed(row.ceremony_date) ? 'Le solde n’a pas été réglé avant la cérémonie. Contactez-nous.' : `Le solde de ${payEuro(row.balance_cents)} pourra être payé à partir du ${payFmtDay(payOpensOn(row.ceremony_date))}. Nous vous enverrons un email avec ce même lien.`}</p>${nz.contactEmail || nz.phone ? `<p>Pour préparer la cérémonie : ${escapeHtml([nz.contactEmail, nz.phone].filter(Boolean).join(' · '))}</p>` : ''}</div>`;
  } else if (row.status === 'paid' && payCeremonyPassed(row.ceremony_date)) {
    action = `${error}<div class="pay-box"><h2 class="pay-h">Votre cérémonie s’est-elle bien passée ?</h2>
      <form method="post"><input type="hidden" name="action" value="confirm"><button class="btn" type="submit">${icon('check')} Oui, tout s’est bien passé</button><p class="note">${escapeHtml(nz.firstName)} reçoit alors le solde.</p></form>
      <details class="pay-dispute"><summary class="link">${escapeHtml(nz.firstName)} n’est pas venu, ou il y a eu un problème</summary>
      <form method="post"><input type="hidden" name="action" value="dispute">
        <label class="field">Expliquez-nous ce qui s’est passé<textarea name="message" maxlength="2000" required placeholder="Ex. Le nzonzi n’est pas venu le jour de la cérémonie."></textarea></label>
        <button class="btn secondary" type="submit">Signaler le problème</button>
        <p class="note">Le solde reste bloqué. L’équipe Mon Nzonzi vous contacte, ainsi que ${escapeHtml(nz.firstName)}, pour trouver une solution (remboursement total ou partiel si besoin).</p>
      </form></details></div>`;
  } else if (row.status === 'paid') {
    action = `<div class="feedback" role="status"><p><strong>Réservation entièrement réglée. Merci !</strong></p><p>Le solde reste bloqué chez Stripe jusqu’après la cérémonie. Le lendemain, nous vous demanderons si tout s’est bien passé avant de le verser à ${escapeHtml(nz.firstName)}.</p>${nz.contactEmail || nz.phone ? `<p>Pour préparer la cérémonie : ${escapeHtml([nz.contactEmail, nz.phone].filter(Boolean).join(' · '))}</p>` : ''}</div>`;
  } else {
    const texts = {
      accepted: 'La date de la cérémonie est passée sans réservation.',
      disputed: 'Problème signalé. Le solde reste bloqué : l’équipe Mon Nzonzi vous contacte rapidement.',
      released: `Merci ! ${nz.firstName} a reçu son paiement.`,
      refunded: `Cette réservation a été remboursée (${payEuro(payRefundedAll(row))}).`,
      cancelled: 'Cette réservation a été annulée. Aucun paiement n’a été fait.',
      declined: `${nz.firstName} n’est pas disponible pour cette cérémonie.`,
    };
    action = `<div class="feedback${['cancelled', 'declined', 'accepted'].includes(row.status) ? ' error' : ''}" role="status"><p><strong>${escapeHtml(texts[row.status] || '')}</strong></p></div>`;
  }
  return layout('Ma réservation', `<main class="legal pay" id="main"><div class="shell">
  <p class="kicker">Réservation · paiement protégé</p>
  <h1>Votre cérémonie avec ${escapeHtml(who)}</h1>
  ${test ? '<p class="pay-test" role="note"><strong>Mode test</strong> · aucun vrai paiement. Carte de test : 4242 4242 4242 4242, date future, n’importe quel code.</p>' : ''}
  <section class="panel pay-summary">
    <p class="kicker">Total</p><strong class="price">${payEuro(row.amount_cents)}</strong>
    <p class="note">Commission Mon Nzonzi incluse, sans frais supplémentaires.</p>
    <dl>${details}</dl>
    ${row.note ? `<p class="pay-note">${escapeHtml(row.note)}</p>` : ''}
    ${action}
  </section>
  <h2>Comment votre argent est protégé</h2>
  <ul><li>Vous payez sur Mon Nzonzi, jamais directement au nzonzi.</li><li>L’acompte (${PAYMENT_RULES.depositPercent} %) est versé au nzonzi ${DEPOSIT_RELEASE_DAYS} jours après votre paiement, pour couvrir ses frais (déplacement, préparation).</li><li>Le solde reste bloqué chez notre partenaire de paiement Stripe jusqu’après la cérémonie. Le lendemain, vous confirmez que tout s’est bien passé et le nzonzi est payé. En cas d’absence ou de problème, vous le signalez et le solde reste bloqué le temps de trouver une solution.</li></ul>
  <h2 id="annulation">Annulation et remboursement</h2>
  ${paymentRulesHtml()}
</div></main>
<style>
.pay-summary{padding:clamp(20px,3vw,32px);margin-top:20px;display:grid;gap:12px}
.pay-summary .price{font-size:44px}
.pay-summary dl{margin-top:8px}
.pay-note{white-space:pre-wrap;padding:14px 16px;border-left:4px solid var(--bordeaux);background:var(--blanc);border-radius:0 12px 12px 0}
.pay-box{display:grid;gap:14px;border-top:1px solid var(--line);padding-top:16px;margin-top:6px}
.pay-box form{display:grid;gap:10px}.pay-box .btn{justify-self:start}
.pay-h{font-size:24px!important;margin:0!important}
.pay-dispute summary{cursor:pointer}.pay-dispute form{margin-top:12px}
.pay .check a{color:var(--bordeaux)}
.pay-test{margin:12px 0;padding:12px 16px;border-radius:12px;background:#F3E1D9;border:1px dashed var(--bordeaux);font-size:15px}
</style>`);
}
export async function bookingRoute(request, env, token, ctx) {
  const url = new URL(request.url);
  if (!['GET', 'HEAD', 'POST'].includes(request.method)) return new Response(null, { status: 405, headers: payHeaders });
  if (!env.DB) return payMessage('Service indisponible', 'Réessayez plus tard.', 503);
  const load = () => /^[A-Za-z0-9_-]{20,60}$/.test(token) ? payBooking(env, 'b.token = ?', token) : null;
  let row;
  try { row = await load(); } catch { row = null; }
  if (!row) return payMessage('Lien introuvable', 'Ce lien n’existe pas ou n’est plus valable. Vérifiez l’email reçu ou écrivez-nous.', 404);
  // Clé Stripe absente ou d'un autre mode (test/live) que la réservation : paiement impossible.
  const usable = Boolean(stripeMode(env)) && payLivemode(env) === row.livemode;
  if (request.method === 'HEAD') return payPage(null);
  if (request.method === 'GET') {
    const returned = url.searchParams.get('retour') === 'ok';
    // Retour de Stripe : on vérifie tout de suite la session, sans attendre le webhook.
    const due = payDue(row);
    if (returned && due && row[due + '_session'] && usable) {
      try {
        const session = await stripeCall(env, 'GET', '/checkout/sessions/' + encodeURIComponent(row[due + '_session']));
        if (session.payment_status === 'paid') { await payMarkPaid(env, url.origin, session, ctx); row = await load(); }
      } catch {}
    }
    return payPage(payView(row, { returned, cancelled: url.searchParams.get('retour') === 'annule' }));
  }
  if (request.headers.get('Origin') !== url.origin) return payPage(payView(row, { error: 'Origine de la demande non autorisée.' }), 403);
  if (!(request.headers.get('Content-Type') || '').startsWith('application/x-www-form-urlencoded')) return new Response(null, { status: 415, headers: payHeaders });
  const raw = await request.text();
  if (raw.length > 6000) return new Response(null, { status: 413, headers: payHeaders });
  const form = new URLSearchParams(raw);
  const action = form.get('action');
  const back = () => new Response(null, { status: 303, headers: { ...payHeaders, Location: url.pathname } });
  try {
    if (action === 'confirm' || action === 'dispute') {
      if (row.status !== 'paid' || !payCeremonyPassed(row.ceremony_date)) return payPage(payView(row), 409);
      if (action === 'confirm') { await payRelease(env, url.origin, row, 'family', ctx); return back(); }
      const message = String(form.get('message') || '').trim().slice(0, 2000);
      if (message.length < 10) return payPage(payView(row, { error: 'Expliquez en quelques mots ce qui s’est passé.' }), 400);
      const done = await env.DB.prepare("UPDATE bookings SET status = 'disputed', disputed_at = ?, dispute_message = ? WHERE id = ? AND status = 'paid'").bind(new Date().toISOString(), message, row.id).run();
      if (payChanges(done)) {
        const nz = payNz(row);
        await payLater(ctx, Promise.all([
          sendMail(env, { to: adminEmails(env), replyTo: { email: row.family_email, name: row.family_name }, subject: `Litige signalé : ${row.family_name} → ${[nz.firstName, nz.lastName].join(' ')}`, text: payText(['Bonjour,', '', `${row.family_name} signale un problème pour la cérémonie du ${payFmtDay(row.ceremony_date)} avec ${nz.firstName} ${nz.lastName} (${payEuro(row.amount_cents)}, référence ${payRef(row.id)}).`, '', 'Message de la famille :', message, '', `Le solde (${payEuro(partKept(row, 'balance'))}) reste bloqué. À trancher dans l’admin : ${url.origin}/partenaire/admin#paiements`, 'Attention : Stripe ne permet pas de garder l’argent plus de 90 jours après le paiement.', '', 'Mon Nzonzi']) }),
          sendMail(env, payNzonziMail(env, row, 'disputed', url.origin)),
        ]));
      }
      return back();
    }
    const part = form.get('part');
    if (action !== 'pay' || !PARTS.includes(part)) return payPage(payView(row), 400);
    if (payDue(row) !== part) return payPage(payView(row), 409);
    if (!usable) return payPage(payView(row, { error: 'Le paiement en ligne est momentanément indisponible. Réessayez plus tard.' }), 503);
    if (form.get('accord') !== 'oui') return payPage(payView(row, { error: 'Cochez la case pour accepter les conditions avant de payer.' }), 400);
    // Une session Stripe encore ouverte est réutilisée (évite un double paiement).
    if (row[part + '_session']) {
      const previous = await stripeCall(env, 'GET', '/checkout/sessions/' + encodeURIComponent(row[part + '_session']));
      if (previous.status === 'open' && previous.url) return new Response(null, { status: 303, headers: { ...payHeaders, Location: previous.url } });
      if (previous.payment_status === 'paid') { await payMarkPaid(env, url.origin, previous, ctx); return back(); }
    }
    const nz = payNz(row);
    const self = url.origin + '/reservation/' + token;
    const session = await stripeCall(env, 'POST', '/checkout/sessions', {
      mode: 'payment', locale: 'fr', customer_email: row.family_email, client_reference_id: row.id,
      payment_method_types: ['card'],
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      success_url: self + '?retour=ok', cancel_url: self + '?retour=annule',
      line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: row[part + '_cents'], product_data: { name: `${PART_LABEL[part]} · cérémonie de dot du ${payFmtDay(row.ceremony_date)} avec ${nz.firstName} ${nz.lastName}`, description: 'Réservation via Mon Nzonzi, commission incluse. Référence ' + payRef(row.id) } } }],
      payment_intent_data: { description: `Mon Nzonzi · ${PART_LABEL[part].toLowerCase()} · réservation ${payRef(row.id)} · ${nz.firstName} ${nz.lastName}`, transfer_group: 'booking_' + row.id, metadata: { booking_id: row.id, part } },
      metadata: { booking_id: row.id, part },
    });
    await env.DB.prepare(`UPDATE bookings SET ${part}_session = ? WHERE id = ?`).bind(session.id, row.id).run();
    return new Response(null, { status: 303, headers: { ...payHeaders, Location: session.url } });
  } catch {
    return payPage(payView(row, { error: 'L’action n’a pas pu aboutir. Réessayez dans quelques minutes.' }), 502);
  }
}

// ——— Paiement confirmé (acompte ou solde) ———
async function payMarkPaid(env, origin, session, ctx) {
  const id = session?.metadata?.booking_id || session?.client_reference_id;
  const part = session?.metadata?.part;
  if (!id || !PARTS.includes(part) || session.payment_status !== 'paid') return false;
  const row = await payBooking(env, 'b.id = ?', id);
  if (!row) return false;
  const intent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || '';
  const from = part === 'deposit' ? ['accepted', 'cancelled'] : ['reserved'];
  if (row[part + '_paid_at'] || !from.includes(row.status)) {
    if (!intent || intent === row[part + '_intent']) return false;
    // Paiement en trop (double paiement, réservation dans un autre état) : remboursé automatiquement, l'équipe est prévenue.
    try { await stripeCall(env, 'POST', '/refunds', { payment_intent: intent, reason: 'duplicate', metadata: { booking_id: id } }, 'duplicate-' + intent); } catch {}
    await sendMail(env, { to: adminEmails(env), subject: 'Paiement en double remboursé automatiquement', text: `Bonjour,\n\n${row.family_name} a payé une seconde fois (${PART_LABEL[part].toLowerCase()}, référence ${payRef(id)}). Ce paiement (${intent}) a été remboursé automatiquement. Vérifiez dans Stripe.\n\nMon Nzonzi` });
    return false;
  }
  const paidAt = new Date().toISOString();
  const next = part === 'deposit' ? 'reserved' : 'paid';
  const done = await env.DB.prepare(`UPDATE bookings SET status = ?, ${part}_paid_at = ?, ${part}_intent = ?, ${part}_session = ? WHERE id = ? AND ${part}_paid_at IS NULL AND status IN (${from.map(() => '?').join(', ')})`).bind(next, paidAt, intent, session.id || row[part + '_session'], id, ...from).run();
  if (!payChanges(done)) return false;
  // Solde déjà payable : l'email « payable » est inutile, la page propose directement le solde.
  if (part === 'deposit' && payWindowOpen(row.ceremony_date)) await env.DB.prepare('UPDATE bookings SET pay_mail_at = ? WHERE id = ?').bind(paidAt, id).run();
  const paid = { ...row, status: next, [part + '_paid_at']: paidAt, [part + '_intent']: intent };
  const mails = [sendMail(env, payFamilyMail(paid, 'paid-' + part, origin)), sendMail(env, payNzonziMail(env, paid, 'paid-' + part, origin))];
  if (row.status === 'cancelled') mails.push(sendMail(env, { to: adminEmails(env), subject: 'Acompte reçu sur une réservation annulée', text: `Bonjour,\n\n${row.family_name} a payé l’acompte de la réservation ${payRef(id)} juste après son annulation par le nzonzi. Elle est repassée en « réservée ». Vérifiez avec le nzonzi et remboursez si besoin : ${origin}/partenaire/admin#paiements\n\nMon Nzonzi` }));
  await payLater(ctx, Promise.all(mails));
  return true;
}

// ——— Versement au nzonzi (transfert Stripe vers son compte Express) ———
async function payTransfer(env, origin, row, part, by) {
  const net = partNet(row, part);
  if (!row[part + '_paid_at'] || row[part + '_released_at']) return { skipped: true };
  const claimed = await env.DB.prepare(`UPDATE bookings SET ${part}_transfer = 'pending' WHERE id = ? AND ${part}_transfer IS NULL AND ${part}_released_at IS NULL`).bind(row.id).run();
  if (!payChanges(claimed)) return { skipped: true };
  const now = new Date().toISOString();
  if (net <= 0) {
    await env.DB.prepare(`UPDATE bookings SET ${part}_transfer = 'none', ${part}_released_at = ? WHERE id = ?`).bind(now, row.id).run();
    return { amount: 0 };
  }
  try {
    const intent = await stripeCall(env, 'GET', '/payment_intents/' + encodeURIComponent(row[part + '_intent']));
    const charge = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id;
    const transfer = await stripeCall(env, 'POST', '/transfers', {
      amount: net, currency: 'eur', destination: row.account_id, source_transaction: charge, transfer_group: 'booking_' + row.id,
      description: `${PART_LABEL[part]} · cérémonie du ${row.ceremony_date} · ${row.family_name}`, metadata: { booking_id: row.id, part, released_by: by },
    }, 'release-' + part + '-' + row.id);
    await env.DB.prepare(`UPDATE bookings SET ${part}_transfer = ?, ${part}_released_at = ? WHERE id = ?`).bind(transfer.id, now, row.id).run();
    return { amount: net };
  } catch (e) {
    await env.DB.prepare(`UPDATE bookings SET ${part}_transfer = NULL WHERE id = ? AND ${part}_transfer = 'pending'`).bind(row.id).run();
    await sendMail(env, { to: adminEmails(env), subject: 'Versement au nzonzi impossible', text: `Bonjour,\n\nLe versement (${PART_LABEL[part].toLowerCase()}) de la réservation ${payRef(row.id)} (${row.family_name}, ${payEuro(net)}) a échoué : ${e.message}.\nVérifiez le compte Stripe du nzonzi, puis réessayez depuis l’admin : ${origin}/partenaire/admin#paiements\n\nMon Nzonzi` });
    return { error: 'Versement impossible : ' + e.message };
  }
}
// Fin de la réservation : acompte (s'il ne l'est pas déjà) et solde versés.
// by : 'family' (confirmation), 'auto' (sans réponse), 'admin' (décision de l'équipe).
async function payRelease(env, origin, row, by, ctx) {
  if (!['paid', 'disputed'].includes(row.status)) return { error: 'Cette réservation ne peut pas être versée.' };
  const deposit = await payTransfer(env, origin, row, 'deposit', by);
  if (deposit.error) return deposit;
  const balance = await payTransfer(env, origin, row, 'balance', by);
  if (balance.error) return balance;
  const now = new Date().toISOString();
  const done = await env.DB.prepare("UPDATE bookings SET status = 'released', released_by = ?, confirmed_at = CASE WHEN ? = 'family' THEN ? ELSE confirmed_at END WHERE id = ? AND status IN ('paid', 'disputed')").bind(by, by, now, row.id).run();
  if (payChanges(done) && balance.amount) await payLater(ctx, sendMail(env, payNzonziMail(env, { ...row, balance_released_at: now }, 'released', origin)));
  return { status: 'released' };
}

// ——— Tâche quotidienne ———
// 1. Acompte versé au nzonzi après le délai de rétractation.  2. Solde payable (J-80) : email à la famille.
// 3. Cérémonie passée sans acompte : annulée ; avec acompte mais sans solde : alerte à l'équipe.
// 4. Lendemain de la cérémonie : demande de confirmation.  5. Sans réponse : versement automatique.
// 6. Solde ou litige bloqué depuis plus de 75 jours : alerte à l'équipe (limite Stripe de 90 jours).
export async function bookingsCron(env, origin = SITE_ORIGIN, now = Date.now(), ctx) {
  const done = { deposits: 0, payable: 0, confirm: 0, released: 0, expired: 0, alerts: 0 };
  if (!env?.DB || !stripeMode(env)) return done;
  const livemode = payLivemode(env);
  const today = payToday(now);
  const iso = new Date(now).toISOString();
  const rows = sql => env.DB.prepare(`SELECT b.*, p.published_json, p.profile_json FROM bookings b LEFT JOIN nzozi_profiles p ON p.user_id = b.user_id WHERE b.livemode = ? AND ${sql} LIMIT 100`);
  const alert = async (row, subject, text) => {
    await sendMail(env, { to: adminEmails(env), subject, text: `Bonjour,\n\n${text}\n\nAdmin : ${origin}/partenaire/admin#paiements\n\nMon Nzonzi` });
    await env.DB.prepare('UPDATE bookings SET alert_at = ? WHERE id = ?').bind(iso, row.id).run();
    done.alerts++;
  };
  const { results: deposits } = await rows("b.status IN ('reserved', 'paid') AND b.deposit_paid_at IS NOT NULL AND b.deposit_released_at IS NULL AND b.deposit_transfer IS NULL").bind(livemode).all();
  for (const row of deposits) {
    if (depositDueAt(row) > now) continue;
    const result = await payTransfer(env, origin, row, 'deposit', 'auto');
    if (result.amount) { done.deposits++; await sendMail(env, payNzonziMail(env, row, 'released-deposit', origin)); }
  }
  const { results: payable } = await rows("b.status = 'reserved' AND b.pay_mail_at IS NULL AND b.ceremony_date >= ?").bind(livemode, today).all();
  for (const row of payable) {
    if (!payWindowOpen(row.ceremony_date, now)) continue;
    if (await sendMail(env, payFamilyMail(row, 'payable', origin))) { await env.DB.prepare('UPDATE bookings SET pay_mail_at = ? WHERE id = ?').bind(iso, row.id).run(); done.payable++; }
  }
  const { results: expired } = await rows("b.status = 'accepted' AND b.ceremony_date < ?").bind(livemode, today).all();
  for (const row of expired) { await env.DB.prepare("UPDATE bookings SET status = 'cancelled', cancelled_at = ? WHERE id = ? AND status = 'accepted'").bind(iso, row.id).run(); done.expired++; }
  const { results: unpaid } = await rows("b.status = 'reserved' AND b.ceremony_date < ? AND b.alert_at IS NULL").bind(livemode, today).all();
  for (const row of unpaid) await alert(row, `Solde non payé : réservation ${payRef(row.id)}`, `La cérémonie du ${row.ceremony_date} (${row.family_name}) est passée mais le solde de ${payEuro(row.balance_cents)} n’a pas été payé. Le nzonzi garde l’acompte. Voyez avec la famille et le nzonzi.`);
  const { results: toConfirm } = await rows("b.status = 'paid' AND b.confirm_mail_at IS NULL AND b.ceremony_date < ?").bind(livemode, today).all();
  for (const row of toConfirm) {
    if (await sendMail(env, payFamilyMail(row, 'confirm', origin))) { await env.DB.prepare('UPDATE bookings SET confirm_mail_at = ? WHERE id = ?').bind(iso, row.id).run(); done.confirm++; }
  }
  const { results: toRelease } = await rows("b.status = 'paid' AND b.confirm_mail_at IS NOT NULL AND b.confirm_mail_at < ?").bind(livemode, new Date(now - RELEASE_AFTER_DAYS * PAY_DAY_MS).toISOString()).all();
  for (const row of toRelease) if ((await payRelease(env, origin, row, 'auto', ctx)).status) done.released++;
  const { results: old } = await rows("b.status IN ('paid', 'disputed') AND b.balance_paid_at < ? AND (b.alert_at IS NULL OR b.alert_at < ?)").bind(livemode, new Date(now - 75 * PAY_DAY_MS).toISOString(), new Date(now - 3 * PAY_DAY_MS).toISOString()).all();
  for (const row of old) await alert(row, `À trancher vite : réservation ${payRef(row.id)} payée il y a plus de 75 jours`, `La réservation ${payRef(row.id)} (${row.family_name}, solde ${payEuro(row.balance_cents)}, cérémonie du ${row.ceremony_date}) est ${row.status === 'disputed' ? 'en litige' : 'toujours bloquée'} ; le solde a été payé le ${String(row.balance_paid_at).slice(0, 10)}.\nStripe ne permet pas de garder l’argent plus de 90 jours : remboursez ou versez au nzonzi depuis l’admin.`);
  return done;
}

// ——— Webhook Stripe : POST /stripe/webhook (événements du compte Mon Nzonzi) ———
// checkout.session.completed / async_payment_succeeded : paiement reçu.
// charge.refunded : remboursement fait (y compris depuis le tableau de bord Stripe).
export async function stripeWebhook(request, env, ctx) {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  if (!env.STRIPE_WEBHOOK_SECRET || !stripeMode(env) || !env.DB) return new Response('Paiements désactivés', { status: 503 });
  const payload = await request.text();
  if (payload.length > 512 * 1024) return new Response(null, { status: 413 });
  if (!await verifyStripeSignature(payload, request.headers.get('Stripe-Signature'), env.STRIPE_WEBHOOK_SECRET)) return new Response('Signature invalide', { status: 400 });
  let event;
  try { event = JSON.parse(payload); } catch { return new Response(null, { status: 400 }); }
  // Événement d'un autre mode (test/live) que la clé en service : ignoré.
  if (Boolean(event.livemode) !== (stripeMode(env) === 'live')) return new Response('ignoré', { status: 200 });
  const object = event.data?.object || {};
  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      await payMarkPaid(env, new URL(request.url).origin, object, ctx);
    } else if (event.type === 'charge.refunded' && object.payment_intent) {
      const intent = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent.id;
      const refunded = Number(object.amount_refunded || 0);
      for (const part of PARTS) {
        await env.DB.prepare(`UPDATE bookings SET ${part}_refunded = ?, refunded_at = COALESCE(refunded_at, ?) WHERE ${part}_intent = ? AND ${part}_refunded < ?`).bind(refunded, new Date().toISOString(), intent, refunded).run();
      }
    }
  } catch {
    return new Response('Erreur temporaire', { status: 500 });   // Stripe réessaiera
  }
  return new Response('ok', { status: 200 });
}

// ——— Administration : suivi, litiges, remboursements, versements ———
// Remboursement : d'abord sur le solde (encore bloqué), puis sur l'acompte. Si l'acompte a déjà été
// versé au nzonzi, la part correspondante (85 %) est reprise sur son compte Stripe (annulation de transfert).
async function payRefund(env, row, amount, reason) {
  let left = amount;
  const steps = [];
  for (const part of ['balance', 'deposit']) {
    if (!left) break;
    if (!row[part + '_paid_at'] || (part === 'balance' && row.balance_released_at)) continue;
    const take = Math.min(left, row[part + '_cents'] - row[part + '_refunded']);
    if (take <= 0) continue;
    steps.push([part, take]);
    left -= take;
  }
  if (left) throw new Error('Montant trop élevé.');
  for (const [part, take] of steps) {
    const transfer = row[part + '_transfer'];
    if (row[part + '_released_at'] && transfer && transfer.startsWith('tr_')) {
      await stripeCall(env, 'POST', '/transfers/' + encodeURIComponent(transfer) + '/reversals', { amount: take - payFee(take), metadata: { booking_id: row.id, motif: reason } }, 'reversal-' + row.id + '-' + part + '-' + row[part + '_refunded'] + '-' + take);
    }
    await stripeCall(env, 'POST', '/refunds', {
      payment_intent: row[part + '_intent'], amount: take,
      reason: reason === 'Paiement en double' ? 'duplicate' : 'requested_by_customer', metadata: { booking_id: row.id, part, motif: reason },
    }, 'refund-' + row.id + '-' + part + '-' + row[part + '_refunded'] + '-' + take);
    await env.DB.prepare(`UPDATE bookings SET ${part}_refunded = ${part}_refunded + ?, refunded_at = ?, refund_reason = ? WHERE id = ?`).bind(take, new Date().toISOString(), reason, row.id).run();
    row = { ...row, [part + '_refunded']: row[part + '_refunded'] + take };
  }
  return row;
}
const payRefundable = b => ['reserved', 'paid', 'disputed'].includes(b.status)
  ? (b.balance_paid_at && !b.balance_released_at ? b.balance_cents - b.balance_refunded : 0) + (b.deposit_paid_at ? b.deposit_cents - b.deposit_refunded : 0) : 0;

export async function adminPaymentsApi(request, env, url, ctx) {
  if (!env.DB) return payJson({ error: 'Base de données indisponible.' }, 503);
  const mode = stripeMode(env);
  const livemode = payLivemode(env);
  try {
    if (request.method === 'GET') {
      if (!mode) return payJson({ mode: null, bookings: [], accounts: [], reasons: PAY_REFUND_REASONS });
      const { results: bookings } = await env.DB.prepare("SELECT b.*, p.published_json, p.profile_json FROM bookings b LEFT JOIN nzozi_profiles p ON p.user_id = b.user_id WHERE b.livemode = ? AND b.status != 'declined' ORDER BY CASE b.status WHEN 'disputed' THEN 0 WHEN 'paid' THEN 1 WHEN 'reserved' THEN 2 ELSE 3 END, b.created_at DESC LIMIT 200").bind(livemode).all();
      const { results: accounts } = await env.DB.prepare('SELECT a.*, p.published_json, p.profile_json FROM stripe_accounts a LEFT JOIN nzozi_profiles p ON p.user_id = a.user_id WHERE a.livemode = ? ORDER BY a.updated_at DESC LIMIT 200').bind(livemode).all();
      const name = r => { const d = payNz(r); return [d.firstName, d.lastName].filter(Boolean).join(' ') || r.email || ''; };
      const part = (b, p) => ({ amount: b[p + '_cents'], paidAt: b[p + '_paid_at'], releasedAt: b[p + '_released_at'], refunded: b[p + '_refunded'], net: partNet(b, p), intent: b[p + '_intent'], dueAt: p === 'deposit' && b.deposit_paid_at && !b.deposit_released_at ? new Date(depositDueAt(b)).toISOString() : null });
      return payJson({
        mode, live: mode === 'live', enabledForAll: env.PAYMENTS_ENABLED === 'true', webhook: Boolean(env.STRIPE_WEBHOOK_SECRET), reasons: PAY_REFUND_REASONS, windowDays: PAY_WINDOW_DAYS, depositPercent: PAYMENT_RULES.depositPercent,
        bookings: bookings.map(b => ({ id: b.id, ref: payRef(b.id), family: b.family_name, email: b.family_email, nzonzi: name(b), date: b.ceremony_date, city: b.ceremony_city, amount: b.amount_cents, status: b.status, createdAt: b.created_at, releasedBy: b.released_by, refunded: payRefundedAll(b), refundable: payRefundable(b), reason: b.refund_reason, dispute: b.dispute_message, disputedAt: b.disputed_at, note: b.note, deposit: part(b, 'deposit'), balance: part(b, 'balance'), canRelease: b.status === 'paid' || b.status === 'disputed' })),
        accounts: accounts.map(a => ({ nzonzi: name(a), email: a.email, account: a.account_id, ready: payAccountReady(a), payouts: Boolean(a.payouts_enabled), updatedAt: a.updated_at })),
      });
    }
    const { input, error } = await payReadJson(request, url);
    if (error) return error;
    if (!mode) return payJson({ error: 'Stripe n’est pas configuré.' }, 409);
    const { id, action } = input;
    if (typeof id !== 'string' || id.length > 100 || !['refund', 'release'].includes(action)) return payJson({ error: 'Requête invalide.' }, 400);
    const row = await payBooking(env, 'b.id = ? AND b.livemode = ?', id, livemode);
    if (!row) return payJson({ error: 'Réservation introuvable.' }, 404);
    if (action === 'release') {
      const result = await payRelease(env, url.origin, row, 'admin', ctx);
      return result.error ? payJson(result, 409) : payJson(result);
    }
    const reason = PAY_REFUND_REASONS[Number(input.reason)];
    if (!reason || input.reason === '' || input.reason === null) return payJson({ error: 'Choisissez le motif du remboursement.' }, 400);
    const refundable = payRefundable(row);
    if (!refundable) return payJson({ error: 'Rien à rembourser depuis le site pour cette réservation (déjà versée ou non payée). Voir dans Stripe.' }, 409);
    const amount = input.amount == null || input.amount === '' ? refundable : payCents(input.amount);
    if (!amount || amount < 1 || amount > refundable) return payJson({ error: `Montant à rembourser invalide (au plus ${payEuro(refundable)}).` }, 400);
    const updated = await payRefund(env, row, amount, reason);
    // Tout l'argent payé est rendu : la réservation est close.
    const full = payRefundedAll(updated) >= payPaidAll(updated);
    if (full) await env.DB.prepare("UPDATE bookings SET status = 'refunded' WHERE id = ?").bind(row.id).run();
    const nz = payNz(row);
    await payLater(ctx, Promise.all([
      sendMail(env, { to: [row.family_email], subject: `${row.livemode ? '' : '[TEST] '}Votre remboursement de ${payEuro(amount)}`, text: payText([`Bonjour ${row.family_name},`, '', `Nous avons remboursé ${payEuro(amount)} sur la carte utilisée pour votre réservation avec ${nz.firstName} (référence ${payRef(row.id)}).`, `Motif : ${reason}`, full ? 'Votre réservation est annulée.' : '', '', 'Le délai d’arrivée sur votre compte dépend de votre banque (en général 5 à 10 jours).', '', 'L’équipe Mon Nzonzi']) }),
      sendMail(env, payNzonziMail(env, { ...updated, refund_reason: reason, last_refund: amount }, 'refunded', url.origin)),
    ]));
    return payJson({ status: full ? 'refunded' : row.status, refunded: payRefundedAll(updated) });
  } catch (e) {
    return payJson({ error: 'Action impossible pour le moment (' + (e.message || 'erreur') + '). Vérifiez dans Stripe puis réessayez.' }, 503);
  }
}

// Section ajoutée à /partenaire/admin. Contenu inséré avec textContent (aucun HTML venant des données).
export function adminPaymentsSection(env) {
  if (!String(env?.STRIPE_SECRET_KEY || '')) return '';
  return `<section id="paiements" aria-labelledby="payments-title"><h2 id="payments-title">Réservations et paiements</h2>
  <p id="pay-mode" class="muted"></p>
  <div id="pay-totals" class="pay-totals"></div>
  <div id="list-bookings" class="admin-list"></div>
  <h3 class="pay-sub">Comptes Stripe des nzonzi</h3>
  <div id="list-accounts" class="admin-list"></div>
  </section>
  <style>
  .pay-totals{display:flex;flex-wrap:wrap;gap:12px;margin:12px 0 18px}.pay-totals div{padding:14px 18px;border-radius:14px;background:var(--card);border:1px solid var(--line)}
  .pay-totals strong{display:block;font-size:24px}.pay-sub{margin:28px 0 12px}
  .pay-mode-test{display:inline-block;padding:4px 10px;border-radius:999px;background:#F3E1D9;color:var(--bordeaux);font-weight:600}
  .admin-actions input{width:120px;min-height:50px}
  </style>
  <script>
  (() => {
    const fmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
    const eur = c => fmt.format(c / 100);
    const states = ${JSON.stringify(BOOKING_STATES)};
    const by = { family: 'confirmé par la famille', auto: 'automatique, sans réponse de la famille', admin: 'décision de l’équipe' };
    const mk = (tag, text, cls) => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; };
    const date = v => v ? new Date(v).toLocaleString('fr-FR') : '';
    const day = v => v ? new Date(v + 'T12:00:00Z').toLocaleDateString('fr-FR', { dateStyle: 'long' }) : '';
    const say = t => { document.getElementById('admin-status').textContent = t; };
    let reasons = [];
    const post = async data => { const r = await fetch('/api/admin/paiements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Action impossible.'); return d; };
    const partLine = (p, label) => !p.paidAt ? label + ' ' + eur(p.amount) + ' · non payé' : label + ' ' + eur(p.amount) + ' payé le ' + date(p.paidAt) + (p.refunded ? ' · ' + eur(p.refunded) + ' remboursé' : '') + (p.releasedAt ? ' · ' + eur(p.net) + ' versé au nzonzi le ' + date(p.releasedAt) : p.dueAt ? ' · versement prévu le ' + date(p.dueAt) : ' · bloqué');
    function card(b, data) {
      const a = mk('article', '', 'panel admin-card');
      if (b.status === 'disputed') a.classList.add('late');
      a.append(mk('span', (states[b.status] || b.status) + (b.refunded ? ' · ' + eur(b.refunded) + ' remboursé' : ''), 'admin-state'), mk('h3', b.family + ' → ' + b.nzonzi));
      const dl = document.createElement('dl');
      for (const [k, v] of [['Référence', b.ref], ['Cérémonie', [day(b.date), b.city].filter(Boolean).join(' · ')], ['Total', eur(b.amount)], ['Acompte', partLine(b.deposit, '')], ['Solde', partLine(b.balance, '')], ['Email famille', b.email], ['Acceptée le', date(b.createdAt)], ['Problème signalé', b.dispute ? date(b.disputedAt) + ' · ' + b.dispute : ''], ['Fin', b.releasedBy ? by[b.releasedBy] : ''], ['Motif du remboursement', b.reason], ['Message du nzonzi', b.note]]) if (v) dl.append(mk('dt', k), mk('dd', v.trim()));
      a.append(dl);
      const actions = mk('div', '', 'admin-actions');
      for (const [p, label] of [[b.deposit, 'acompte'], [b.balance, 'solde']]) if (p.intent) { const l = mk('a', 'Stripe : ' + label, 'btn secondary'); l.href = 'https://dashboard.stripe.com/' + (data.live ? '' : 'test/') + 'payments/' + encodeURIComponent(p.intent); l.target = '_blank'; l.rel = 'noopener'; actions.append(l); }
      if (b.canRelease) {
        const net = (b.deposit.releasedAt ? 0 : b.deposit.net) + b.balance.net;
        const rel = mk('button', 'Verser ' + eur(net) + ' au nzonzi', 'btn'); rel.type = 'button';
        rel.onclick = async () => { if (!window.confirm('Verser ' + eur(net) + ' à ' + b.nzonzi + ' ? Cette action est définitive.')) return; rel.disabled = true; say('Versement en cours…'); try { await post({ id: b.id, action: 'release' }); say('Versement effectué. Le nzonzi est prévenu.'); load(); } catch (e) { say(e.message); rel.disabled = false; } };
        actions.append(rel);
      }
      if (b.refundable) {
        const amount = mk('input'); amount.inputMode = 'decimal'; amount.value = String(b.refundable / 100).replace('.', ','); amount.setAttribute('aria-label', 'Montant à rembourser en euros');
        const select = document.createElement('select'); select.setAttribute('aria-label', 'Motif du remboursement');
        select.append(new Option('Motif du remboursement…', ''), ...reasons.map((t, i) => new Option(t, String(i))));
        const ref = mk('button', 'Rembourser', 'btn secondary'); ref.type = 'button';
        ref.onclick = async () => {
          if (select.value === '') { say('Choisissez le motif du remboursement.'); select.focus(); return; }
          if (!window.confirm('Rembourser ' + amount.value + ' € à ' + b.family + ' ? Cette action est définitive.' + (b.deposit.releasedAt ? ' L’acompte ayant déjà été versé, la part du nzonzi sera reprise sur son compte Stripe.' : ''))) return;
          ref.disabled = true; say('Remboursement en cours…');
          try { await post({ id: b.id, action: 'refund', amount: amount.value, reason: Number(select.value) }); say('Remboursement effectué. La famille et le nzonzi sont prévenus.'); load(); } catch (e) { say(e.message); ref.disabled = false; }
        };
        actions.append(amount, select, ref);
      }
      a.append(actions);
      return a;
    }
    async function load() {
      try {
        const r = await fetch('/api/admin/paiements', { cache: 'no-store' });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Chargement impossible.');
        reasons = data.reasons || [];
        const mode = document.getElementById('pay-mode');
        mode.replaceChildren();
        if (!data.mode) { mode.textContent = 'Clé Stripe invalide ou clé live non autorisée : paiements désactivés.'; return; }
        if (!data.live) mode.append(mk('span', 'Mode test', 'pay-mode-test'), ' ');
        mode.append((data.enabledForAll ? 'Réservations payantes ouvertes à tous les nzonzi.' : 'Réservations payantes visibles seulement par les nzonzi testeurs.') + ' Acompte de ' + data.depositPercent + ' % à la réservation, solde à partir de ' + data.windowDays + ' jours avant la cérémonie, bloqué jusqu’à la confirmation de la famille.' + (data.webhook ? '' : ' ⚠ Webhook Stripe non configuré (STRIPE_WEBHOOK_SECRET) : un paiement n’est enregistré que si la famille revient sur le site.'));
        const list = data.bookings;
        let held = 0, paidOut = 0, fees = 0, refunded = 0;
        for (const b of list) { refunded += b.refunded; for (const p of [b.deposit, b.balance]) { if (!p.paidAt) continue; if (p.releasedAt) { paidOut += p.net; fees += p.amount - p.refunded - p.net; } else if (!['refunded'].includes(b.status)) held += p.amount - p.refunded; } }
        const totals = [['Encaissé, pas encore versé', held], ['Versé aux nzonzi', paidOut], ['Commission Mon Nzonzi (sur les sommes versées)', fees], ['Remboursé', refunded]];
        document.getElementById('pay-totals').replaceChildren(...totals.map(([k, v]) => { const d = mk('div'); d.append(mk('span', k, 'muted'), mk('strong', eur(v))); return d; }));
        document.getElementById('list-bookings').replaceChildren(...(list.length ? list.map(b => card(b, data)) : [mk('p', 'Aucune réservation pour le moment.', 'muted')]));
        document.getElementById('list-accounts').replaceChildren(...(data.accounts.length ? data.accounts.map(a => { const c = mk('article', '', 'panel admin-card'); c.append(mk('span', a.ready ? (a.payouts ? 'Prêt à recevoir des paiements' : 'Prêt · virements en vérification') : 'Inscription Stripe non terminée', 'admin-state'), mk('h3', a.nzonzi || a.email)); const dl = document.createElement('dl'); for (const [k, v] of [['Email', a.email], ['Compte Stripe', a.account], ['Mis à jour', date(a.updatedAt)]]) if (v) dl.append(mk('dt', k), mk('dd', v)); c.append(dl); return c; }) : [mk('p', 'Aucun nzonzi n’a encore activé ses paiements.', 'muted')]));
      } catch (e) { document.getElementById('pay-mode').textContent = e.message || 'Chargement impossible.'; }
    }
    load();
  })();
  </script>`;
}
