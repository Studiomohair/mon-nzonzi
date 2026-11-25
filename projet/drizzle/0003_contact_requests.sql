-- Demandes envoyées par les familles depuis une fiche nzonzi (formulaire de contact).
-- status : pending (en cours d'envoi), sent (email transmis par Brevo), failed (échec d'envoi).
-- ip_hash : empreinte SHA-256 de l'adresse IP et du jour, pour limiter les envois abusifs.
-- Conservation : 12 mois, purge automatique à chaque nouvelle demande.
CREATE TABLE contact_requests (
 reference TEXT PRIMARY KEY NOT NULL,
 profile_slug TEXT NOT NULL,
 family_name TEXT NOT NULL,
 family_email TEXT NOT NULL,
 family_phone TEXT NOT NULL DEFAULT '',
 ceremony_city TEXT NOT NULL,
 ceremony_date TEXT NOT NULL DEFAULT '',
 message TEXT NOT NULL,
 ip_hash TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX contact_requests_ip_created ON contact_requests (ip_hash, created_at);
--> statement-breakpoint
CREATE INDEX contact_requests_created ON contact_requests (created_at);
