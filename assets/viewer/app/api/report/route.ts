import { readFile } from "node:fs/promises";
import { reportSchema } from "@/lib/report";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const path = process.env.REPO_FLOW_REPORT;
  if (!path) return Response.json({ error: "No report loaded. Launch this viewer with the godeyes skill." }, { status: 404 });
  try {
    const report = reportSchema.parse(JSON.parse(await readFile(path, "utf8")));
    return Response.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "The report is missing or invalid. Validate it with scripts/validate_report.py and relaunch." }, { status: 422 });
  }
}
