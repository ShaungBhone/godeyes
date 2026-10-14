import { z } from "zod";

const text = z.string().trim().min(1);
const confidence = z.enum(["confirmed", "inferred", "unresolved"]);
export const evidenceSchema = z.object({
  file: text.refine((v) => !v.startsWith("/") && !v.includes("\\") && !v.split("/").includes(".."), "Use a repository-relative path"),
  startLine: z.number().int().positive(), endLine: z.number().int().positive(),
  excerpt: z.string().min(1), fileHash: z.string().regex(/^[a-f0-9]{64}$/),
}).refine((v) => v.endLine >= v.startLine, "Invalid source range");
const supportedEvidence = { confidence, evidence: z.array(evidenceSchema) };
const nodeSchema = z.object({
  id: text, title: text, description: text,
  kind: z.enum(["entry", "action", "decision", "external", "outcome"]),
  symbol: text, ...supportedEvidence,
}).refine((v) => v.confidence !== "confirmed" || v.evidence.length > 0, "Confirmed nodes require evidence");
const edgeSchema = z.object({
  id: text, source: text, target: text, label: text,
  branch: z.enum(["normal", "true", "false", "error"]), ...supportedEvidence,
}).refine((v) => v.confidence !== "confirmed" || v.evidence.length > 0, "Confirmed edges require evidence");
const flowSchema = z.object({
  id: text, title: text, description: text,
  nodes: z.array(nodeSchema).min(1), edges: z.array(edgeSchema),
});
export const reportSchema = z.object({
  schemaVersion: z.literal(1),
  repository: z.object({
    name: text, path: text, revision: z.string().nullable(), dirty: z.boolean(),
    snapshotId: text, capturedAt: z.iso.datetime(), fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  overview: z.object({ summary: text, stack: z.array(text), entryPoints: z.array(z.object({ label: text, evidence: z.array(evidenceSchema).min(1) })) }),
  flows: z.array(flowSchema).min(1),
  findings: z.array(z.object({
    id: text, flowId: text, nodeIds: z.array(text).min(1), title: text,
    severity: z.enum(["high", "medium", "low"]),
    trigger: text, impact: text, suggestion: text, evidence: z.array(evidenceSchema).min(1),
  })), limitations: z.array(text),
}).superRefine((report, ctx) => {
  const unique = (ids: string[], path: (string | number)[]) => {
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "Duplicate IDs", path });
  };
  unique(report.flows.map((f) => f.id), ["flows"]);
  unique(report.findings.map((f) => f.id), ["findings"]);
  report.flows.forEach((flow, i) => {
    unique(flow.nodes.map((n) => n.id), ["flows", i, "nodes"]);
    unique(flow.edges.map((e) => e.id), ["flows", i, "edges"]);
    const ids = new Set(flow.nodes.map((n) => n.id));
    flow.edges.forEach((edge, j) => {
      if (!ids.has(edge.source) || !ids.has(edge.target)) ctx.addIssue({ code: "custom", message: "Edge endpoint does not exist", path: ["flows", i, "edges", j] });
    });
  });
  report.findings.forEach((finding, i) => {
    const flow = report.flows.find((f) => f.id === finding.flowId);
    if (!flow || finding.nodeIds.some((id) => !flow.nodes.some((n) => n.id === id))) ctx.addIssue({ code: "custom", message: "Finding references a missing flow or node", path: ["findings", i] });
  });
});
export type Report = z.infer<typeof reportSchema>;
export type Flow = Report["flows"][number];
export type Step = Flow["nodes"][number];
export type Evidence = z.infer<typeof evidenceSchema>;
export type Finding = Report["findings"][number];
