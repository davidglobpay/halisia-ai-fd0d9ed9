import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import vm from "node:vm";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url),
  ts = require("../../../node_modules/typescript");
const db = new PGlite();
await db.exec(
  `CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE public.news_articles(id uuid primary key,title text,raw_excerpt text,archived boolean default false,view_count integer default 0); CREATE TABLE public.news_ingestion_logs(id uuid); GRANT SELECT,UPDATE ON public.news_articles TO service_role;`,
);
await db.exec(
  readFileSync("supabase/migrations/20261019120000_pulse_relevance_and_atomic_views.sql", "utf8"),
);
const id = "11111111-1111-4111-8111-111111111111";
await db.query("INSERT INTO public.news_articles(id,title) VALUES($1,$2)", [
  id,
  "Nairobi land title deeds",
]);
await db.exec("SET ROLE service_role");
await Promise.all(
  Array.from({ length: 50 }, () => db.query("select public.increment_article_view($1)", [id])),
);
await db.exec("RESET ROLE");
assert.equal((await db.query("select view_count from news_articles")).rows[0].view_count, 50);
await db.exec("update news_articles set archived=true; SET ROLE service_role");
await db.query("select public.increment_article_view($1)", [id]);
await db.exec("RESET ROLE");
assert.equal((await db.query("select view_count from news_articles")).rows[0].view_count, 50);
await db.exec(
  "update news_articles set archived=false,view_count=2147483647; SET ROLE service_role",
);
await db.query("select public.increment_article_view($1)", [id]);
await db.exec("RESET ROLE");
assert.equal(
  (await db.query("select view_count from news_articles")).rows[0].view_count,
  2147483647,
);
for (const role of ["anon", "authenticated"]) {
  assert.equal(
    (
      await db.query(
        `SELECT has_function_privilege('${role}','public.increment_article_view(uuid)','EXECUTE') AS allowed`,
      )
    ).rows[0].allowed,
    false,
  );
  assert.equal(
    (
      await db.query(
        `SELECT has_table_privilege('${role}','halisia_private.pulse_archive_audit','SELECT') AS allowed`,
      )
    ).rows[0].allowed,
    false,
  );
}
const source = readFileSync("src/lib/pulse/classify.ts", "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const m = { exports: {} };
vm.runInNewContext(code, {
  module: m,
  exports: m.exports,
  require: () => JSON.parse(readFileSync("src/data/kenya-counties.json", "utf8")),
});
const counts = execFileSync("node", ["scripts/pulse-cleanup.cjs", "counts"], { encoding: "utf8" });
const samples = [
  "Thailand trade deal",
  "Poland teachers strike",
  "Adam Smith biography",
  "imports increase",
  "Nairobi football team wins",
  "Nairobi stolen Land Rover",
  "Nairobi land title deeds",
  "Kiambu roads open",
  "Nakuru farmers grow maize",
  "Kenya energy investment",
  "Ruiru water supply",
  "NEMA wetlands",
  "Kenya mineral mining",
  "Aircraft landing in Ireland",
  "Kisumu property rents",
  "County assembly land debate",
  "Mombasa railway opens",
  "Tana River flooding",
  "Tea growers in Kericho",
  "Foreign airport traffic rises",
  "Karen Smith book launch",
  "Kenya housing levy",
  "Bus fleet in Thika",
  "Business grows in Ireland",
  "Forest fires rage across southern California",
  "Bridge collapses in Genoa killing dozens",
  "Tenants in New York rally against rent increases",
  "Thousands displaced by conflict in Sudan",
  "Ardhisasa rollout stalls as Lands ministry clears title deed backlog",
  "Kenyans protest housing levy",
  "Kenya names squad for the World Cup qualifier",
];
for (const title of samples) {
  await db.query("UPDATE public.news_articles SET title=$1,raw_excerpt=null", [title]);
  const actual = (await db.query(counts)).rows[0];
  assert.equal(
    Number(actual.kept),
    m.exports.classify({ title, excerpt: null, categoryHint: null }).relevant ? 1 : 0,
    title,
  );
}
await db.query("UPDATE news_articles SET title=$1", ["Thailand trade deal"]);
await db.exec(execFileSync("node", ["scripts/pulse-cleanup.cjs", "apply"], { encoding: "utf8" }));
assert.equal((await db.query("select archived from news_articles")).rows[0].archived, true);
await db.exec(execFileSync("node", ["scripts/pulse-cleanup.cjs", "restore"], { encoding: "utf8" }));
assert.equal((await db.query("select archived from news_articles")).rows[0].archived, false);
console.log(
  "40 Pulse database assertions passed: atomic increments, bounds, grants, classifier parity, archive/restore. Synthetic isolated PostgreSQL; no production write test.",
);
await db.close();
