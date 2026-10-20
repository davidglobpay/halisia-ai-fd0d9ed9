/** Prints reviewable SQL. No article is deleted. Run preview before apply. */
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const source = fs.readFileSync("src/lib/pulse/classify.ts", "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const m = { exports: {} };
vm.runInNewContext(code, {
  exports: m.exports,
  module: m,
  require: () => JSON.parse(fs.readFileSync("src/data/kenya-counties.json", "utf8")),
});
const kw = m.exports.CATEGORY_KEYWORDS;
const core = [
  "land",
  "property",
  "housing",
  "roads",
  "infrastructure",
  "environment",
  "flooding",
  "county-government",
];
const topics = ["transport", "agriculture", "climate", "investment", "energy", "utilities"];
const escape = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const literal = (s) => "'" + s.replaceAll("'", "''") + "'";
const pattern = (keys) =>
  "\\y(" +
  keys
    .flatMap((k) => kw[k])
    .map((w) => escape(w.trim()) + "(s|es)?")
    .join("|") +
  ")\\y";
const places = [...source.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]);
const text =
  "regexp_replace(lower(coalesce(title,'') || ' ' || coalesce(raw_excerpt,'')), '\\yland\\s+rover\\y', 'vehicle', 'g')";
// Mirror classify(): a Kenyan anchor (county/place, Kenya/Kenyan(s), or a
// KENYA_TERMS institution) is required of EVERY article, core or topic.
const termsSrc = source.match(/const KENYA_TERMS =\s*\/\\b\(\?:([^)]+)\)\\b\/i;/);
if (!termsSrc) throw Error("KENYA_TERMS not found in classify.ts");
const anchor =
  "\\y(" +
  [...m.exports.COUNTIES.map((c) => c.name), ...places]
    .map((value) => escape(value.toLowerCase()))
    .concat(["kenyan?s?"], termsSrc[1].split("|"))
    .join("|") +
  ")\\y";
const relevant = `(${text} ~ ${literal(anchor)} AND (${text} ~ ${literal(pattern(core))} OR ${text} ~ ${literal(pattern(topics))}))`;
// Preserve ambiguous topic stories for review when their excerpt omits Kenya.
// New ingestion is stricter; legacy cleanup must not hide plausible local news.
const rejected = `archived=false AND NOT ${relevant} AND NOT (${text} ~ ${literal(pattern(topics))})`;
const eligible = `NOT ${relevant} AND NOT (${text} ~ ${literal(pattern(topics))})`;
const run = "pulse-relevance-20261019-v1";
const mode = process.argv[2] ?? "preview";
if (mode === "preview")
  console.log(
    `SELECT count(*) FILTER (WHERE NOT ${relevant}) AS rejected, count(*) FILTER (WHERE ${relevant}) AS kept, count(*) FILTER (WHERE ${eligible}) AS archive_candidates FROM public.news_articles WHERE archived=false; SELECT id,title FROM public.news_articles WHERE ${rejected} ORDER BY id LIMIT 40;`,
  );
else if (mode === "counts")
  console.log(
    `SELECT count(*) FILTER (WHERE NOT ${relevant}) AS rejected, count(*) FILTER (WHERE ${relevant}) AS kept FROM public.news_articles WHERE archived=false;`,
  );
else if (mode === "apply")
  console.log(
    `BEGIN; WITH candidates AS (SELECT id,md5(coalesce(title,'')||chr(31)||coalesce(raw_excerpt,'')) AS content_hash FROM public.news_articles WHERE ${rejected} ORDER BY id LIMIT 20000 FOR UPDATE), audit AS (INSERT INTO halisia_private.pulse_archive_audit(run_id,article_id,previous_archived,content_hash) SELECT '${run}', id,false,content_hash FROM candidates ON CONFLICT DO NOTHING RETURNING article_id) UPDATE public.news_articles SET archived=true WHERE id IN (SELECT article_id FROM audit) AND archived=false; SELECT count(*) AS archived FROM halisia_private.pulse_archive_audit WHERE run_id='${run}'; COMMIT;`,
  );
else if (mode === "restore")
  console.log(
    `BEGIN; UPDATE public.news_articles a SET archived=b.previous_archived FROM halisia_private.pulse_archive_audit b WHERE b.run_id='${run}' AND a.id=b.article_id AND a.archived=true AND b.restored_at IS NULL AND b.content_hash=md5(coalesce(a.title,'')||chr(31)||coalesce(a.raw_excerpt,'')); UPDATE halisia_private.pulse_archive_audit b SET restored_at=now() FROM public.news_articles a WHERE a.id=b.article_id AND b.run_id='${run}' AND a.archived=b.previous_archived; COMMIT;`,
  );
else throw Error("Use preview, counts, apply or restore");
