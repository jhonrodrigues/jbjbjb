-- Entrega 6: aquisição híbrida e vínculo de identidades verificado por canal.
-- Sem disparo frio, sem contatar leads capturados automaticamente.
CREATE TABLE IF NOT EXISTS jb_agent_acquisition_contacts (
  contact_id uuid PRIMARY KEY REFERENCES jb_agent_contacts(id) ON DELETE CASCADE,
  source text NOT NULL,
  display_name text,
  email text,
  campaign_key text,
  ad_key text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS jb_agent_acquisition_contacts_source_idx
  ON jb_agent_acquisition_contacts(source,created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jb_agent_acquisition_identities (
  channel text NOT NULL,
  external_user_id text NOT NULL,
  contact_id uuid NOT NULL REFERENCES jb_agent_contacts(id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel,external_user_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS jb_agent_acquisition_identities_contact_idx
  ON jb_agent_acquisition_identities(contact_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jb_agent_acquisition_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES jb_agent_contacts(id) ON DELETE CASCADE,
  event_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  source text NOT NULL,
  campaign_key text,
  ad_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS jb_agent_acquisition_events_source_idx
  ON jb_agent_acquisition_events(source,created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jb_agent_acquisition_spend (
  source text NOT NULL,
  campaign_key text NOT NULL DEFAULT '',
  spend_date date NOT NULL,
  amount_brl numeric(12,2) NOT NULL CHECK (amount_brl >= 0),
  updated_by uuid REFERENCES jb_agent_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(source,campaign_key,spend_date)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jb_agent_whatsapp_delivery_attempts (
  reply_id uuid PRIMARY KEY REFERENCES jb_agent_sales_messages(id) ON DELETE CASCADE,
  status text NOT NULL CHECK(status IN ('sending','sent','uncertain')),
  provider_message_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS jb_agent_whatsapp_delivery_status_idx
  ON jb_agent_whatsapp_delivery_attempts(status,updated_at);
