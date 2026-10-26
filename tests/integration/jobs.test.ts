import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { claimJobs, completeJob, failJob, cancelJob, retryJob, enqueueJob } from "@/lib/jobs";
import { closeDb, getPool } from "@/db/client";
import { getDashboardData } from "@/lib/dashboard";
import { resolvePeriod } from "@/lib/period";
import { getLpsPage, getLegacyLpById } from "@/lib/legacy";
import { getCrmContactsPage, moveContactStage, registerContactEvent } from "@/lib/contacts";
import { setLpStatus } from "@/lib/lp-status";

const testUrl = process.env.TEST_DATABASE_URL;
const ids: string[] = [];

describe.skipIf(!testUrl)("PostgreSQL worker lifecycle (local disposable database)", () => {
  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || !/_(test|verify)$/.test(url.pathname)) {
      throw new Error("TEST_DATABASE_URL must target a local database ending in _test or _verify");
    }
    process.env.DATABASE_URL = testUrl;
    await getPool().query(`create table if not exists jb_agent_leads (id text primary key);
      create table if not exists jb_agent_lps (id text primary key, lead_id text, html text, status text);
      insert into jb_agent_leads values ('regression-lead') on conflict do nothing;
      insert into jb_agent_lps values ('regression-lp', 'regression-lead', '<h1>Legacy</h1>', 'draft') on conflict do nothing;`);
  });

  afterAll(async () => {
    if (ids.length) await getPool().query("delete from jb_agent_jobs where id = any($1::uuid[])", [ids]);
    await getPool().query(`delete from jb_agent_contacts where lead_id = 'regression-lead';
      delete from jb_agent_lp_versions where lp_id = 'regression-lp';
      delete from jb_agent_lps where id = 'regression-lp';
      delete from jb_agent_leads where id = 'regression-lead';
      delete from jb_agent_agents where slug = 'regression-agent';
      delete from jb_agent_settings where key = 'platform';`);
    await closeDb();
  });

  it("claims disjoint jobs, enforces ownership and preserves terminal states", async () => {
    const pool = getPool();
    const { rows } = await pool.query<{ id: string }>(
      "insert into jb_agent_jobs (type, payload) values ('prepare_outreach', '{\"synthetic\":true}'), ('prepare_outreach', '{\"synthetic\":true}') returning id",
    );
    ids.push(...rows.map(row => row.id));
    await expect(failJob(ids[0], "integration-a", "not claimed", true, "none")).rejects.toMatchObject({ code: "JOB_NOT_PROCESSING" });
    const [[a], [b]] = await Promise.all([
      claimJobs("integration-a", 1, ["prepare_outreach"]),
      claimJobs("integration-b", 1, ["prepare_outreach"]),
    ]);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
    expect(a.id).not.toBe(b.id);
    await expect(completeJob(String(a.id), "integration-b", {}, String(a.lease_token))).rejects.toMatchObject({ code: "JOB_LOCKED" });
    await completeJob(String(a.id), "integration-a", { synthetic: true }, String(a.lease_token));
    await completeJob(String(a.id), "integration-a", { synthetic: true }, String(a.lease_token));
    const events = await pool.query("select count(*)::int as total from jb_agent_job_events where job_id = $1 and event = 'completed'", [a.id]);
    expect(events.rows[0].total).toBe(1);
    expect((await failJob(String(b.id), "integration-b", "synthetic retry", true, String(b.lease_token))).status).toBe("pending");
    await expect(failJob(String(b.id), "integration-b", "duplicate", true, String(b.lease_token))).rejects.toMatchObject({ code: "JOB_NOT_PROCESSING" });
    await pool.query("update jb_agent_jobs set available_at = now(), max_attempts = 2 where id = $1", [b.id]);
    const [reclaimed] = await claimJobs("integration-b", 1, ["prepare_outreach"]);
    expect(reclaimed.id).toBe(b.id);
    await expect(completeJob(String(b.id), "integration-b", {}, String(b.lease_token))).rejects.toMatchObject({ code: "JOB_STALE_LEASE" });
    expect((await failJob(String(b.id), "integration-b", "attempts exhausted", true, String(reclaimed.lease_token))).status).toBe("failed");
    await expect(failJob(String(b.id), "integration-b", "terminal", true, String(reclaimed.lease_token))).rejects.toMatchObject({ code: "JOB_NOT_PROCESSING" });
    await expect(retryJob(String(a.id))).rejects.toMatchObject({ code: "JOB_INVALID_TRANSITION" });
    await expect(cancelJob(String(a.id))).rejects.toMatchObject({ code: "JOB_INVALID_TRANSITION" });
  });

  it("holds paused pending jobs and rejects inactive campaign admission", async () => {
    const pool = getPool();
    await pool.query("insert into jb_agent_agents (slug,name,role,paused) values ('regression-agent','Synthetic','test',true)");
    const { rows: [job] } = await pool.query("insert into jb_agent_jobs (type,agent_slug) values ('research_brand','regression-agent') returning id");
    ids.push(job.id);
    expect(await claimJobs("paused-test", 1, ["research_brand"])).toEqual([]);
    await pool.query("update jb_agent_agents set paused=false where slug='regression-agent'");
    const [claimed] = await claimJobs("paused-test", 1, ["research_brand"]);
    expect(claimed.id).toBe(job.id);
    await cancelJob(job.id);
    const { rows: [campaign] } = await pool.query("insert into jb_agent_campaigns (name,niche,status) values ('Synthetic','Synthetic','paused') returning id");
    try {
      await expect(enqueueJob({ type: "prospect_campaign", campaignId: campaign.id })).rejects.toMatchObject({ code: "CAMPAIGN_INACTIVE" });
      const { rows: [pending] } = await pool.query("insert into jb_agent_jobs (type,campaign_id) values ('prospect_campaign',$1) returning id", [campaign.id]);
      ids.push(pending.id);
      expect(await claimJobs("campaign-test", 1, ["prospect_campaign"])).toEqual([]);
    } finally { await pool.query("delete from jb_agent_campaigns where id=$1", [campaign.id]); }
  });

  it("rejects expired leases before a reclaim and changes identity after timeout recovery", async () => {
    const pool = getPool();
    const { rows: [job] } = await pool.query("insert into jb_agent_jobs (type) values ('regenerate_lp') returning id");
    ids.push(job.id);
    const [old] = await claimJobs("stable-worker", 1, ["regenerate_lp"]);
    await pool.query("update jb_agent_jobs set locked_at=now()-interval '1 day' where id=$1", [job.id]);
    await expect(completeJob(job.id, "stable-worker", {}, String(old.lease_token))).rejects.toMatchObject({ code: "JOB_STALE_LEASE" });
    expect(await claimJobs("stable-worker", 1, ["regenerate_lp"])).toEqual([]);
    await pool.query("update jb_agent_jobs set available_at=now() where id=$1", [job.id]);
    const [current] = await claimJobs("stable-worker", 1, ["regenerate_lp"]);
    expect(current.lease_token).not.toBe(old.lease_token);
    await expect(failJob(job.id, "stable-worker", "late", true, String(old.lease_token))).rejects.toMatchObject({ code: "JOB_STALE_LEASE" });
    await completeJob(job.id, "stable-worker", {}, String(current.lease_token));
  });

  it("admits only one new job when concurrent requests reach daily quota", async () => {
    const pool = getPool();
    const { rows: [count] } = await pool.query("select count(*)::int as total from jb_agent_jobs where created_at >= $1", [resolvePeriod("today").from]);
    await pool.query("insert into jb_agent_settings (key,value) values ('platform',$1::jsonb) on conflict (key) do update set value=excluded.value", [JSON.stringify({ limits: { maxJobsPerDay: count.total + 1 } })]);
    try {
      const results = await Promise.allSettled([enqueueJob({ type: "analyze_lead" }), enqueueJob({ type: "analyze_lead" })]);
      const successes = results.filter(result => result.status === "fulfilled");
      for (const result of successes) if (result.status === "fulfilled") ids.push(result.value.id);
      expect(successes).toHaveLength(1);
      expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    } finally { await pool.query("delete from jb_agent_settings where key='platform'"); }
  });

  it("supports minimal legacy columns without SQL parameter or column errors", async () => {
    const data = await getDashboardData(resolvePeriod("today"));
    expect(data.warnings).toEqual([]);
    expect((await getLpsPage({})).rows.some(row => row.id === "regression-lp")).toBe(true);
    expect(await getLegacyLpById("regression-lp")).not.toBeNull();
  });

  it("uses canonical LP status and rolls back if legacy synchronization fails", async () => {
    const pool = getPool();
    await pool.query("insert into jb_agent_lp_versions (lp_id,lead_id,version,status,html_snapshot) values ('regression-lp','regression-lead',1,'approved','<h1>v1</h1>')");
    expect((await getLpsPage({ status: "approved" })).rows.map(row => row.id)).toContain("regression-lp");
    await pool.query("alter table jb_agent_lps add constraint regression_status check (status <> 'archived')");
    try {
      await expect(setLpStatus("regression-lp", "archived")).rejects.toThrow();
      expect((await pool.query("select status from jb_agent_lp_versions where lp_id='regression-lp'")).rows[0].status).toBe("approved");
    } finally { await pool.query("alter table jb_agent_lps drop constraint regression_status"); }
    await setLpStatus("regression-lp", "published");
    expect((await getLpsPage({ status: "published" })).rows.map(row => row.id)).toContain("regression-lp");
  });

  it("searches before pagination, including contacts older than the first 400", async () => {
    const pool = getPool();
    await pool.query("insert into jb_agent_contacts (lead_id,next_action,updated_at) select 'regression-lead', 'item-' || n, now() - n * interval '1 minute' from generate_series(1,405) n");
    const found = await getCrmContactsPage({ search: "item-405" }, 1, 25);
    expect(found.total).toBe(1);
    expect(found.rows[0].nextAction).toBe("item-405");
    const page = await getCrmContactsPage({}, 2, 25);
    expect(page.rows).toHaveLength(25);
    expect(page.total).toBeGreaterThanOrEqual(405);
  });

  it("keeps contact stages and events atomic on database failure", async () => {
    const pool = getPool();
    const { rows: [contact] } = await pool.query("insert into jb_agent_contacts (lead_id) values ('regression-lead') returning id");
    await pool.query("alter table jb_agent_contact_events add constraint regression_event check (notes is distinct from 'reject-event')");
    try {
      await expect(moveContactStage(contact.id, "qualificado", "reject-event")).rejects.toThrow();
      expect((await pool.query("select stage from jb_agent_contacts where id=$1", [contact.id])).rows[0].stage).toBe("identificado");
      await expect(registerContactEvent(contact.id, "nota", "reject-event")).rejects.toThrow();
    } finally { await pool.query("alter table jb_agent_contact_events drop constraint regression_event"); }
    await moveContactStage(contact.id, "qualificado", "valid");
    expect((await pool.query("select from_stage,to_stage from jb_agent_contact_events where contact_id=$1", [contact.id])).rows).toEqual([{ from_stage: "identificado", to_stage: "qualificado" }]);
  });
});
