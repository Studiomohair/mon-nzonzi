-- Date à laquelle le nzonzi a indiqué avoir lu la demande (bouton « J’ai lu cette demande »).
ALTER TABLE contact_requests ADD COLUMN read_at TEXT;
