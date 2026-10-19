import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const catalog = JSON.parse(readFileSync(new URL("./workflow-catalog.json", import.meta.url)));
const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20261019110200_guard_workflow_decisions.sql",
    import.meta.url,
  ),
  "utf8",
);
const ids = Array.from(
  { length: 8 },
  (_, i) =>
    `${i + 1}`.repeat(8) +
    "-" +
    `${i + 1}`.repeat(4) +
    "-4" +
    `${i + 1}`.repeat(3) +
    "-8" +
    `${i + 1}`.repeat(3) +
    "-" +
    `${i + 1}`.repeat(12),
);
const [buyer, seller, provider, other, property, request, profile, row] = ids;
const db = new PGlite();
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth;
CREATE TYPE app_role AS ENUM('administrator'); CREATE TYPE bid_proposal_status AS ENUM('submitted','shortlisted','accepted','rejected','withdrawn'); CREATE TYPE lead_stage AS ENUM('new','contacted','viewing','negotiation','offer','closed','lost');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
CREATE FUNCTION public.halisia_account_active() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
CREATE FUNCTION public.has_role(uuid, app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE TABLE public.properties(id uuid,owner_id uuid); CREATE TABLE public.bid_requests(id uuid,owner_id uuid); CREATE TABLE public.professional_profiles(id uuid,user_id uuid); CREATE TABLE public.viewing_slots(id uuid,property_id uuid,owner_id uuid,start_at timestamptz);
INSERT INTO public.properties VALUES('${property}','${seller}'); INSERT INTO public.bid_requests VALUES('${request}','${seller}'); INSERT INTO public.professional_profiles VALUES('${profile}','${provider}');
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role; GRANT SELECT ON public.properties, public.bid_requests, public.professional_profiles,public.viewing_slots TO authenticated;
`);
for (const table of ["bid_proposals", "leads", "professional_requests", "viewings"]) {
  const columns = catalog.columns
    .filter((c) => c.table_name === table)
    .map(
      (c) =>
        `"${c.column_name}" ${c.data_type === "USER-DEFINED" ? c.udt_name : c.data_type}${c.column_default ? " DEFAULT " + c.column_default : ""}`,
    );
  await db.exec(
    `CREATE TABLE public.${table}(${columns.join(",")},PRIMARY KEY(id)); ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY; GRANT SELECT,INSERT,UPDATE,DELETE ON public.${table} TO authenticated,service_role;`,
  );
  for (const p of catalog.policies.filter((p) => p.tablename === table)) {
    const roles = Array.isArray(p.roles)
      ? p.roles
      : String(p.roles).replace(/[{}]/g, "").split(",");
    await db.exec(
      `CREATE POLICY "${p.policyname}" ON public.${table} AS ${p.permissive} FOR ${p.cmd} TO ${roles.join(",")}${p.qual ? " USING (" + p.qual + ")" : ""}${p.with_check ? " WITH CHECK (" + p.with_check + ")" : ""};`,
    );
  }
}
await db.exec(migration);
let checks = 0;
async function check(label, uid, sql, expected = "ok", role = "authenticated") {
  await db.exec("RESET ROLE");
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify(uid ? { sub: uid, role } : { role }),
  ]);
  await db.exec(`SET ROLE ${role}`);
  let actual = "ok";
  try {
    const r = await db.query(sql);
    if (sql.startsWith("UPDATE") && r.affectedRows === 0) actual = "denied";
  } catch (e) {
    actual = e.code === "42501" ? "denied" : e.code;
  }
  assert.equal(actual, expected, label);
  checks++;
  console.log("PASS", label);
}
const lead = `INSERT INTO leads(id,property_id,buyer_id,seller_id) VALUES('${row}','${property}','${buyer}','${seller}')`;
await check(
  "buyer cannot create closed lead",
  buyer,
  lead.replace("seller_id)", "seller_id,stage)").replace(`'${seller}')`, `'${seller}','closed')`),
  "denied",
);
await check("buyer creates new lead", buyer, lead);
await check("seller updates stage", seller, `UPDATE leads SET stage='contacted' WHERE id='${row}'`);
await check(
  "seller cannot rewrite buyer contact",
  seller,
  `UPDATE leads SET contact_email='changed@example.invalid' WHERE id='${row}'`,
  "denied",
);
await check(
  "seller cannot reassign lead",
  seller,
  `UPDATE leads SET buyer_id='${other}' WHERE id='${row}'`,
  "denied",
);
const proposal = `INSERT INTO bid_proposals(id,bid_request_id,provider_id,company_name,contact_email,amount) VALUES('${row}','${request}','${provider}','Synthetic','qa@example.invalid',1)`;
await check(
  "provider cannot insert accepted proposal",
  provider,
  proposal.replace("amount)", "amount,status)").replace("invalid',1)", "invalid',1,'accepted')"),
  "denied",
);
await check("provider submits proposal", provider, proposal);
await check(
  "provider cannot accept own proposal",
  provider,
  `UPDATE bid_proposals SET status='accepted' WHERE id='${row}'`,
  "denied",
);
await check(
  "provider edits submitted quote",
  provider,
  `UPDATE bid_proposals SET amount=2 WHERE id='${row}'`,
);
await check(
  "request owner cannot rewrite price",
  seller,
  `UPDATE bid_proposals SET amount=3 WHERE id='${row}'`,
  "denied",
);
await check(
  "request owner accepts proposal",
  seller,
  `UPDATE bid_proposals SET status='accepted' WHERE id='${row}'`,
);
await check(
  "provider cannot change accepted price",
  provider,
  `UPDATE bid_proposals SET amount=4 WHERE id='${row}'`,
  "denied",
);
await check(
  "provider cannot delete accepted proposal",
  provider,
  `DELETE FROM bid_proposals WHERE id='${row}'`,
  "denied",
);
const pro = `INSERT INTO professional_requests(id,professional_id,requester_id,project_brief) VALUES('${row}','${profile}','${buyer}','Synthetic')`;
await check(
  "requester cannot preconfirm consultation",
  buyer,
  pro
    .replace("project_brief)", "project_brief,status)")
    .replace("'Synthetic')", "'Synthetic','scheduled')"),
  "denied",
);
await check("requester creates consultation", buyer, pro);
await check(
  "professional confirms consultation",
  provider,
  `UPDATE professional_requests SET status='scheduled',confirmed_start='2026-11-01T10:00Z',confirmed_end='2026-11-01T11:00Z' WHERE id='${row}'`,
);
await check(
  "professional cannot rewrite project brief",
  provider,
  `UPDATE professional_requests SET project_brief='changed' WHERE id='${row}'`,
  "denied",
);
const viewing = `INSERT INTO viewings(id,property_id,buyer_id,seller_id,scheduled_at) VALUES('${row}','${property}','${buyer}','${seller}','2026-11-01T10:00Z')`;
await check(
  "buyer cannot insert confirmed viewing",
  buyer,
  viewing
    .replace("scheduled_at)", "scheduled_at,status)")
    .replace("10:00Z')", "10:00Z','confirmed')"),
  "denied",
);
await check("buyer requests viewing", buyer, viewing);
await check(
  "buyer cannot self confirm",
  buyer,
  `UPDATE viewings SET status='confirmed' WHERE id='${row}'`,
  "denied",
);
await check(
  "seller confirms viewing",
  seller,
  `UPDATE viewings SET status='confirmed' WHERE id='${row}'`,
);
await check(
  "seller cannot reassign viewing buyer",
  seller,
  `UPDATE viewings SET buyer_id='${other}' WHERE id='${row}'`,
  "denied",
);
await check(
  "buyer cancels own viewing",
  buyer,
  `UPDATE viewings SET status='cancelled' WHERE id='${row}'`,
);
await check(
  "other user cannot edit viewing",
  other,
  `UPDATE viewings SET status='confirmed' WHERE id='${row}'`,
  "denied",
);
await check(
  "service role retains decision authority",
  null,
  `UPDATE viewings SET status='confirmed' WHERE id='${row}'`,
  "ok",
  "service_role",
);
console.log(
  JSON.stringify({
    checks,
    scope:
      "isolated PostgreSQL WASM; exact production columns and policies; auth and active-account stubs; no production data",
  }),
);
await db.close();
