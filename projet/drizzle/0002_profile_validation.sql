-- Validation des profils nzonzi par l'équipe avant publication.
-- status : pending (en attente), approved (publié et à jour), rejected (refusé ou retiré).
-- published_json : dernière version validée, seule affichée dans l'annuaire public.
ALTER TABLE nzozi_profiles ADD COLUMN email TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE nzozi_profiles ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE nzozi_profiles ADD COLUMN published_json TEXT;
--> statement-breakpoint
ALTER TABLE nzozi_profiles ADD COLUMN slug TEXT;
--> statement-breakpoint
ALTER TABLE nzozi_profiles ADD COLUMN reviewed_at TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX nzozi_profiles_slug ON nzozi_profiles (slug);
--> statement-breakpoint
CREATE INDEX nzozi_profiles_status ON nzozi_profiles (status, updated_at);
