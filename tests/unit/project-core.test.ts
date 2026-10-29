import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  areaKey,
  PROJECT_STAGES,
  stageLabel,
  validCoordinate,
  validProjectName,
} from "@/lib/project-core";

describe("project helpers", () => {
  it("uses the same place key as the evidence writer", () => {
    expect(areaKey(-1.292134, 36.821946)).toBe("geo:-1.2921,36.8219");
    const server = readFileSync("src/lib/intel-snapshot.server.ts", "utf8");
    expect(server).toContain("return `geo:${lat.toFixed(4)},${lng.toFixed(4)}`;");
  });

  it("validates names the same way the database does", () => {
    expect(validProjectName("")).toMatch(/name/);
    expect(validProjectName("   ")).toMatch(/name/);
    expect(validProjectName("x".repeat(161))).toMatch(/160/);
    expect(validProjectName("Kitengela family home")).toBeNull();
  });

  it("accepts only real coordinates", () => {
    expect(validCoordinate(-1.29, 36.82)).toEqual({ lat: -1.29, lng: 36.82 });
    expect(validCoordinate("-1.29", "36.82")).toEqual({ lat: -1.29, lng: 36.82 });
    expect(validCoordinate(95, 36)).toBeNull();
    expect(validCoordinate(NaN, 36)).toBeNull();
    expect(validCoordinate(undefined, undefined)).toBeNull();
  });

  it("offers exactly the stages the database allows", () => {
    const sql = readFileSync(
      "supabase/migrations/20261029190000_project_spine_and_evidence_read.sql",
      "utf8",
    );
    const allowed = sql
      .match(/stage in \(([^)]+)\)/)![1]
      .replace(/'/g, "")
      .split(",");
    expect(PROJECT_STAGES.map((s) => s.value)).toEqual(allowed);
    expect(stageLabel("design")).toBe("Design");
    expect(stageLabel("unknown")).toBe("unknown");
  });
});

describe("the spine migration keeps its promises", () => {
  const sql = readFileSync(
    "supabase/migrations/20261029190000_project_spine_and_evidence_read.sql",
    "utf8",
  );

  it("turns on row-level security for both new tables", () => {
    expect(sql).toContain("alter table public.projects enable row level security;");
    expect(sql).toContain("alter table public.project_members enable row level security;");
  });

  it("adds the restrictive suspended-account gate like every other table", () => {
    expect(sql).toMatch(/policy halisia_active_account on public\.projects as restrictive/);
    expect(sql).toMatch(/policy halisia_active_account on public\.project_members as restrictive/);
  });

  it("only adds nullable links to existing tables", () => {
    for (const t of [
      "parcels",
      "properties",
      "financing_applications",
      "saved_items",
      "bid_requests",
    ])
      expect(sql).toContain(
        `alter table public.${t} add column if not exists project_id uuid references public.projects(id) on delete set null;`,
      );
    expect(sql).not.toMatch(/drop table|drop column|alter column .* set not null/i);
  });

  it("opens only public-place evidence to all signed-in users", () => {
    expect(sql).toContain("for select to authenticated using (subject_type = 'area');");
    expect(sql).not.toMatch(
      /resource_observations[\s\S]{0,80}for (insert|update|delete) to authenticated/,
    );
  });

  it("ships its access test", () => {
    const test = readFileSync("tests/sql/project-access.sql", "utf8");
    expect((test.match(/passes := passes \+ 1/g) ?? []).length).toBeGreaterThanOrEqual(19);
    expect(test).toContain("raise exception 'PROJECT ACCESS TESTS");
  });
});
