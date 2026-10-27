import { getPool } from "@/db/client";
import { formatDateTime, toPrettyJson } from "@/lib/utils";

type Comparison = {
 id: string; baseline_version: number; candidate_version: number;
 visual_winner: string; visual_pass: boolean; decision: string;
 score_a: string; score_b: string; gain: string; review: { summary?: string };
 model: string; created_at: Date;
};
type Visual = { version: number; overall_score: string; desktop_score: string; mobile_score: string; total_problems: number; blockers_count: number; verdict: string; visual_review: unknown };
async function optionalQuery<T extends Record<string, unknown>>(sql: string, id: string): Promise<T[]> {
 try { return (await getPool().query<T>(sql, [id])).rows; }
 catch (error) {
  if (error && typeof error === "object" && "code" in error && error.code === "42P01") return [];
  throw error;
 }
}
export async function LpQualityPanel({ lpId }: { lpId: string }) {
 let comparisons: Comparison[]; let visual: Visual[];
 try {
  [comparisons, visual] = await Promise.all([
   optionalQuery<Comparison>(`SELECT id::text,baseline_version,candidate_version,visual_winner,visual_pass,decision,score_a::text,score_b::text,gain::text,review,model,created_at FROM jb_agent_lp_ab_comparisons WHERE lp_id=$1 ORDER BY id DESC LIMIT 20`, lpId),
   optionalQuery<Visual>(`SELECT DISTINCT ON(version) version,overall_score::text,desktop_score::text,mobile_score::text,total_problems,blockers_count,verdict,visual_review FROM jb_agent_lp_visual_reviews WHERE lp_id::text=$1 ORDER BY version DESC,created_at DESC LIMIT 20`, lpId),
  ]);
 } catch {
  return <section className="rounded-xl border border-[var(--line)] p-5"><h2 className="text-sm font-semibold">Qualidade e refinamento</h2><p role="status" className="mt-2 text-xs">Não foi possível carregar as avaliações. Atualize a página para tentar novamente.</p></section>;
 }
 return <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
  <h2 className="text-sm font-semibold">Qualidade e refinamento</h2>
  <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">Comparação visual não autoriza publicação. Versões novas permanecem em rascunho até revisão técnica e validação comercial.</p>
  {visual.length ? <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-xs"><caption className="mb-2 text-left font-medium">Avaliação individual</caption><thead><tr><th className="p-1">Versão</th><th className="p-1">Nota</th><th className="p-1">Problemas</th><th className="p-1">Bloqueios</th></tr></thead><tbody>{visual.map(v=><tr key={v.version} className="border-t border-[var(--line)]"><th className="p-1">v{v.version}</th><td className="p-1">{v.overall_score}</td><td className="p-1">{v.total_problems}</td><td className="p-1">{v.blockers_count}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-xs">Avaliações individuais ainda não registradas.</p>}
  <h3 className="mt-5 text-xs font-semibold">Comparações A/B</h3>
  {comparisons.length ? comparisons.map(c=><article key={c.id} className="mt-3 rounded-lg border border-[var(--line)] p-3">
   <p className="text-xs font-medium">v{c.baseline_version} × v{c.candidate_version} · {c.visual_winner==="tie"?"Empate":`Preferência visual: v${c.visual_winner==="B"?c.candidate_version:c.baseline_version}`}</p>
   <p className="mt-1 text-xs">A: {c.score_a} · B: {c.score_b} · Diferença: {c.gain}</p>
   <p className="mt-2 text-xs font-medium">{c.visual_pass?"Melhora visual; verificações pendentes":"Manter referência; candidata não passou pela política visual"}</p>
   <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{c.review?.summary ?? "Parecer disponível nos detalhes."}</p>
   <p className="mt-2 text-[10px] text-[var(--muted)]">{formatDateTime(c.created_at)} · {c.model}</p>
   <details className="mt-2"><summary className="cursor-pointer text-xs">Evidências, regressões e próximos ajustes</summary><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words text-[10px]">{toPrettyJson(c.review)}</pre></details>
  </article>) : <p className="mt-2 text-xs">Nenhuma comparação A/B registrada.</p>}
  <p className="mt-3 text-[10px] text-[var(--muted)]">Notas A/B usam uma rubrica própria e não substituem a avaliação individual. Atualize a página para acompanhar novas execuções.</p>
 </section>;
}
