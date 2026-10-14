"use client";

import { useState } from "react";
import { GitBranch, Layers, Search, ShieldCheck, Workflow } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInput, SidebarMenu, SidebarMenuBadge,
  SidebarMenuButton, SidebarMenuItem, SidebarRail, useSidebar,
} from "@/components/ui/sidebar";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import type { Report } from "@/lib/report";

export type WorkspaceView = "canvas" | "review" | "overview";

type AppSidebarProps = {
  report: Report;
  activeView: WorkspaceView;
  activeFlowId: string;
  onChangeView: (view: WorkspaceView) => void;
  onChangeFlow: (id: string) => void;
};

// sidebar-07's icon-collapsible shell, populated with this report's navigation.
export function AppSidebar({ report, activeView, activeFlowId, onChangeView, onChangeFlow }: AppSidebarProps) {
  const [query, setQuery] = useState("");
  const { setOpenMobile } = useSidebar();
  const navigate = (action: () => void) => { action(); setOpenMobile(false); };
  const flows = report.flows.filter((flow) => flow.title.toLowerCase().includes(query.toLowerCase()));
  return <Sidebar collapsible="icon" className="repo-flow-sidebar">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" tooltip={report.repository.name} aria-label="Repository overview" onClick={() => navigate(() => onChangeView("overview"))}>
            <span className="flex size-4 shrink-0 items-center justify-center group-data-[collapsible=icon]:size-8"><Workflow className="text-primary" /></span>
            <span className="grid min-w-0 flex-1 gap-1 text-left text-xs group-data-[collapsible=icon]:hidden">
              <span className="truncate font-semibold">GodEyes</span>
              <span className="truncate text-muted-foreground" title={report.repository.name}>{report.repository.name}</span>
            </span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel className="group-data-[collapsible=icon]:pointer-events-none">Workspace</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="sm" tooltip="App overview" aria-label="App overview" isActive={activeView === "overview"} aria-current={activeView === "overview" ? "page" : undefined} onClick={() => navigate(() => onChangeView("overview"))}>
                <Layers /><span>App overview</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton size="sm" className="pr-8" tooltip="Code review" aria-label="Code review" isActive={activeView === "review"} aria-current={activeView === "review" ? "page" : undefined} onClick={() => navigate(() => onChangeView("review"))}>
                <ShieldCheck /><span>Code review</span>
              </SidebarMenuButton>
              <SidebarMenuBadge>{report.findings.length}</SidebarMenuBadge>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel className="group-data-[collapsible=icon]:pointer-events-none">Analyzed flows</SidebarGroupLabel>
        <SidebarGroupContent>
          <div className="relative mb-2 group-data-[collapsible=icon]:hidden">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-3 text-muted-foreground" />
            <SidebarInput aria-label="Search flows" placeholder="Find a flow…" className="pl-7" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <SidebarMenu>
            {flows.map((flow) => <SidebarMenuItem key={flow.id}>
              <SidebarMenuButton size="sm" tooltip={flow.title} aria-label={flow.title} isActive={activeView === "canvas" && flow.id === activeFlowId} aria-current={activeView === "canvas" && flow.id === activeFlowId ? "page" : undefined} onClick={() => navigate(() => onChangeFlow(flow.id))}>
                <GitBranch /><span>{flow.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>)}
          </SidebarMenu>
          {!flows.length && <Empty className="px-2 py-3 group-data-[collapsible=icon]:hidden"><EmptyHeader><EmptyDescription>No matching flows.</EmptyDescription></EmptyHeader></Empty>}
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="sm" tooltip="Local analysis snapshot" aria-label="Analysis boundaries" onClick={() => navigate(() => onChangeView("overview"))}>
            <ShieldCheck className="text-primary" /><span>Local snapshot</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>;
}
