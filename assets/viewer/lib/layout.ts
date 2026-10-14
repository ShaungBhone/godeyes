import dagre from "@dagrejs/dagre";
import type { Flow } from "./report";
export const CARD_WIDTH = 300;
export const CARD_HEIGHT = 162;

/** Cycle edges are reversed internally for ranking, preserving original report edges. */
export function layoutFlow(flow: Flow): Record<string, { x: number; y: number }> {
  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setGraph({ rankdir: "TB", nodesep: 100, ranksep: 100, marginx: 40, marginy: 50 });
  graph.setDefaultEdgeLabel(() => ({}));
  flow.nodes.forEach((node) => graph.setNode(node.id, { width: CARD_WIDTH, height: CARD_HEIGHT }));
  flow.edges.forEach((edge) => graph.setEdge(edge.source, edge.target, {}, edge.id));
  dagre.layout(graph);
  return Object.fromEntries(flow.nodes.map((node) => {
    const point = graph.node(node.id);
    return [node.id, { x: point.x - CARD_WIDTH / 2, y: point.y - CARD_HEIGHT / 2 }];
  }));
}
