import { readFile } from "node:fs/promises";
import { reportSchema } from "../lib/report";
try {
  reportSchema.parse(JSON.parse(await readFile(process.argv[2], "utf8")));
  console.log("Viewer report schema verified.");
} catch (error) {
  console.error("Invalid viewer report:", error instanceof Error ? error.message : error);
  process.exit(1);
}
