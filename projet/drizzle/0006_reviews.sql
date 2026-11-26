-- Avis des familles sur les nzonzi (26/11/2026).
-- Une ligne est créée quand l'invitation part (lien unique par email, après la date de la cérémonie).
-- reference : référence de la demande de contact d'origine (seules les familles ayant contacté le nzonzi via le site sont invitées).
-- token_hash : empreinte SHA-256 du lien envoyé (le lien lui-même n'est jamais stocké).
-- status : invited (lien envoyé), pending (avis reçu, à valider), approved (publié), rejected (refusé ou retiré).
-- family_email : sert seulement à l'invitation et à prévenir la famille en cas de refus.
CREATE TABLE reviews (
 reference TEXT PRIMARY KEY NOT NULL,
 profile_slug TEXT NOT NULL,
 family_email TEXT NOT NULL,
 family_name TEXT NOT NULL,
 ceremony_date TEXT NOT NULL DEFAULT '',
 token_hash TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL DEFAULT 'invited',
 rating INTEGER,
 comment TEXT NOT NULL DEFAULT '',
 author_name TEXT NOT NULL DEFAULT '',
 reject_reason TEXT NOT NULL DEFAULT '',
 invited_at TEXT NOT NULL,
 submitted_at TEXT,
 reviewed_at TEXT
);
--> statement-breakpoint
CREATE INDEX reviews_profile_status ON reviews (profile_slug, status);
--> statement-breakpoint
CREATE INDEX reviews_status_submitted ON reviews (status, submitted_at);
