-- Réservations payantes (Stripe Connect), 26/11/2026. Voir worker/payments.js.
-- Comptes Stripe Express des nzonzi, un par mode (test / live).
CREATE TABLE stripe_accounts (
 user_id TEXT NOT NULL,
 livemode INTEGER NOT NULL DEFAULT 0,
 account_id TEXT NOT NULL,
 email TEXT NOT NULL DEFAULT '',
 details_submitted INTEGER NOT NULL DEFAULT 0,
 transfers_active INTEGER NOT NULL DEFAULT 0,
 payouts_enabled INTEGER NOT NULL DEFAULT 0,
 requirements_due INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY (user_id, livemode)
);
--> statement-breakpoint
-- Une réservation naît quand le nzonzi accepte (ou refuse) une demande de famille (reference = contact_requests.reference).
-- status : accepted (acompte attendu), reserved (acompte payé), paid (solde payé, bloqué), disputed (problème signalé),
--          released (versé au nzonzi), refunded, cancelled, declined.
-- token : lien personnel de la famille (/reservation/<token>). Montants en centimes.
-- *_transfer : identifiant du transfert Stripe vers le nzonzi ('pending' pendant l'envoi, 'none' si rien à verser).
CREATE TABLE bookings (
 id TEXT PRIMARY KEY NOT NULL,
 token TEXT NOT NULL UNIQUE,
 reference TEXT NOT NULL,
 profile_slug TEXT NOT NULL,
 user_id TEXT NOT NULL,
 family_name TEXT NOT NULL,
 family_email TEXT NOT NULL,
 ceremony_date TEXT NOT NULL DEFAULT '',
 ceremony_city TEXT NOT NULL DEFAULT '',
 base_cents INTEGER NOT NULL DEFAULT 0,
 extra_cents INTEGER NOT NULL DEFAULT 0,
 amount_cents INTEGER NOT NULL DEFAULT 0,
 deposit_cents INTEGER NOT NULL DEFAULT 0,
 balance_cents INTEGER NOT NULL DEFAULT 0,
 note TEXT NOT NULL DEFAULT '',
 livemode INTEGER NOT NULL DEFAULT 0,
 account_id TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL,
 created_at TEXT NOT NULL,
 deposit_session TEXT,
 deposit_intent TEXT,
 deposit_paid_at TEXT,
 deposit_refunded INTEGER NOT NULL DEFAULT 0,
 deposit_transfer TEXT,
 deposit_released_at TEXT,
 balance_session TEXT,
 balance_intent TEXT,
 balance_paid_at TEXT,
 balance_refunded INTEGER NOT NULL DEFAULT 0,
 balance_transfer TEXT,
 balance_released_at TEXT,
 released_by TEXT,
 pay_mail_at TEXT,
 confirm_mail_at TEXT,
 confirmed_at TEXT,
 disputed_at TEXT,
 dispute_message TEXT NOT NULL DEFAULT '',
 refunded_at TEXT,
 refund_reason TEXT NOT NULL DEFAULT '',
 cancelled_at TEXT,
 alert_at TEXT
);
--> statement-breakpoint
CREATE INDEX bookings_user ON bookings (user_id, livemode, created_at);
--> statement-breakpoint
CREATE INDEX bookings_reference ON bookings (reference);
--> statement-breakpoint
CREATE INDEX bookings_status ON bookings (livemode, status, ceremony_date);
--> statement-breakpoint
CREATE INDEX bookings_deposit_intent ON bookings (deposit_intent);
--> statement-breakpoint
CREATE INDEX bookings_balance_intent ON bookings (balance_intent);
