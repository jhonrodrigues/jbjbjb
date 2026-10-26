CREATE TABLE "jb_agent_activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" text DEFAULT 'system' NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"summary" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jb_agent_agents" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"description" text,
	"paused" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jb_agent_brand_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" text NOT NULL,
	"business_name" text,
	"logo_path" text,
	"logo_alt_path" text,
	"primary_color" text,
	"secondary_color" text,
	"accent_color" text,
	"typography" text,
	"segment" text,
	"visual_style" text,
	"tone" text,
	"visual_references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_fonts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" integer,
	"identity_status" text DEFAULT 'suggested' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jb_agent_campaign_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"lead_id" text NOT NULL,
	"source" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jb_agent_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"niche" text NOT NULL,
	"sub_niche" text,
	"country" text DEFAULT 'Brasil' NOT NULL,
	"state" text,
	"city" text,
	"region" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"bounding_box" jsonb,
	"max_leads" integer DEFAULT 100 NOT NULL,
	"max_per_run" integer DEFAULT 25 NOT NULL,
	"frequency" text DEFAULT 'manual' NOT NULL,
	"prospect_source" text DEFAULT 'google_places' NOT NULL,
	"search_provider" text DEFAULT 'n8n' NOT NULL,
	"auto_analyze" boolean DEFAULT false NOT NULL,
	"auto_lp" boolean DEFAULT false NOT NULL,
	"require_human" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jb_agent_contact_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"type" text NOT NULL,
	"from_stage" text,
	"to_stage" text,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jb_agent_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" text NOT NULL,
	"campaign_id" uuid,
	"owner_id" uuid,
	"stage" text DEFAULT 'identificado' NOT NULL,
	"channel" text,
	"notes" text,
	"next_action_at" timestamp with time zone,
	"next_action" text,
	"proposed_value" numeric(12, 2),
	"closed_value" numeric(12, 2),
	"lp_id" text,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jb_agent_job_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"event" text NOT NULL,
	"worker_id" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jb_agent_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"agent_slug" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"campaign_id" uuid,
	"lead_id" text,
	"lp_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"idempotency_key" text,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error" text,
	"result" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jb_agent_lead_meta" (
	"lead_id" text PRIMARY KEY NOT NULL,
	"priority_override" text,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"discarded_at" timestamp with time zone,
	"discarded_reason" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jb_agent_lp_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lp_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"version" integer NOT NULL,
	"template" text DEFAULT 'local_business' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"html_snapshot" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jb_agent_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jb_agent_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jb_agent_brand_profiles" ADD CONSTRAINT "jb_agent_brand_profiles_created_by_jb_agent_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."jb_agent_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jb_agent_campaign_leads" ADD CONSTRAINT "jb_agent_campaign_leads_campaign_id_jb_agent_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."jb_agent_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jb_agent_campaigns" ADD CONSTRAINT "jb_agent_campaigns_created_by_jb_agent_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."jb_agent_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jb_agent_contact_events" ADD CONSTRAINT "jb_agent_contact_events_contact_id_jb_agent_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."jb_agent_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jb_agent_contact_events" ADD CONSTRAINT "jb_agent_contact_events_created_by_jb_agent_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."jb_agent_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jb_agent_contacts" ADD CONSTRAINT "jb_agent_contacts_campaign_id_jb_agent_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."jb_agent_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jb_agent_contacts" ADD CONSTRAINT "jb_agent_contacts_owner_id_jb_agent_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."jb_agent_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jb_agent_job_events" ADD CONSTRAINT "jb_agent_job_events_job_id_jb_agent_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jb_agent_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jb_agent_jobs" ADD CONSTRAINT "jb_agent_jobs_campaign_id_jb_agent_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."jb_agent_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jb_agent_jobs" ADD CONSTRAINT "jb_agent_jobs_created_by_jb_agent_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."jb_agent_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jb_agent_lead_meta" ADD CONSTRAINT "jb_agent_lead_meta_approved_by_jb_agent_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."jb_agent_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jb_agent_lp_versions" ADD CONSTRAINT "jb_agent_lp_versions_created_by_jb_agent_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."jb_agent_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jb_agent_settings" ADD CONSTRAINT "jb_agent_settings_updated_by_jb_agent_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."jb_agent_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jb_agent_activity_logs_created_idx" ON "jb_agent_activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "jb_agent_activity_logs_entity_idx" ON "jb_agent_activity_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "jb_agent_brand_profiles_lead_uq" ON "jb_agent_brand_profiles" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "jb_agent_brand_profiles_status_idx" ON "jb_agent_brand_profiles" USING btree ("identity_status");--> statement-breakpoint
CREATE UNIQUE INDEX "jb_agent_campaign_leads_uq" ON "jb_agent_campaign_leads" USING btree ("campaign_id","lead_id");--> statement-breakpoint
CREATE INDEX "jb_agent_campaign_leads_lead_idx" ON "jb_agent_campaign_leads" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "jb_agent_campaign_leads_campaign_idx" ON "jb_agent_campaign_leads" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "jb_agent_campaigns_status_idx" ON "jb_agent_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jb_agent_campaigns_created_idx" ON "jb_agent_campaigns" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "jb_agent_contact_events_contact_idx" ON "jb_agent_contact_events" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "jb_agent_contact_events_created_idx" ON "jb_agent_contact_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "jb_agent_contacts_lead_idx" ON "jb_agent_contacts" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "jb_agent_contacts_campaign_idx" ON "jb_agent_contacts" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "jb_agent_contacts_stage_idx" ON "jb_agent_contacts" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "jb_agent_contacts_owner_idx" ON "jb_agent_contacts" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "jb_agent_job_events_job_idx" ON "jb_agent_job_events" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "jb_agent_job_events_created_idx" ON "jb_agent_job_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jb_agent_jobs_idempotency_uq" ON "jb_agent_jobs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "jb_agent_jobs_claim_idx" ON "jb_agent_jobs" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "jb_agent_jobs_campaign_idx" ON "jb_agent_jobs" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "jb_agent_jobs_lead_idx" ON "jb_agent_jobs" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "jb_agent_jobs_agent_idx" ON "jb_agent_jobs" USING btree ("agent_slug");--> statement-breakpoint
CREATE INDEX "jb_agent_jobs_created_idx" ON "jb_agent_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "jb_agent_lead_meta_priority_idx" ON "jb_agent_lead_meta" USING btree ("priority_override");--> statement-breakpoint
CREATE INDEX "jb_agent_lead_meta_discarded_idx" ON "jb_agent_lead_meta" USING btree ("discarded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jb_agent_lp_versions_lp_version_uq" ON "jb_agent_lp_versions" USING btree ("lp_id","version");--> statement-breakpoint
CREATE INDEX "jb_agent_lp_versions_lead_idx" ON "jb_agent_lp_versions" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "jb_agent_lp_versions_status_idx" ON "jb_agent_lp_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jb_agent_lp_versions_created_idx" ON "jb_agent_lp_versions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jb_agent_users_email_uq" ON "jb_agent_users" USING btree ("email");