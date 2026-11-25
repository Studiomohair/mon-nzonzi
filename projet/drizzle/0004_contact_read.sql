-- Date à laquelle le nzonzi a confirmé à la famille avoir reçu la demande (bouton dans « Mes demandes »).
ALTER TABLE contact_requests ADD COLUMN read_at TEXT;
