"use client";

import { useState } from "react";
import { Code2, GitBranch, Layers, Search, ShieldCheck, Workflow } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInput, SidebarMenu, SidebarMenuBadge,
  SidebarMenuButton, SidebarMenuItem, SidebarRail, useSidebar,
} from "@/components/ui/sidebar";
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
          <SidebarMenuButton size="sm" tooltip={report.repository.name} aria-label="Repository overview" onClick={() => navigate(() => onChangeView("overview"))}>
            <Workflow className="text-emerald-600" />
            <span className="font-semibold">Repo Flow Canvas</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <div className="px-2 pb-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
        <div className="flex items-center gap-1.5"><Code2 className="size-3 shrink-0" /><span className="truncate">{report.repository.name}</span></div>
      </div>
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Workspace</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="sm" tooltip="App overview" aria-label="App overview" isActive={activeView === "overview"} onClick={() => navigate(() => onChangeView("overview"))}>
                <Layers /><span>App overview</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton size="sm" tooltip="Code review" aria-label="Code review" isActive={activeView === "review"} onClick={() => navigate(() => onChangeView("review"))}>
                <ShieldCheck /><span>Code review</span>
              </SidebarMenuButton>
              <SidebarMenuBadge>{report.findings.length}</SidebarMenuBadge>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>Analyzed flows</SidebarGroupLabel>
        <SidebarGroupContent>
          <div className="relative mb-2 group-data-[collapsible=icon]:hidden">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-3 text-muted-foreground" />
            <SidebarInput aria-label="Search flows" placeholder="Find a flow…" className="pl-7 text-xs" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <SidebarMenu>
            {flows.map((flow) => <SidebarMenuItem key={flow.id}>
              <SidebarMenuButton size="sm" tooltip={flow.title} aria-label={flow.title} isActive={activeView === "canvas" && flow.id === activeFlowId} onClick={() => navigate(() => onChangeFlow(flow.id))}>
                <GitBranch /><span>{flow.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>)}
          </SidebarMenu>
          {!flows.length && <p className="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">No matching flows.</p>}
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="sm" tooltip="Local analysis snapshot" aria-label="Analysis boundaries" onClick={() => navigate(() => onChangeView("overview"))}>
            <ShieldCheck className="text-emerald-600" /><span>Local analysis snapshot</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <div className="px-2 pb-1 text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden">
        Refresh by running the skill again.
      </div>
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>;
}
