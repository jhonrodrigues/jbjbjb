import type { JobType } from "@/db/schema";
import catalog from "./agent-catalog.json";

export type AgentDefinition = {
  slug: string;
  name: string;
  role: string;
  description: string;
};

export const AGENT_CATALOG: AgentDefinition[] = catalog;

export const JOB_AGENT_MAP: Record<JobType, string> = {
  prospect_campaign: "prospector",
  analyze_lead: "analista-ia",
  research_brand: "pesquisador-web",
  generate_lp: "gerador-lp",
  regenerate_lp: "gerador-lp",
  publish_lp: "publicador",
  prepare_outreach: "comercial",
};

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  prospect_campaign: "Prospectar campanha",
  analyze_lead: "Analisar lead",
  research_brand: "Pesquisar marca",
  generate_lp: "Gerar landing page",
  regenerate_lp: "Regenerar landing page",
  publish_lp: "Publicar landing page",
  prepare_outreach: "Preparar abordagem",
};

export function agentForJob(type: JobType): AgentDefinition | undefined {
  const slug = JOB_AGENT_MAP[type];
  return AGENT_CATALOG.find((agent) => agent.slug === slug);
}

export async function ensureAgentsSeeded(): Promise<void> {
  const { getDb, hasDatabaseUrl } = await import("@/db/client");
  if (!hasDatabaseUrl()) return;
  const { agents } = await import("@/db/schema");
  await getDb()
    .insert(agents)
    .values(
      AGENT_CATALOG.map((agent) => ({
        slug: agent.slug,
        name: agent.name,
        role: agent.role,
        description: agent.description,
      })),
    )
    .onConflictDoNothing({ target: agents.slug });
}
