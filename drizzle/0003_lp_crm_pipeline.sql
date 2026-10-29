-- Integra a geracao de LP por n8n ao CRM sem alterar o workflow de geracao.
-- Toda demonstracao nova fica em revisao humana; nao dispara mensagens nem publica.
CREATE OR REPLACE FUNCTION jb_agent_lp_crm_after_version_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  existing_id uuid;
  existing_stage text;
  next_stage text;
BEGIN
  IF NEW.lead_id IS NULL OR NEW.lp_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Mesmo lock usado na criacao manual de contatos pelo painel.
  PERFORM pg_advisory_xact_lock(hashtext('crm-lead:' || NEW.lead_id));

  SELECT id, stage INTO existing_id, existing_stage
    FROM jb_agent_contacts
   WHERE lead_id = NEW.lead_id
   ORDER BY CASE WHEN stage IN ('fechado','perdido') THEN 1 ELSE 0 END, created_at ASC
   LIMIT 1
     FOR UPDATE;

  next_stage := CASE
    WHEN NEW.status IN ('approved','published') THEN 'pronto_para_contato'
    ELSE 'aguardando_aprovacao'
  END;

  IF existing_id IS NULL THEN
    INSERT INTO jb_agent_contacts (lead_id, lp_id, stage, channel, next_action, updated_at)
    VALUES (
      NEW.lead_id, NEW.lp_id, next_stage, 'manual',
      CASE WHEN next_stage = 'aguardando_aprovacao'
        THEN 'Revisar demonstracao antes do contato'
        ELSE 'Preparar abordagem e revisar o canal comercial'
      END,
      now()
    )
    RETURNING id INTO existing_id;
  ELSE
    -- Nao regride negocios que ja estao em contato, negociacao ou fechados.
    UPDATE jb_agent_contacts c
       SET lp_id = NEW.lp_id,
           stage = next_stage,
           next_action = CASE
             WHEN c.next_action IS NULL
               OR c.next_action IN ('Revisar demonstracao antes do contato','Preparar abordagem e revisar o canal comercial')
             THEN CASE WHEN next_stage = 'aguardando_aprovacao'
               THEN 'Revisar demonstracao antes do contato'
               ELSE 'Preparar abordagem e revisar o canal comercial' END
             ELSE c.next_action
           END,
           updated_at = now()
     WHERE c.id = existing_id
       AND c.stage IN ('identificado','qualificado','demonstracao_preparada','aguardando_aprovacao','pronto_para_contato');

    UPDATE jb_agent_contacts
       SET lp_id = NEW.lp_id, updated_at = now()
     WHERE id = existing_id AND lp_id IS NULL;
  END IF;

  INSERT INTO jb_agent_contact_events (contact_id, type, notes, metadata)
  VALUES (
    existing_id, 'lp_gerada', 'Versao de demonstracao criada para revisao.',
    jsonb_build_object('lp_id', NEW.lp_id, 'version', NEW.version, 'version_id', NEW.id, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS jb_agent_lp_version_crm_insert ON jb_agent_lp_versions;
--> statement-breakpoint
CREATE TRIGGER jb_agent_lp_version_crm_insert
AFTER INSERT ON jb_agent_lp_versions
FOR EACH ROW EXECUTE FUNCTION jb_agent_lp_crm_after_version_insert();
--> statement-breakpoint
-- Vincula os rascunhos criados antes desta migracao, sem duplicar leads do CRM.
WITH ultima AS (
  SELECT DISTINCT ON (lead_id) lead_id, lp_id, status
  FROM jb_agent_lp_versions
  ORDER BY lead_id, created_at DESC, version DESC
)
INSERT INTO jb_agent_contacts (lead_id, lp_id, stage, channel, next_action, updated_at)
SELECT u.lead_id, u.lp_id,
       CASE WHEN u.status IN ('approved','published') THEN 'pronto_para_contato' ELSE 'aguardando_aprovacao' END,
       'manual',
       CASE WHEN u.status IN ('approved','published')
         THEN 'Preparar abordagem e revisar o canal comercial'
         ELSE 'Revisar demonstracao antes do contato' END,
       now()
  FROM ultima u
 WHERE NOT EXISTS (SELECT 1 FROM jb_agent_contacts c WHERE c.lead_id = u.lead_id);
--> statement-breakpoint
-- Contatos preexistentes tambem recebem o vinculo e a etapa, apenas se ainda iniciais.
WITH ultima AS (
  SELECT DISTINCT ON (lead_id) lead_id, lp_id, status
  FROM jb_agent_lp_versions
  ORDER BY lead_id, created_at DESC, version DESC
)
UPDATE jb_agent_contacts c
   SET lp_id = u.lp_id,
       stage = CASE WHEN u.status IN ('approved','published') THEN 'pronto_para_contato' ELSE 'aguardando_aprovacao' END,
       updated_at = now()
  FROM ultima u
 WHERE c.lead_id = u.lead_id
   AND c.stage IN ('identificado','qualificado','demonstracao_preparada','aguardando_aprovacao','pronto_para_contato')
   AND (c.lp_id IS DISTINCT FROM u.lp_id
     OR c.stage IS DISTINCT FROM CASE WHEN u.status IN ('approved','published') THEN 'pronto_para_contato' ELSE 'aguardando_aprovacao' END);
