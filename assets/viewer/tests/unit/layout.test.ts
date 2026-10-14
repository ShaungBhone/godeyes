import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { layoutFlow, CARD_WIDTH, CARD_HEIGHT } from "../../lib/layout";
import type { Report } from "../../lib/report";
const flow = (JSON.parse(readFileSync(process.env.REPO_FLOW_REPORT ?? "tests/demo-report.json", "utf8")) as Report).flows[0];
describe("vertical graph layout", () => {
  it("handles branches, merges, cycles, disconnected roots, and long text without overlaps", () => {
    const extended = structuredClone(flow);
    extended.edges.push({ ...extended.edges[0], id: "cycle", source: "dashboard", target: "validate" });
    extended.nodes.push({ ...extended.nodes[0], id: "isolated", description: "Long description ".repeat(200) });
    const before = JSON.stringify(extended); const points = layoutFlow(extended);
    expect(Object.keys(points)).toHaveLength(extended.nodes.length);
    for (const point of Object.values(points)) { expect(Number.isFinite(point.x)).toBe(true); expect(Number.isFinite(point.y)).toBe(true); }
    const entries = Object.values(points);
    for (let i=0;i<entries.length;i++) for(let j=i+1;j<entries.length;j++) {
      expect(Math.abs(entries[i].x-entries[j].x) >= CARD_WIDTH || Math.abs(entries[i].y-entries[j].y) >= CARD_HEIGHT).toBe(true);
    }
    expect(JSON.stringify(extended)).toBe(before);
    expect(layoutFlow(extended)).toEqual(points);
  });
  it("keeps normal transitions downward", () => {
    const points = layoutFlow(flow);
    for (const edge of flow.edges) expect(points[edge.target].y).toBeGreaterThan(points[edge.source].y);
  });
});
