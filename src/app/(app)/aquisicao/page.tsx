import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CircleDollarSign, MessageCircle, Target, TrendingUp } from "lucide-react";
import { requireUser,isAdmin } from "@/lib/auth-helpers";
import { getAcquisitionSnapshot } from "@/lib/acquisition-metrics";
import { saveAcquisitionSpendAction } from "@/actions/acquisition";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

export const metadata:Metadata={title:"Aquisição híbrida"};
export const dynamic="force-dynamic";
const SOURCES=[
  {value:"meta_ads",label:"Meta Ads"},
  {value:"whatsapp_organic",label:"WhatsApp orgânico"},
  {value:"form",label:"Formulário"},
  {value:"b2b_email",label:"Prospecção por e-mail"},
  {value:"organic",label:"Orgânico"},
  {value:"other",label:"Outros"},
] as const;
type Props={searchParams:Promise<{error?:string;ok?:string;days?:string}>};

export default async function AcquisitionDashboard({searchParams}:Props) {
  const user=await requireUser();
  const params=await searchParams;
  const days=params.days==="7" ? 7 : params.days==="90" ? 90 : 30;
  let data:Awaited<ReturnType<typeof getAcquisitionSnapshot>>|null=null;
  let error:string|null=null;
  try { data=await getAcquisitionSnapshot(days); }
  catch { error="Não foi possível consultar aquisição. Confirme a migração 0005."; }
  const totals=data?.totals;
  const metaInboundConfigured=Boolean(process.env.META_WHATSAPP_APP_SECRET&&
    process.env.META_WHATSAPP_VERIFY_TOKEN&&process.env.META_WHATSAPP_PHONE_NUMBER_ID);
  const metaOutboundConfigured=Boolean(process.env.META_WHATSAPP_ACCESS_TOKEN&&
    process.env.META_GRAPH_API_VERSION&&process.env.JB_SALES_OUTBOUND_SECRET);
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Crescimento" title="Aquisição e conversão"
        description="Leads por origem, conversas, propostas, clientes e custo de aquisição. Valores de mídia registrados manualmente."
        actions={<Button asChild size="sm" variant="outline"><Link href="/autopilot"><MessageCircle/> Conversas</Link></Button>}/>
      {error||params.error?<p className="rounded-lg border border-[var(--danger)]/25 p-3 text-xs text-[var(--danger)]">{error||params.error}</p>:null}
      {params.ok?<p className="rounded-lg border border-[var(--success)]/25 p-3 text-xs text-[var(--success)]">{params.ok}</p>:null}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-xs">
        <p className="font-semibold">WhatsApp Business Cloud API</p>
        <p className="mt-1 text-[var(--muted)]">
          Entrada oficial: {metaInboundConfigured?"credenciais presentes":"pendente"} ·
          Saída oficial: {metaOutboundConfigured?"credenciais presentes":"pendente"} ·
          Envio automático: {process.env.JB_SALES_AUTOSEND_ENABLED==="true"?"flag habilitada":"desligado"}.
          Credenciais presentes não garantem webhook registrado ou canal aprovado.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[var(--muted)]">Coorte de leads criados:</span>
        {([7,30,90] as const).map(n=>(
          <Link key={n} href={`/aquisicao?days=${n}`}
            className={`rounded-md border border-[var(--line)] px-3 py-1.5 text-xs ${days===n ? "bg-[var(--surface-muted)] font-semibold" : ""}`}>
            {n} dias
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric icon={Target} title="Novos leads" value={String(totals?.leads??0)} />
        <Metric icon={MessageCircle} title="Conversas" value={String(totals?.conversations??0)} />
        <Metric icon={TrendingUp} title="Vendas fechadas" value={String(totals?.sales??0)} />
        <Metric icon={CircleDollarSign} title="Receita registrada" value={formatCurrency(totals?.revenue??0)} />
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric title="Investimento informado" value={formatCurrency(totals?.spend??0)}/>
        <Metric title="Custo por conversa" value={totals?.costPerConversation===null||!totals ? "Sem dados":formatCurrency(totals.costPerConversation)}/>
        <Metric title="CAC de mídia" value={totals?.cac===null||!totals?"Sem vendas":formatCurrency(totals.cac)}/>
        <Metric title="Conversas → vendas" value={totals?.conversations ? (totals.conversionRate.toFixed(1)+"%") : "Sem dados"}/>
      </div>
      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
        <div className="border-b border-[var(--line)] p-4">
          <h2 className="text-sm font-semibold">Resultado por origem</h2>
          <p className="mt-1 text-[10px] text-[var(--muted)]">
            Receita e vendas associadas à origem de primeiro contato, considerando somente leads criados no período.
            Investimento é informado manualmente, não sincronizado com Meta Ads.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-left text-xs">
            <thead className="bg-[var(--surface-muted)] text-[var(--muted)]">
              <tr>{["Canal","Leads","Conversas","Propostas","Vendas","Investimento","Receita","CAC"].map(h=>
                <th key={h} className="px-3 py-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {data?.rows.length ? data.rows.map(row=>(
                <tr key={row.source}>
                  <td className="px-3 py-3 font-semibold">{row.label}</td>
                  <td className="px-3 py-3">{row.leads}</td>
                  <td className="px-3 py-3">{row.conversations}</td>
                  <td className="px-3 py-3">{row.proposals}</td>
                  <td className="px-3 py-3">{row.sales}</td>
                  <td className="px-3 py-3">{formatCurrency(row.spend)}</td>
                  <td className="px-3 py-3">{formatCurrency(row.revenue)}</td>
                  <td className="px-3 py-3">{row.cac===null?"—":formatCurrency(row.cac)}</td>
                </tr>
              )):<tr><td colSpan={8} className="p-5 text-center text-[var(--muted)]">
                Nenhum lead ou custo registrado neste período.
              </td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {isAdmin(user)?(
        <section className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-sm font-semibold">Registrar investimento em mídia</h2>
          <p className="text-[11px] text-[var(--muted)]">Lançamento manual por canal/campanha e data. Uma mesma chave/data é atualizada, não duplicada.</p>
          <form action={saveAcquisitionSpendAction} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-1 text-[10px]">Canal
              <select name="source" className="block h-9 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-xs">
                {SOURCES.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-[10px]">Campanha (identificador)
              <input name="campaignKey" maxLength={160} placeholder="Campanha opcional"
                className="block h-9 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-xs"/>
            </label>
            <label className="space-y-1 text-[10px]">Data
              <input name="spendDate" type="date" required defaultValue={new Date().toISOString().slice(0,10)}
                className="block h-9 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-xs"/>
            </label>
            <label className="space-y-1 text-[10px]">Valor em BRL
              <input name="amountBrl" required placeholder="30.00" inputMode="decimal"
                className="block h-9 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-xs"/>
            </label>
            <Button type="submit" variant="accent" size="sm" className="self-end"><ArrowUpRight/> Registrar gasto</Button>
          </form>
        </section>
      ):null}
      <p className="text-[10px] text-[var(--muted)]">
        Indicadores utilizam apenas dados persistidos. A receita é associada ao fechamento registrado no CRM e não significa conciliação financeira independente.
      </p>
    </div>
  );
}
function Metric({title,value,icon:Icon}:{title:string;value:string;icon?:typeof Target}) {
  return <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
    <div className="flex items-center gap-2 text-[10px] text-[var(--muted)]">{Icon?<Icon className="size-3.5"/>:null}{title}</div>
    <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
  </div>;
}
