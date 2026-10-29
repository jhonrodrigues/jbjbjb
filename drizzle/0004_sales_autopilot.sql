-- Motor comercial v1: conversas recebidas e respostas controladas.
-- Sem campanhas de disparo ou contato inicial automatizado.
CREATE TABLE IF NOT EXISTS jb_agent_sales_threads (
  contact_id uuid PRIMARY KEY REFERENCES jb_agent_contacts(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'ai' CHECK (mode IN ('ai','human')),
  opted_out boolean NOT NULL DEFAULT false,
  last_inbound_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jb_agent_sales_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES jb_agent_contacts(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp','instagram','email')),
  provider_message_id text,
  in_reply_to uuid REFERENCES jb_agent_sales_messages(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  content text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','held','draft','sent')),
  attempts integer NOT NULL DEFAULT 0,
  locked_at timestamptz,
  error text,
  provider_reply_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS jb_agent_sales_inbound_idempotency
  ON jb_agent_sales_messages(channel, provider_message_id)
  WHERE direction='inbound' AND provider_message_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS jb_agent_sales_outbound_reply_uq
  ON jb_agent_sales_messages(in_reply_to)
  WHERE direction='outbound' AND in_reply_to IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS jb_agent_sales_claim_idx
  ON jb_agent_sales_messages(status, created_at)
  WHERE direction='inbound';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS jb_agent_sales_conversation_idx
  ON jb_agent_sales_messages(contact_id,created_at DESC);
--> statement-breakpoint
INSERT INTO jb_agent_settings(key,value)
VALUES ('sales_autopilot','{"paused":true}'::jsonb)
ON CONFLICT(key) DO NOTHING;
