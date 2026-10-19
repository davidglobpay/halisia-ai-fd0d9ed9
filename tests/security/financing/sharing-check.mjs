import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  mine = "33333333-3333-4333-8333-333333333333",
  foreign = "44444444-4444-4444-8444-444444444444";
await db.exec(`CREATE ROLE authenticated;CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT current_setting('request.sub')::uuid $$;
GRANT USAGE ON SCHEMA public,auth TO authenticated;
CREATE TABLE saved_items(id uuid PRIMARY KEY,user_id uuid); INSERT INTO saved_items VALUES('${mine}','${owner}'),('${foreign}','${other}');GRANT SELECT ON saved_items TO authenticated;
CREATE TABLE report_shares(id uuid DEFAULT gen_random_uuid(),owner_id uuid,saved_item_id uuid); CREATE TABLE report_versions(id uuid DEFAULT gen_random_uuid(),owner_id uuid,saved_item_id uuid);
ALTER TABLE report_shares ENABLE ROW LEVEL SECURITY;ALTER TABLE report_versions ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON report_shares,report_versions TO authenticated;
CREATE POLICY "owner manages shares" ON report_shares FOR ALL TO authenticated USING(auth.uid()=owner_id) WITH CHECK(auth.uid()=owner_id);
CREATE POLICY "owner writes versions" ON report_versions FOR INSERT TO authenticated WITH CHECK(auth.uid()=owner_id);`);
await db.exec(
  readFileSync(
    new URL(
      "../../../supabase/migrations/20261019110300_validate_report_parent_ownership.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
await db.query("select set_config('request.sub',$1,false)", [owner]);
await db.exec("SET ROLE authenticated");
let checks = 0;
for (const table of ["report_shares", "report_versions"]) {
  await db.exec(`INSERT INTO ${table}(owner_id,saved_item_id) VALUES('${owner}','${mine}')`);
  checks++;
  let code;
  try {
    await db.exec(`INSERT INTO ${table}(owner_id,saved_item_id) VALUES('${owner}','${foreign}')`);
  } catch (e) {
    code = e.code;
  }
  assert.equal(code, "42501", table + " rejects foreign saved item");
  checks++;
}
let code;
try {
  await db.exec(`UPDATE report_shares SET saved_item_id='${foreign}'`);
} catch (e) {
  code = e.code;
}
assert.equal(code, "42501");
checks++;
console.log(
  JSON.stringify({ checks, scope: "isolated PostgreSQL policy test; no production data" }),
);
await db.close();
