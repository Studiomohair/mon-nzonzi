-- Messagerie famille ↔ nzonzi sur le site (réservations payantes), 26/11/2026. Voir worker/payments.js.
-- conversations.token : lien personnel de la famille (/echange/<token>). reference = contact_requests.reference.
-- messages.body : texte enregistré tel qu'affiché (emails, numéros et liens masqués avant le paiement de l'acompte).
CREATE TABLE conversations (
 reference TEXT PRIMARY KEY NOT NULL,
 token TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE messages (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 reference TEXT NOT NULL,
 sender TEXT NOT NULL,
 body TEXT NOT NULL,
 masked INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX messages_reference ON messages (reference, created_at);
