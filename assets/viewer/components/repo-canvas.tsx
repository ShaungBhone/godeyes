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
  ChevronRight, X, ShieldCheck, AlertTriangle, FileCode2, Layers, Link2, Check, WrapText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CodeBlock, CodeBlockActions, CodeBlockContent, CodeBlockCopyButton, CodeBlockFooter, CodeBlockHeader, CodeBlockTitle } from "@/components/ui/code-block";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { reportSchema, type Report, type Step, type Evidence, type Finding, type Flow } from "@/lib/report";
import { layoutFlow } from "@/lib/layout";
import { annotationsSchema, annotationKey, emptyAnnotations, type Annotations } from "@/lib/annotations";
import { cn } from "@/lib/utils";
import "@xyflow/react/dist/style.css";

const kindLabels = { entry: "Entry point", action: "Action", decision: "Decision", external: "External service", outcome: "Outcome" };
const kindIcons = { entry: Zap, action: Code2, decision: GitBranch, external: Globe, outcome: CircleCheck };
type CanvasNode = Node<{ step: Step; findingCount: number; hasNote: boolean; inspect: (id: string, note?: boolean) => void }, "step">;

function StepCard({ id, data, selected }: NodeProps<CanvasNode>) {
  const { step, findingCount, hasNote, inspect } = data;
  const Icon = kindIcons[step.kind];
  return <div className={cn("flow-card-wrap", `kind-${step.kind}`)}>
    <Badge variant="outline" className="node-type"><Icon data-icon="inline-start" />{kindLabels[step.kind]}</Badge>
    <div className={cn("flow-card", selected && "is-selected")} data-testid={`card-${id}`} role="button" tabIndex={0} aria-label={step.title} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); inspect(id); } }}>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <div className="card-heading"><span>{step.title}</span>{step.confidence !== "confirmed" && <span className="confidence-dot" title={step.confidence} />}</div>
      <div className="card-description">{step.description}</div>
      <div className="card-footer"><span className="source-symbol"><Icon size={12} /><span>{step.symbol}</span></span>
        <span className="card-signals">{hasNote && <StickyNote size={12} />}{findingCount > 0 && <Badge variant="secondary" className="finding-pill"><AlertTriangle data-icon="inline-start" />{findingCount}</Badge>}</span>
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
    <div className="node-rail nodrag nopan" onClick={(event) => event.stopPropagation()}>
      <Button variant="ghost" size="icon-xs" onClick={() => inspect(id)} aria-label={`View source for ${step.title}`} title="View source"><Code2 /></Button>
      <Button variant="ghost" size="icon-xs" onClick={() => inspect(id, true)} aria-label={`Add note to ${step.title}`} title="Add note"><StickyNote /></Button>
    </div>
  </div>;
}
const nodeTypes = { step: StepCard };

const confidenceDescriptions = {
  confirmed: "Supported directly by the captured source code. This is static analysis, not a runtime test.",
  inferred: "Deduced from the available source code, but not directly established. This is static analysis, not a runtime test.",
  unresolved: "There is not enough source code to verify this step or connection. This is static analysis, not a runtime test.",
};

function ConfidenceLabel({ confidence, connection = false }: { confidence: Step["confidence"]; connection?: boolean }) {
  return <Tooltip>
    <TooltipTrigger render={<Badge render={<button type="button" />} variant={confidence === "confirmed" ? "secondary" : "outline"} className="confidence capitalize" />}>
      {confidence}{connection && " connection"}
    </TooltipTrigger>
    <TooltipContent side="bottom" align="end"><p>{confidenceDescriptions[confidence]}</p></TooltipContent>
  </Tooltip>;
}

function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  if (!evidence.length) return <Empty className="p-0"><EmptyHeader><EmptyDescription>No direct source evidence. This step is an analysis boundary.</EmptyDescription></EmptyHeader></Empty>;
  return <div className="evidence-list">{evidence.map((item, i) => <SourceEvidence key={`${item.file}:${item.startLine}:${item.endLine}:${item.fileHash}:${i}`} item={item} defaultOpen={i === 0} />)}</div>;
}

function SourceEvidence({ item, defaultOpen }: { item: Evidence; defaultOpen: boolean }) {
  const [wrap, setWrap] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const ref = `${item.file}:${item.startLine}`;
  return <Collapsible className="source-block" defaultOpen={defaultOpen}>
      <CodeBlock size="sm">
        <CodeBlockHeader>
          <CodeBlockTitle className="flex-1">
            <CollapsibleTrigger className="source-trigger" aria-label={`Source ${ref}`} title={item.file}>
              <FileCode2 /><span className="min-w-0 flex-1 truncate">{item.file}</span><ChevronRight className="source-chevron shrink-0" />
            </CollapsibleTrigger>
          </CodeBlockTitle>
          <CodeBlockActions>
            <Button variant={wrap ? "secondary" : "ghost"} size="icon-xs" aria-label="Wrap lines" aria-pressed={wrap} title={wrap ? "Use horizontal scrolling" : "Wrap lines"} onClick={() => setWrap(!wrap)}><WrapText /></Button>
            <CodeBlockCopyButton value={item.excerpt} aria-label={`Copy code from ${ref}`} title="Copy code" onClick={() => setError("")} onCopyError={() => setError("Could not copy code. Select the snippet manually.")} />
          </CodeBlockActions>
        </CodeBlockHeader>
        <CollapsibleContent>
          <CodeBlockContent wrap={wrap} lineNumbers startLine={item.startLine} className="max-h-64" aria-label={`Source code ${ref}`}>{item.excerpt}</CodeBlockContent>
          <CodeBlockFooter className="justify-between">
            <span className="source-lines">{item.startLine === item.endLine ? `Line ${item.startLine}` : `Lines ${item.startLine}–${item.endLine}`}</span>
            <Button variant="ghost" size="icon-xs" aria-label={`Copy ${ref}`} title="Copy source location" onClick={async () => {
              try { await navigator.clipboard.writeText(ref); setCopied(true); setError(""); } catch { setError("Could not copy. Select the source path manually."); }
            }}>{copied ? <Check /> : <Link2 />}</Button>
          </CodeBlockFooter>
        </CollapsibleContent>
      </CodeBlock>
      {error && <p role="status" className="small">{error}</p>}
    </Collapsible>;
}

function FindingDetails({ finding, children }: { finding: Finding; children?: React.ReactNode }) {
  return <Card size="sm" className="finding-detail" id={`finding-${finding.id}`}>
    <CardHeader>
      <Badge variant={finding.severity === "high" ? "destructive" : finding.severity === "medium" ? "secondary" : "outline"} className="capitalize">{finding.severity}</Badge>
      <CardTitle><h3>{finding.title}</h3></CardTitle>
    </CardHeader>
    <CardContent className="flex flex-col gap-4">
      <dl className="finding-copy">
        <div><dt>Trigger</dt><dd>{finding.trigger}</dd></div>
        <div><dt>Impact</dt><dd>{finding.impact}</dd></div>
        <div><dt>Suggested fix</dt><dd>{finding.suggestion}</dd></div>
      </dl>
      <EvidenceList evidence={finding.evidence} />
    </CardContent>
    {children && <CardFooter>{children}</CardFooter>}
  </Card>;
}

function StepInspector({ step, findings, note, textareaRef, onNoteChange, onClose }: {
  step: Step; findings: Finding[]; note: string; textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onNoteChange: (note: string) => void; onClose: () => void;
}) {
  const Icon = kindIcons[step.kind];
  return <aside className="inspector" aria-label="Step details">
    <div className="inspector-top"><span>STEP DETAILS</span><Button variant="ghost" size="icon-xs" aria-label="Close inspector" title="Close details" onClick={onClose}><X /></Button></div>
    <div className="inspector-body">
      <div className="inspector-summary">
        <div className="inspector-meta"><Badge variant="outline"><Icon data-icon="inline-start" />{kindLabels[step.kind]}</Badge><ConfidenceLabel confidence={step.confidence} /></div>
        <h2>{step.title}</h2><p>{step.description}</p>
      </div>
      <Separator />
      <section className="inspector-section" aria-labelledby="step-evidence-heading">
        <h3 id="step-evidence-heading" className="section-label"><span>Source evidence</span><Badge variant="secondary">{step.evidence.length}</Badge></h3>
        <EvidenceList evidence={step.evidence} />
      </section>
      <Separator />
      <section className="inspector-section" aria-labelledby="step-findings-heading">
        <h3 id="step-findings-heading" className="section-label"><span>Review findings</span>{findings.length > 0 && <Badge variant="secondary">{findings.length}</Badge>}</h3>
        {findings.map((finding) => <FindingDetails key={finding.id} finding={finding} />)}
        {!findings.length && <Empty className="p-0"><EmptyHeader><EmptyDescription>No reported issues for this step.</EmptyDescription></EmptyHeader></Empty>}
      </section>
      <Separator />
      <section className="inspector-section" aria-labelledby="step-note-heading">
        <FieldGroup><Field>
          <FieldLabel id="step-note-heading" htmlFor="step-note">Your note</FieldLabel>
          <Textarea id="step-note" ref={textareaRef} className="min-h-24" maxLength={20000} aria-label="Step note" aria-describedby="step-note-description" placeholder="Add context or a question…" value={note} onChange={(event) => onNoteChange(event.target.value)} />
          <FieldDescription id="step-note-description">Notes annotate the snapshot; they do not change code.</FieldDescription>
        </Field></FieldGroup>
      </section>
    </div>
  </aside>;
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
  if (!report) return <main className="loading-screen"><Workflow size={32} /><h1>Repo Flow Canvas</h1>{error ? <Alert variant="destructive" className="max-w-lg"><AlertTitle>Unable to load report</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : <><Skeleton className="h-3 w-48" /><p role="status">Loading the source-backed report…</p></>}{error && <Button variant="outline" onClick={() => location.reload()}>Try again</Button>}</main>;
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
      <header className="workspace-header">
        <div className="header-navigation">
          <SidebarTrigger aria-label="Toggle sidebar" className="-ml-1" />
          <Separator orientation="vertical" className="header-divider" />
          <Breadcrumb><BreadcrumbList className="flex-nowrap">
            <BreadcrumbItem className="repository-crumb"><Workflow size={15} /><span>Repository</span></BreadcrumbItem>
            <BreadcrumbSeparator className="repository-crumb" />
            <BreadcrumbItem className="min-w-0"><BreadcrumbPage className="truncate">{tab === "overview" ? "App overview" : tab === "review" ? "Code review" : flow.title}</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList></Breadcrumb>
        </div>
        <div className="header-actions">
          <Button variant="ghost" size="icon-xs" aria-label="Toggle theme" title="Toggle theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>{mounted && resolvedTheme === "dark" ? <Sun /> : <Moon />}</Button>
          <Button variant="outline" size="xs" onClick={exportReport}><Download data-icon="inline-start" />Export report</Button>
        </div>
      </header>
      <Tabs size="sm" value={tab} onValueChange={(value) => { if (value === "canvas" || value === "review" || value === "overview") setTab(value); }} className="workspace-tabs">
        <div className="tab-strip">
          <TabsList variant="line" aria-label="Workspace views">
            <TabsTrigger value="canvas"><GitBranch data-icon="inline-start" />Flow canvas</TabsTrigger>
            <TabsTrigger value="review"><ShieldCheck data-icon="inline-start" />Findings<Badge variant="secondary">{report.findings.length}</Badge></TabsTrigger>
            <TabsTrigger value="overview"><Layers data-icon="inline-start" />Overview</TabsTrigger>
          </TabsList>
          {tab === "canvas" && <div className="flow-stats">{flow.nodes.length} steps<span>·</span>{flow.edges.length} connections</div>}
        </div>
        {storageError && <Alert className="storage-alert"><AlertTriangle /><AlertTitle>Annotations need attention</AlertTitle><AlertDescription>{storageError}</AlertDescription></Alert>}
        <TabsContent value="canvas" className="body-area">
          {tab === "canvas" && mounted && <CanvasView key={`${report.repository.snapshotId}:${flowId}`} flow={flow} findings={findings} annotations={annotations} update={(value) => updateAnnotations(flowId, value)} selectedId={selectedId} inspect={inspect} dark={resolvedTheme === "dark"} />}
          {tab === "canvas" && selected && <StepInspector step={selected} findings={findings.filter((finding) => finding.nodeIds.includes(selected.id))} note={annotations.notes[selected.id] ?? ""} textareaRef={textareaRef} onNoteChange={(note) => updateAnnotations(flowId, { notes: { ...annotations.notes, [selected.id]: note } })} onClose={() => setSelectedId(null)} />}
        </TabsContent>
        <TabsContent value="review" className="review-page">
          <Alert role="status" className="review-summary"><ShieldCheck /><AlertTitle><h2>{report.findings.length ? `${report.findings.length} finding${report.findings.length === 1 ? "" : "s"} to review` : "No issues reported"}</h2></AlertTitle><AlertDescription>Review is limited to the traced feature and available source.</AlertDescription></Alert>
          {report.findings.map((finding) => <FindingDetails key={finding.id} finding={finding}><Button variant="outline" size="sm" onClick={() => { setFlowId(finding.flowId); inspect(finding.nodeIds[0]); }}>Locate on canvas<ArrowUpRight data-icon="inline-end" /></Button></FindingDetails>)}
        </TabsContent>
        <TabsContent value="overview" className="overview-page"><OverviewView flow={flow} report={report} mounted={mounted} /></TabsContent>
      </Tabs>
    </SidebarInset>
  </SidebarProvider>;
}

function OverviewView({ flow, report, mounted }: { flow: Flow; report: Report; mounted: boolean }) {
  return <>
    <Card size="sm">
      <CardHeader><CardTitle><h2>{flow.title}</h2></CardTitle><CardDescription>{flow.description}</CardDescription></CardHeader>
      <CardContent>
        <h3 className="section-label">Snapshot details</h3>
        <dl className="snapshot-details">
          <div><dt>Analysis</dt><dd><Badge variant="secondary"><ShieldCheck data-icon="inline-start" />Static analysis</Badge></dd></div>
          <div><dt>Revision</dt><dd>{report.repository.revision?.slice(0, 7) ?? "No Git revision"}{report.repository.dirty ? " · uncommitted" : ""}</dd></div>
          <div><dt>Captured</dt><dd><time dateTime={report.repository.capturedAt}>{mounted ? new Date(report.repository.capturedAt).toLocaleString() : report.repository.capturedAt}</time></dd></div>
        </dl>
      </CardContent>
    </Card>
    <Card size="sm">
      <CardHeader><CardTitle><h2>App overview</h2></CardTitle><CardDescription>{report.overview.summary}</CardDescription></CardHeader>
      <CardContent>
        <div className="stack-tags">{report.overview.stack.map((tag) => <Badge variant="secondary" key={tag}>{tag}</Badge>)}</div>
        <h3 className="section-label">Entry points</h3>
        {report.overview.entryPoints.map((entry) => <div key={entry.label} className="overview-entry"><h4>{entry.label}</h4><EvidenceList evidence={entry.evidence} /></div>)}
      </CardContent>
    </Card>
    <Card size="sm">
      <CardHeader><CardTitle><h2>Analysis boundaries</h2></CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        {report.limitations.length ? <ul>{report.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p>No additional boundaries reported.</p>}
        <p className="muted">This is a code snapshot. It does not represent live execution.</p>
      </CardContent>
    </Card>
  </>;
}

function CanvasView({ flow, findings, annotations, update, selectedId, inspect, dark }: {
  flow: Flow; findings: Finding[]; annotations: Annotations; update: (value: Partial<Annotations>) => void;
  selectedId: string | null; inspect: (id: string, note?: boolean) => void; dark: boolean;
}) {
  const [selectedEdge, setSelectedEdge] = useState<Flow["edges"][number] | null>(null);
  const inspectStep = useCallback((id: string, note?: boolean) => { setSelectedEdge(null); inspect(id, note); }, [inspect]);
  const automatic = useMemo(() => layoutFlow(flow), [flow]);
  const makeNodes = () => flow.nodes.map((step): CanvasNode => ({
    id: step.id, type: "step", position: annotations.positions[step.id] ?? automatic[step.id],
    selected: selectedId === step.id,
    data: { step, findingCount: findings.filter((f) => f.nodeIds.includes(step.id)).length, hasNote: Boolean(annotations.notes[step.id]), inspect: inspectStep },
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
  const onChanges = (changes: NodeChange<CanvasNode>[]) => setNodes((previous) => applyNodeChanges(changes.filter((change) => change.type !== "remove"), previous));
  const reset = () => { setNodes((previous) => previous.map((node) => ({ ...node, position: automatic[node.id] }))); update({ positions: {}, viewport: undefined }); setTimeout(() => void fitView({ padding: 0.25, maxZoom: 1, duration: 300 }), 50); };
  const saveViewport = (_: unknown, viewport: Viewport) => { setZoom(viewport.zoom); update({ viewport }); };
  return <div className="canvas-area" data-testid="canvas"><ReactFlow<CanvasNode>
    nodes={renderedNodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onChanges}
    onNodeClick={(_, node) => inspectStep(node.id)}
    onNodeDragStop={(_, node) => update({ positions: { ...annotations.positions, [node.id]: node.position } })}
    onEdgeClick={(_, edge) => setSelectedEdge(flow.edges.find((e) => e.id === edge.id) ?? null)}
    nodesDraggable={!locked} nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null}
    elementsSelectable panOnDrag selectionOnDrag={false} zoomOnDoubleClick={false}
    minZoom={0.2} maxZoom={1.5} fitView={!annotations.viewport} defaultViewport={annotations.viewport}
    fitViewOptions={{ padding: 0.25, maxZoom: 1 }} onMoveEnd={saveViewport} colorMode={dark ? "dark" : "light"}>
    <Background variant={BackgroundVariant.Dots} gap={16} size={1.2} color="var(--canvas-dot)" bgColor="var(--canvas)" />
    <MiniMap position="bottom-right" pannable zoomable nodeColor={(node) => ({ entry: "#7dd3fc", action: "#6ee7b7", decision: "#c4b5fd", external: "#67e8f9", outcome: "#cbd5e1" })[(node.data as CanvasNode["data"]).step.kind]} />
  </ReactFlow>
    <div className="canvas-controls">
      <Button variant="ghost" size="icon-xs" aria-label="Zoom in" title="Zoom in" onClick={() => void zoomIn()} disabled={zoom >= 1.5}><Plus /></Button>
      <Button variant="ghost" size="icon-xs" aria-label="Zoom out" title="Zoom out" onClick={() => void zoomOut()} disabled={zoom <= 0.2}><Minus /></Button>
      <span className="zoom-value">{Math.round(zoom * 100)}%</span><Separator orientation="vertical" className="control-divider" />
      <Button variant="ghost" size="icon-xs" aria-label="Fit view" title="Fit view" onClick={() => void fitView({ padding: 0.25, maxZoom: 1, duration: 300 })}><Maximize /></Button>
      <Button variant="ghost" size="icon-xs" aria-label="Reset layout" title="Reset layout" onClick={reset}><RotateCcw /></Button>
      <Separator orientation="vertical" className="control-divider" />
      <Button variant={locked ? "secondary" : "ghost"} size="icon-xs" aria-label={locked ? "Unlock node movement" : "Lock node movement"} title={locked ? "Unlock node movement" : "Lock node movement"} aria-pressed={locked} onClick={() => setLocked(!locked)}>{locked ? <Lock /> : <Unlock />}</Button>
    </div>
    {selectedEdge && <Card size="sm" className="edge-inspector">
      <CardHeader>
        <CardTitle><h3>{selectedEdge.label}</h3></CardTitle><CardDescription><ConfidenceLabel confidence={selectedEdge.confidence} connection /></CardDescription>
        <CardAction><Button variant="ghost" size="icon-xs" aria-label="Close connection evidence" onClick={() => setSelectedEdge(null)}><X /></Button></CardAction>
      </CardHeader>
      <CardContent><EvidenceList evidence={selectedEdge.evidence} /></CardContent>
    </Card>}
  </div>;
}
