import { z } from "zod";
const point = z.object({ x: z.number().finite(), y: z.number().finite() });
export const annotationsSchema = z.object({
  positions: z.record(z.string(), point), notes: z.record(z.string(), z.string().max(20000)),
  viewport: z.object({ x: z.number().finite(), y: z.number().finite(), zoom: z.number().min(0.2).max(1.5) }).optional(),
});
export type Annotations = z.infer<typeof annotationsSchema>;
export function annotationKey(snapshotId: string, flowId: string) { return `repo-flow-canvas:v1:${snapshotId}:${flowId}`; }
export const emptyAnnotations: Annotations = { positions: {}, notes: {} };
