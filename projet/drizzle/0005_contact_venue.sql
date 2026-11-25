-- Lieu de la cérémonie choisi par la famille (salle de réception, domicile familial…)
-- et son adresse (demandée pour une salle ou un domicile).
ALTER TABLE contact_requests ADD COLUMN ceremony_venue TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE contact_requests ADD COLUMN ceremony_address TEXT NOT NULL DEFAULT '';
