ALTER TABLE "jb_agent_jobs" ADD COLUMN "lease_token" uuid;--> statement-breakpoint
ALTER TABLE "jb_agent_users" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;