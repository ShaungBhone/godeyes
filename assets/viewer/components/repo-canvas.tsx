"use client";

import { useEffect, useMemo, useRef, useState, useCallback, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Handle, Position,
  MiniMap, useReactFlow, applyNodeChanges, MarkerType,
  type Node, type NodeProps, type NodeChange, type Edge, type Viewport,
} from "@xyflow/react";
import {
  Workflow, ArrowUpRight, GitBranch, Zap, Globe, CircleCheck, Code2, StickyNote,
  Plus, Minus, Maximize, RotateCcw, Lock, Unlock, Sun, Moon, Download,
  ChevronRight, X, ShieldCheck, AlertTriangle, FileCode2, Layers, Copy, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { reportSchema, type Report, type Step, type Evidence, type Finding, type Flow } from "@/lib/report";
import { layoutFlow } from "@/lib/layout";
import { annotationsSchema, annotationKey, emptyAnnotations, type Annotations } from "@/lib/annotations";
import "@xyflow/react/dist/style.css";

const kindLabels = { entry: "Entry point", action: "Action", decision: "Decision", external: "External service", outcome: "Outcome" };
const kindIcons = { entry: Zap, action: Code2, decision: GitBranch, external: Globe, outcome: CircleCheck };
type CanvasNode = Node<{ step: Step; findingCount: number; hasNote: boolean; inspect: (id: string, note?: boolean) => void }, "step">;

function StepCard({ id, data, selected }: NodeProps<CanvasNode>) {
  const { step, findingCount, hasNote, inspect } = data;
  const Icon = kindIcons[step.kind];
  return <div className={`flow-card-wrap kind-${step.kind}`}>
    <div className="node-type"><Icon size={12} />{kindLabels[step.kind]}</div>
    <div className={`flow-card ${selected ? "is-selected" : ""}`} data-testid={`card-${id}`} role="button" tabIndex={0} aria-label={step.title} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); inspect(id); } }}>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <div className="card-heading"><span>{step.title}</span>{step.confidence !== "confirmed" && <span className="confidence-dot" title={step.confidence} />}</div>
      <div className="card-description">{step.description}</div>
      <div className="card-footer"><span className="source-symbol"><Icon size={12} /><span>{step.symbol}</span></span>
        <span className="card-signals">{hasNote && <StickyNote size={12} />}{findingCount > 0 && <span className="finding-pill"><AlertTriangle size={11} />{findingCount}</span>}</span>
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
    <div className="node-rail nodrag nopan">
      <button onClick={() => inspect(id)} aria-label={`View source for ${step.title}`} title="View source"><Code2 size={13} /></button>
      <button onClick={() => inspect(id, true)} aria-label={`Add note to ${step.title}`} title="Add note"><StickyNote size={13} /></button>
    </div>
  </div>;
}
const nodeTypes = { step: StepCard };

function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState("");
  if (!evidence.length) return <p className="muted small">No direct source evidence. This step is an analysis boundary.</p>;
  return <div className="evidence-list">{evidence.map((item, i) => {
    const ref = `${item.file}:${item.startLine}`;
    return <details className="source-block" key={`${ref}-${i}`} open={i === 0}>
      <summary><FileCode2 size={13} /><span>{item.file}</span><span className="source-lines">L{item.startLine}–{item.endLine}</span></summary>
      <div className="source-actions"><span>Source snapshot</span><button aria-label={`Copy ${ref}`} onClick={async () => {
        try { await navigator.clipboard.writeText(ref); setCopied(ref); setError(""); } catch { setError("Could not copy. Select the source path manually."); }
      }}>{copied === ref ? <Check size={12} /> : <Copy size={12} />}{copied === ref ? "Copied" : "Copy path"}</button></div>
      <pre>{item.excerpt.split("\n").map((line, j) => <span className="code-line" key={j}><span className="line-number">{item.startLine + j}</span><code>{line || " "}</code></span>)}</pre>
    </details>;
  })}{error && <p role="status" className="small">{error}</p>}</div>;
}

function FindingDetails({ finding }: { finding: Finding }) {
  return <article className="finding-detail" id={`finding-${finding.id}`}>
    <span className={`severity severity-${finding.severity}`}>{finding.severity}</span>
    <h3>{finding.title}</h3><p><strong>Trigger</strong>{finding.trigger}</p><p><strong>Impact</strong>{finding.impact}</p><p><strong>Suggested fix</strong>{finding.suggestion}</p>
    <EvidenceList evidence={finding.evidence} />
  </article>;
}

export function RepoCanvas() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/report", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to load report.");
      setReport(reportSchema.parse(value));
    }).catch((error) => { if (error.name !== "AbortError") setError(error.message); });
    return () => controller.abort();
  }, []);
  if (!report) return <main className="loading-screen"><Workflow size={32} /><h1>Repo Flow Canvas</h1><p role={error ? "alert" : "status"}>{error || "Loading the source-backed report…"}</p>{error && <Button variant="outline" onClick={() => location.reload()}>Try again</Button>}</main>;
  return <ReactFlowProvider><Workspace report={report} /></ReactFlowProvider>;
}

function Workspace({ report }: { report: Report }) {
  const [flowId, setFlowId] = useState(report.flows[0].id);
  const [tab, setTab] = useState<"canvas" | "review" | "overview">("canvas");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteFocus, setNoteFocus] = useState(false);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const { resolvedTheme, setTheme } = useTheme();
  const [initialStorage] = useState(() => {
    const loaded: Record<string, Annotations> = {};
    let error = "";
    for (const flow of report.flows) {
      try {
        const raw = localStorage.getItem(annotationKey(report.repository.snapshotId, flow.id));
        if (raw) {
          const parsed = annotationsSchema.safeParse(JSON.parse(raw));
          if (parsed.success) loaded[flow.id] = parsed.data;
          else error = "Some saved annotations are invalid. The report is intact.";
        }
      } catch { error = "Browser storage is unavailable or damaged. Export to keep your notes."; }
    }
    return { loaded, error };
  });
  const [allAnnotations, setAllAnnotations] = useState<Record<string, Annotations>>(initialStorage.loaded);
  const [storageError, setStorageError] = useState(initialStorage.error);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const flow = report.flows.find((f) => f.id === flowId)!;
  const findings = report.findings.filter((f) => f.flowId === flowId);
  const selected = flow.nodes.find((node) => node.id === selectedId);
  const annotations = allAnnotations[flowId] ?? emptyAnnotations;
  useEffect(() => { if (noteFocus && selected && tab === "canvas") textareaRef.current?.focus(); }, [noteFocus, selected, tab]);
  const updateAnnotations = useCallback((id: string, update: Partial<Annotations>) => {
    const next = { ...(allAnnotations[id] ?? emptyAnnotations), ...update };
    try { localStorage.setItem(annotationKey(report.repository.snapshotId, id), JSON.stringify(next)); setStorageError(""); }
    catch { setStorageError("Notes could not be saved in this browser. Export to keep them."); }
    setAllAnnotations((previous) => ({ ...previous, [id]: next }));
  }, [allAnnotations, report.repository.snapshotId]);
  const inspect = useCallback((id: string, note = false) => { setSelectedId(id); setNoteFocus(note); setTab("canvas"); }, []);
  const changeFlow = (id: string) => { setFlowId(id); setSelectedId(null); setTab("canvas"); };
  const exportReport = () => {
    const blob = new Blob([JSON.stringify({ report, annotations: allAnnotations, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `${report.repository.name.replace(/[^a-z0-9_-]/gi, "-")}-flow-review.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <SidebarProvider defaultOpen={false} className="workspace" style={{ "--sidebar-width": "13rem", "--sidebar-width-icon": "3rem" } as React.CSSProperties}>
    <AppSidebar report={report} activeView={tab} activeFlowId={flowId} onChangeView={setTab} onChangeFlow={changeFlow} />
    <SidebarInset className="main-area">
      <header className="workspace-header"><div className="breadcrumb"><SidebarTrigger aria-label="Toggle sidebar" className="-ml-1" /><span className="header-divider" /><Workflow size={15} /><span>Repository</span><ChevronRight size={12} /><strong>{tab === "overview" ? "App overview" : tab === "review" ? "Code review" : flow.title}</strong></div><div className="header-actions"><button className="theme-button" aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{mounted && resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</button><Button variant="outline" size="sm" onClick={exportReport}><Download size={13} />Export report</Button></div></header>
      <div className="tab-strip"><button className={tab === "canvas" ? "active" : ""} onClick={() => setTab("canvas")}><GitBranch size={14} />Flow canvas</button><button className={tab === "review" ? "active" : ""} onClick={() => setTab("review")}><ShieldCheck size={14} />Findings<span>{report.findings.length}</span></button><button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}><Layers size={14} />Overview</button>{tab === "canvas" && <div className="flow-stats">{flow.nodes.length} steps<span>·</span>{flow.edges.length} connections</div>}</div>
      {storageError && <div role="alert" className="storage-alert">{storageError}</div>}
      <div className="body-area">
        {tab === "canvas" && mounted && <CanvasView key={`${report.repository.snapshotId}:${flowId}`} flow={flow} findings={findings} annotations={annotations} update={(value) => updateAnnotations(flowId, value)} selectedId={selectedId} inspect={inspect} dark={resolvedTheme === "dark"} />}
        {tab === "canvas" && selected && <aside className="inspector"><div className="inspector-top"><span>STEP DETAILS</span><button aria-label="Close inspector" onClick={() => setSelectedId(null)}><X size={16} /></button></div><div className="inspector-body"><div className={`detail-type kind-${selected.kind}`}><span className="node-type"><span>{kindLabels[selected.kind]}</span></span></div><h2>{selected.title}</h2><p>{selected.description}</p><span className={`confidence confidence-${selected.confidence}`}>{selected.confidence}</span><h3 className="section-label">Source evidence</h3><EvidenceList evidence={selected.evidence} />
          <h3 className="section-label">Your note</h3><textarea ref={textareaRef} maxLength={20000} aria-label="Step note" placeholder="Add context or a question…" value={annotations.notes[selected.id] ?? ""} onChange={(event) => updateAnnotations(flowId, { notes: { ...annotations.notes, [selected.id]: event.target.value } })} /><p className="note-caption">Notes annotate the snapshot; they do not change code.</p>
          <h3 className="section-label">Review findings</h3>{findings.filter((f) => f.nodeIds.includes(selected.id)).map((finding) => <FindingDetails key={finding.id} finding={finding} />)}{!findings.some((f) => f.nodeIds.includes(selected.id)) && <div className="no-findings"><ShieldCheck size={15} />No reported issues for this step.</div>}
        </div></aside>}
        {tab === "review" && <section className="review-page"><div className="review-summary"><ShieldCheck size={21} /><div><h2>{report.findings.length ? `${report.findings.length} finding${report.findings.length === 1 ? "" : "s"} to review` : "No issues reported"}</h2><p>Review is limited to the traced feature and available source.</p></div></div>{report.findings.map((finding) => <div className="review-card" key={finding.id}><FindingDetails finding={finding} /><Button variant="outline" size="sm" onClick={() => { setFlowId(finding.flowId); inspect(finding.nodeIds[0]); }}>Locate on canvas<ArrowUpRight size={13} /></Button></div>)}</section>}
        {tab === "overview" && <section className="overview-page"><div className="overview-card"><h2>{flow.title}</h2><p>{flow.description}</p><h3>Snapshot details</h3><dl className="snapshot-details"><div><dt>Analysis</dt><dd><span className="snapshot-badge"><span className="local-dot" />Static analysis</span></dd></div><div><dt>Revision</dt><dd>{report.repository.revision?.slice(0, 7) ?? "No Git revision"}{report.repository.dirty ? " · uncommitted" : ""}</dd></div><div><dt>Captured</dt><dd><time dateTime={report.repository.capturedAt}>{mounted ? new Date(report.repository.capturedAt).toLocaleString() : report.repository.capturedAt}</time></dd></div></dl></div><div className="overview-card"><h2>App overview</h2><p>{report.overview.summary}</p><div className="stack-tags">{report.overview.stack.map((tag) => <span key={tag}>{tag}</span>)}</div><h3>Entry points</h3>{report.overview.entryPoints.map((entry) => <div key={entry.label} className="overview-entry"><h4>{entry.label}</h4><EvidenceList evidence={entry.evidence} /></div>)}</div><div className="overview-card"><h2>Analysis boundaries</h2>{report.limitations.length ? <ul>{report.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p>No additional boundaries reported.</p>}<p className="muted">This is a code snapshot. It does not represent live execution.</p></div></section>}
      </div>
    </SidebarInset>
  </SidebarProvider>;
}

function CanvasView({ flow, findings, annotations, update, selectedId, inspect, dark }: {
  flow: Flow; findings: Finding[]; annotations: Annotations; update: (value: Partial<Annotations>) => void;
  selectedId: string | null; inspect: (id: string, note?: boolean) => void; dark: boolean;
}) {
  const automatic = useMemo(() => layoutFlow(flow), [flow]);
  const makeNodes = () => flow.nodes.map((step): CanvasNode => ({
    id: step.id, type: "step", position: annotations.positions[step.id] ?? automatic[step.id],
    selected: selectedId === step.id,
    data: { step, findingCount: findings.filter((f) => f.nodeIds.includes(step.id)).length, hasNote: Boolean(annotations.notes[step.id]), inspect },
  }));
  const [nodes, setNodes] = useState<CanvasNode[]>(makeNodes);
  const [locked, setLocked] = useState(false);
  const [zoom, setZoom] = useState(annotations.viewport?.zoom ?? 1);
  const { zoomIn, zoomOut, fitView, setCenter, getNode } = useReactFlow<CanvasNode>();
  const renderedNodes = useMemo(() => nodes.map((node) => ({ ...node, selected: selectedId === node.id, data: { ...node.data, hasNote: Boolean(annotations.notes[node.id]) } })), [nodes, selectedId, annotations.notes]);
  useEffect(() => {
    if (!selectedId) return;
    const node = getNode(selectedId);
    if (node) void setCenter(node.position.x + 150, node.position.y + 81, { zoom: Math.max(0.6, Math.min(zoom, 1)), duration: 300 });
    // Refocus only on selection changes, not on every pan or zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);
  const edges: Edge[] = useMemo(() => flow.edges.map((edge) => ({
    id: edge.id, source: edge.source, target: edge.target, type: "smoothstep", label: edge.label,
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: edge.branch === "true" ? "#10b981" : edge.branch === "false" || edge.branch === "error" ? "#f43f5e" : "#94a3b8" },
    style: { stroke: edge.branch === "true" ? "#10b981" : edge.branch === "false" || edge.branch === "error" ? "#f43f5e" : "var(--edge)", strokeWidth: 1.5, strokeDasharray: edge.confidence === "confirmed" ? undefined : "5 5" },
    labelStyle: { fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 500 }, labelBgStyle: { fill: "var(--canvas)", fillOpacity: 0.95 }, labelBgPadding: [7, 4], labelBgBorderRadius: 5,
    data: { evidence: edge.evidence, confidence: edge.confidence },
  })), [flow]);
  const [selectedEdge, setSelectedEdge] = useState<Flow["edges"][number] | null>(null);
  const onChanges = (changes: NodeChange<CanvasNode>[]) => setNodes((previous) => applyNodeChanges(changes.filter((change) => change.type !== "remove"), previous));
  const reset = () => { setNodes((previous) => previous.map((node) => ({ ...node, position: automatic[node.id] }))); update({ positions: {}, viewport: undefined }); setTimeout(() => void fitView({ padding: 0.25, maxZoom: 1, duration: 300 }), 50); };
  const saveViewport = (_: unknown, viewport: Viewport) => { setZoom(viewport.zoom); update({ viewport }); };
  return <div className="canvas-area" data-testid="canvas"><ReactFlow<CanvasNode>
    nodes={renderedNodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onChanges}
    onNodeClick={(_, node) => { setSelectedEdge(null); inspect(node.id); }}
    onNodeDragStop={(_, node) => update({ positions: { ...annotations.positions, [node.id]: node.position } })}
    onEdgeClick={(_, edge) => setSelectedEdge(flow.edges.find((e) => e.id === edge.id) ?? null)}
    nodesDraggable={!locked} nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null}
    elementsSelectable panOnDrag selectionOnDrag={false} zoomOnDoubleClick={false}
    minZoom={0.2} maxZoom={1.5} fitView={!annotations.viewport} defaultViewport={annotations.viewport}
    fitViewOptions={{ padding: 0.25, maxZoom: 1 }} onMoveEnd={saveViewport} colorMode={dark ? "dark" : "light"}>
    <Background variant={BackgroundVariant.Dots} gap={16} size={1.2} color="var(--canvas-dot)" bgColor="var(--canvas)" />
    <MiniMap position="bottom-right" pannable zoomable nodeColor={(node) => ({ entry: "#7dd3fc", action: "#6ee7b7", decision: "#c4b5fd", external: "#67e8f9", outcome: "#cbd5e1" })[(node.data as CanvasNode["data"]).step.kind]} />
  </ReactFlow>
    <div className="canvas-caption"><span className="caption-dot" />READING THE CODE<span className="caption-divider" /><span>{locked ? "Layout locked · select a step to inspect" : "Drag to arrange · select a step to inspect"}</span></div>
    <div className="canvas-legend"><span><i className="legend-solid" />Confirmed</span><span><i className="legend-dashed" />Inferred / unresolved</span></div>
    <div className="canvas-controls"><button aria-label="Zoom in" title="Zoom in" onClick={() => void zoomIn()} disabled={zoom >= 1.5}><Plus size={16} /></button><button aria-label="Zoom out" title="Zoom out" onClick={() => void zoomOut()} disabled={zoom <= 0.2}><Minus size={16} /></button><span className="zoom-value">{Math.round(zoom * 100)}%</span><span className="control-divider" /><button aria-label="Fit view" title="Fit view" onClick={() => void fitView({ padding: 0.25, maxZoom: 1, duration: 300 })}><Maximize size={15} /></button><button aria-label="Reset layout" title="Reset layout" onClick={reset}><RotateCcw size={15} /></button><span className="control-divider" /><button aria-label={locked ? "Unlock node movement" : "Lock node movement"} title={locked ? "Unlock node movement" : "Lock node movement"} aria-pressed={locked} onClick={() => setLocked(!locked)}>{locked ? <Lock size={15} /> : <Unlock size={15} />}</button></div>
    {selectedEdge && <div className="edge-inspector"><div><strong>{selectedEdge.label}</strong><button aria-label="Close connection evidence" onClick={() => setSelectedEdge(null)}><X size={14} /></button></div><p className="small muted">{selectedEdge.confidence} connection</p><EvidenceList evidence={selectedEdge.evidence} /></div>}
  </div>;
}
