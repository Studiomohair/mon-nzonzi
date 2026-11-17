CREATE TABLE demo_requests (
 user_id TEXT NOT NULL,
 reference TEXT NOT NULL,
 profile_slug TEXT NOT NULL,
 ceremony_city TEXT NOT NULL,
 ceremony_date TEXT NOT NULL,
 message TEXT NOT NULL,
 created_at TEXT NOT NULL,
 PRIMARY KEY (user_id, reference)
);
--> statement-breakpoint
CREATE INDEX demo_requests_user_created ON demo_requests (user_id, created_at DESC);
