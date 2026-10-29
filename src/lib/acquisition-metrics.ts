import { getPool } from "@/db/client";
import { acquisitionSourceLabel } from "@/lib/acquisition";

export type AcquisitionMetricsRow = {
  source: string; label: string; leads: number; conversations: number;
  proposals: number; sales: number; revenue: number; spend: number;
  costPerConversation: number | null; cac: number | null; conversionRate: number;
  spendReported: boolean;
};
export type AcquisitionSnapshot = {
  from: string; to: string;
  rows: AcquisitionMetricsRow[];
  totals: Omit<AcquisitionMetricsRow,"source"|"label">;
};

export async function getAcquisitionSnapshot(days = 30): Promise<AcquisitionSnapshot> {
  const safeDays = Math.max(7,Math.min(90,Math.trunc(days)));
  const from = new Date(Date.now() - safeDays * 86400000).toISOString().slice(0,10);
  const to = new Date().toISOString().slice(0,10);
  const p = getPool();
  const [contactRows,spendRows] = await Promise.all([
    p.query<{source:string;leads:number;conversations:number;proposals:number;sales:number;revenue:string}>(`
      SELECT a.source,
        count(*)::integer AS leads,
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM jb_agent_sales_messages m
          WHERE m.contact_id=a.contact_id AND m.direction='inbound'
        ))::integer AS conversations,
        count(*) FILTER (WHERE c.stage IN ('proposta_enviada','fechado'))::integer AS proposals,
        count(*) FILTER (WHERE c.stage='fechado')::integer AS sales,
        coalesce(sum(CASE WHEN c.stage='fechado' THEN c.closed_value ELSE 0 END),0)::text AS revenue
      FROM jb_agent_acquisition_contacts a JOIN jb_agent_contacts c ON c.id=a.contact_id
      WHERE a.created_at >= $1::date AND a.created_at < ($2::date+interval '1 day')
      GROUP BY a.source ORDER BY a.source`,[from,to]),
    p.query<{source:string;spend:string}>(`
      SELECT source, coalesce(sum(amount_brl),0)::text AS spend
      FROM jb_agent_acquisition_spend
      WHERE spend_date BETWEEN $1::date AND $2::date GROUP BY source`,[from,to]),
  ]);
  const sources = new Set([...contactRows.rows.map(x=>x.source),...spendRows.rows.map(x=>x.source)]);
  const spendMap = new Map(spendRows.rows.map(x=>[x.source,Number(x.spend)]));
  const leadMap = new Map(contactRows.rows.map(x=>[x.source,x]));
  const rows:AcquisitionMetricsRow[] = [...sources].sort().map(source=>{
    const v=leadMap.get(source);
    const leads=Number(v?.leads ?? 0);
    const conversations=Number(v?.conversations ?? 0);
    const proposals=Number(v?.proposals ?? 0);
    const sales=Number(v?.sales ?? 0);
    const revenue=Number(v?.revenue ?? 0);
    const spend=spendMap.get(source) ?? 0;
    const spendReported=spendMap.has(source);
    return {source,label:acquisitionSourceLabel(source),leads,conversations,proposals,sales,
      revenue,spend,spendReported,costPerConversation:spendReported&&conversations?spend/conversations:null,
      cac:spendReported&&sales?spend/sales:null,conversionRate:conversations?sales/conversations*100:0};
  });
  const sum=(key:"leads"|"conversations"|"proposals"|"sales"|"revenue"|"spend")=>
    rows.reduce((v,row)=>v+row[key],0);
  const leads=sum("leads"),conversations=sum("conversations"),proposals=sum("proposals");
  const sales=sum("sales"),revenue=sum("revenue"),spend=sum("spend");
  const spendReported=rows.length>0 && rows.filter(row=>row.leads>0).every(row=>row.spendReported);
  return {from,to,rows,totals:{leads,conversations,proposals,sales,revenue,spend,spendReported,
    costPerConversation:spendReported&&conversations?spend/conversations:null,
    cac:spendReported&&sales?spend/sales:null,conversionRate:conversations?sales/conversations*100:0}};
}

export async function saveAcquisitionSpend(input: {
  source: string; campaignKey: string; spendDate: string; amountBrl: string; userId: string;
}): Promise<void> {
  await getPool().query(`
    INSERT INTO jb_agent_acquisition_spend(source,campaign_key,spend_date,amount_brl,updated_by)
    VALUES($1,$2,$3::date,$4::numeric,$5::uuid)
    ON CONFLICT(source,campaign_key,spend_date)
      DO UPDATE SET amount_brl=EXCLUDED.amount_brl,updated_by=EXCLUDED.updated_by,updated_at=now()`,
    [input.source,input.campaignKey,input.spendDate,input.amountBrl,input.userId]);
}
