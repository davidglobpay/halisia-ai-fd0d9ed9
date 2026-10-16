import { PGlite } from "@electric-sql/pglite";
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const functions = JSON.parse(readFileSync(new URL("./production-functions.json", import.meta.url)));
const catalog = JSON.parse(readFileSync(new URL("./production-catalog.json", import.meta.url)));
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  admin = "33333333-3333-4333-8333-333333333333",
  suspended = "44444444-4444-4444-8444-444444444444",
  row = "55555555-5555-4555-8555-555555555555",
  session = "66666666-6666-4666-8666-666666666666";
const quote = (x) => '"' + x.replaceAll('"', '""') + '"';
const results = [];
async function setup() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE SCHEMA halisia_private;
 CREATE TYPE public.app_role AS ENUM ('administrator'); CREATE TYPE public.financing_status AS ENUM ('draft','submitted','under_review','approved','rejected','funded','withdrawn'); CREATE TYPE public.financing_purpose AS ENUM ('purchase','construction','refinance','bridge','equity_release','other');
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 CREATE TABLE public.admin_account_controls(user_id uuid, suspended boolean);
 CREATE TABLE public.user_roles(user_id uuid,role app_role);
 CREATE TABLE public.admin_allowed_emails(email text,enabled boolean);
 CREATE TABLE auth.users(id uuid,email text,email_confirmed_at timestamptz);
 CREATE TABLE auth.sessions(id uuid,user_id uuid);
 GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
 CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;`);
  for (const f of functions) await db.exec(f.definition);
  const cols = catalog.columns.map(
    (c) =>
      `${quote(c.column_name)} ${c.data_type === "USER-DEFINED" ? c.udt_name : c.data_type}${c.column_default ? " DEFAULT " + c.column_default : ""}${c.is_nullable === "NO" ? " NOT NULL" : ""}`,
  );
  await db.exec(
    `CREATE TABLE public.financing_applications (${cols.join(",")}, PRIMARY KEY(id)); ALTER TABLE public.financing_applications ENABLE ROW LEVEL SECURITY;`,
  );
  for (const p of catalog.policies)
    await db.exec(
      `CREATE POLICY ${quote(p.policyname)} ON public.financing_applications AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.map(quote).join(",")}${p.qual ? " USING (" + p.qual + ")" : ""}${p.with_check ? " WITH CHECK (" + p.with_check + ")" : ""};`,
    );
  for (const g of catalog.grants)
    await db.exec(
      `GRANT ${g.privilege_type} ON public.financing_applications TO ${quote(g.grantee)}`,
    );
  for (const t of catalog.triggers) await db.exec(t.definition);
  await db.exec(
    `INSERT INTO user_roles VALUES ('${admin}','administrator'); INSERT INTO admin_allowed_emails VALUES ('synthetic-admin@example.invalid',true); INSERT INTO auth.users VALUES ('${admin}','synthetic-admin@example.invalid',now()); INSERT INTO auth.sessions VALUES ('${session}','${admin}'); INSERT INTO admin_account_controls VALUES ('${suspended}',true);`,
  );
  return db;
}
async function run(db, phase, label, role, uid, sql, expect) {
  await db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claims','{}',false); DELETE FROM public.financing_applications; INSERT INTO public.financing_applications(id,applicant_id,borrower_name,requested_amount,status) VALUES ('${row}','${owner}','Synthetic isolated test - never production',1,'draft');`,
  );
  await db.query(`SELECT set_config('request.jwt.claims',$1,false)`, [
    JSON.stringify({ ...(uid ? { sub: uid } : {}), role, aal: "aal2", session_id: session }),
  ]);
  await db.exec(`SET ROLE ${quote(role)}`);
  let code = null,
    affected = null;
  try {
    const r = await db.query(sql);
    affected = r.affectedRows ?? 0;
  } catch (e) {
    code = e.code;
  }
  await db.exec("RESET ROLE");
  let observed = code ? `error:${code}` : affected === 0 ? "no rows" : "allowed";
  if (sql.startsWith("TRUNCATE")) {
    const count = (
      await db.query("SELECT count(*)::int AS count FROM public.financing_applications")
    ).rows[0].count;
    assert.equal(
      count,
      phase === "production-catalog-replica" ? 0 : 1,
      label + " preserves/reproduces actual rows",
    );
    observed = code ? `error:${code}; synthetic rows retained` : "allowed; synthetic table emptied";
  }
  if (expect === "42501") assert.equal(code, "42501", label);
  else if (expect === "no rows") assert.equal(affected, 0, label);
  else assert.equal(code, null, label);
  results.push({ phase, label, observed });
}
const proposed = readFileSync(
  new URL(
    "../../../supabase/migrations/20261016201230_guard_financing_decisions_and_privileges.sql",
    import.meta.url,
  ),
  "utf8",
);
for (const phase of ["production-catalog-replica", "proposed-hardening", "initial-guard-install"]) {
  const db = await setup();
  if (phase === "initial-guard-install")
    await db.exec(
      "DROP TRIGGER halisia_guard_financing_status ON public.financing_applications; DROP FUNCTION halisia_private.guard_financing_status();",
    );
  if (phase !== "production-catalog-replica") await db.exec(proposed);
  const up = (s) => `UPDATE public.financing_applications SET status='${s}' WHERE id='${row}'`;
  await run(db, phase, "anonymous update denied", "anon", null, up("approved"), "no rows");
  await run(db, phase, "owner submit allowed", "authenticated", owner, up("submitted"), "allowed");
  await run(
    db,
    phase,
    "owner withdraw allowed",
    "authenticated",
    owner,
    up("withdrawn"),
    "allowed",
  );
  for (const s of ["under_review", "approved", "funded", "rejected"])
    await run(
      db,
      phase,
      "owner decision transition denied: " + s,
      "authenticated",
      owner,
      up(s),
      "42501",
    );
  await run(
    db,
    phase,
    "another user cannot update owner row",
    "authenticated",
    other,
    up("submitted"),
    "no rows",
  );
  await run(
    db,
    phase,
    "suspended caller cannot update",
    "authenticated",
    suspended,
    up("submitted"),
    "no rows",
  );
  await run(
    db,
    phase,
    "administrator still lacks cross-user UPDATE policy",
    "authenticated",
    admin,
    up("approved"),
    "no rows",
  );
  await run(
    db,
    phase,
    "service role decision allowed",
    "service_role",
    null,
    up("approved"),
    "allowed",
  );
  for (const s of ["under_review", "approved", "funded", "rejected"])
    await run(
      db,
      phase,
      "owner inserts decision status: " + s,
      "authenticated",
      owner,
      `INSERT INTO public.financing_applications(applicant_id,borrower_name,requested_amount,status) VALUES ('${owner}','Synthetic isolated insertion',1,'${s}')`,
      phase === "production-catalog-replica" ? "allowed" : "42501",
    );
  for (const s of ["draft", "submitted", "withdrawn"])
    await run(
      db,
      phase,
      "owner inserts applicant status: " + s,
      "authenticated",
      owner,
      `INSERT INTO public.financing_applications(applicant_id,borrower_name,requested_amount,status) VALUES ('${owner}','Synthetic isolated insertion',1,'${s}')`,
      "allowed",
    );
  for (const r of ["anon", "authenticated"])
    await run(
      db,
      phase,
      r + " TRUNCATE without row policy",
      "" + r,
      r === "anon" ? null : owner,
      "TRUNCATE public.financing_applications",
      phase === "production-catalog-replica" ? "allowed" : "42501",
    );
  // A suspended INSERT must exercise the actual rejection trigger, not merely hide existing rows.
  await run(
    db,
    phase,
    "suspended insertion rejected",
    "authenticated",
    suspended,
    `INSERT INTO public.financing_applications(applicant_id,borrower_name,requested_amount,status) VALUES ('${suspended}','Synthetic suspended insertion',1,'draft')`,
    "42501",
  );
  if (phase === "proposed-hardening") {
    await db.exec(readFileSync(new URL("./rollback.sql", import.meta.url), "utf8"));
    await run(
      db,
      "rollback",
      "previous owner update guard retained",
      "authenticated",
      owner,
      up("approved"),
      "42501",
    );
    await run(
      db,
      "rollback",
      "previous INSERT behavior restored only in isolated test",
      "authenticated",
      owner,
      `INSERT INTO public.financing_applications(applicant_id,borrower_name,requested_amount,status) VALUES ('${owner}','Synthetic rollback test',1,'approved')`,
      "allowed",
    );
    await db.exec(proposed);
    await run(
      db,
      "reapplied-hardening",
      "INSERT decision denied after rollback/reapply",
      "authenticated",
      owner,
      `INSERT INTO public.financing_applications(applicant_id,borrower_name,requested_amount,status) VALUES ('${owner}','Synthetic reapply test',1,'approved')`,
      "42501",
    );
  }
  await db.close();
}
writeFileSync(
  new URL("./results.json", import.meta.url),
  JSON.stringify(
    {
      scope:
        "Isolated PGlite PostgreSQL, exact retrieved guard/policies/grants with synthetic auth schema and rows; not a production write test.",
      results,
    },
    null,
    2,
  ),
);

console.log(JSON.stringify({ checks: results.length, results }, null, 2));
