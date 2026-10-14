import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { reportSchema, type Report } from "../../lib/report";
import { annotationsSchema, annotationKey } from "../../lib/annotations";
const fixture = JSON.parse(readFileSync(process.env.REPO_FLOW_REPORT ?? "tests/demo-report.json", "utf8")) as Report;
describe("source-backed report contract", () => {
  it("accepts the reviewed fixture with failures and an unresolved provider", () => {
    expect(reportSchema.parse(fixture).flows[0].nodes.some((n) => n.kind === "external" && n.confidence === "unresolved")).toBe(true);
    expect(fixture.flows[0].edges.some((e) => e.branch === "error")).toBe(true);
  });
  it("rejects dangling edges, duplicate nodes, missing evidence, and orphaned findings", () => {
    for (const mutate of [
      (r: Report) => { r.flows[0].edges[0].target = "absent"; },
      (r: Report) => { r.flows[0].nodes.push(r.flows[0].nodes[0]); },
      (r: Report) => { r.flows[0].nodes[0].evidence = []; },
      (r: Report) => { r.findings[0].flowId = "absent"; },
    ]) { const report = structuredClone(fixture); mutate(report); expect(reportSchema.safeParse(report).success).toBe(false); }
  });
  it("rejects invalid paths and ranges", () => {
    const report = structuredClone(fixture); report.flows[0].nodes[0].evidence[0].file = "../private";
    expect(reportSchema.safeParse(report).success).toBe(false);
    report.flows[0].nodes[0].evidence[0].file = "app/login/submit.ts"; report.flows[0].nodes[0].evidence[0].endLine = 0;
    expect(reportSchema.safeParse(report).success).toBe(false);
  });
  it("accepts a clean report without manufacturing findings", () => {
    expect(reportSchema.parse({ ...fixture, findings: [] }).findings).toEqual([]);
  });
  it("isolates notes by snapshot and rejects damaged positions", () => {
    expect(annotationKey("one", "login")).not.toBe(annotationKey("two", "login"));
    expect(annotationsSchema.safeParse({ positions: { x: { x: "broken", y: 2 } }, notes: {} }).success).toBe(false);
  });
});
