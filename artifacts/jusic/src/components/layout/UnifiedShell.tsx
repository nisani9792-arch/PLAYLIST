import React, { useEffect } from "react";
import { LayoutDashboard, Music, Ticket, UserPen } from "lucide-react";
import { Link, useLocation } from "wouter";

import { JusicLogo } from "@/components/ui/jusic-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";

import { useAppContext, type AppTab } from "@/context/AppContext";

type UnifiedShellProps = {
  children: React.ReactNode;
};

function tabToRoute(tab: AppTab): string {
  switch (tab) {
    case "dashboard":
      return "/dashboard";
    case "artist":
      return "/artist";
    case "playlist":
      return "/playlist";
    case "service":
      return "/service";
    default:
      return "/playlist";
  }
}

const NAV: Array<{
  tab: AppTab;
  label: string;
  icon: React.ReactNode;
}> = [
  { tab: "dashboard", label: "לוח בקרה", icon: <LayoutDashboard className="h-4 w-4" /> },
  { tab: "artist", label: "ניהול אמנים", icon: <UserPen className="h-4 w-4" /> },
  { tab: "playlist", label: "סביבת אוצרות", icon: <Music className="h-4 w-4" /> },
  { tab: "service", label: "תיבת שירות", icon: <Ticket className="h-4 w-4" /> },
];

export function UnifiedShell({ children }: UnifiedShellProps) {
  const [pathname, setLocation] = useLocation();
  const { auth, operatorName, activeTab, setRoute } = useAppContext();

  useEffect(() => {
    setRoute(pathname);
  }, [pathname, setRoute]);

  return (
    <div className="app-shell-bg min-h-[100dvh] w-full">
      <SidebarProvider defaultOpen>
        <div className="flex min-h-[100dvh] w-full">
          <Sidebar
            side="right"
            collapsible="offcanvas"
            className={cn(
              "border-border/40",
              "bg-background/70 backdrop-blur-xl"
            )}
          >
            <SidebarHeader className="px-3 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <JusicLogo size={34} framed />
                <div className="min-w-0">
                  <p className="text-sm font-bold tracking-tight leading-none">Jusic Elite Pro</p>
                  <p className="text-[10px] text-secondary truncate">מערכת מאוחדת</p>
                </div>
              </div>
            </SidebarHeader>

            <SidebarContent className="px-2.5">
              <SidebarGroup>
                <SidebarMenu>
                  {NAV.map((item) => {
                    const href = tabToRoute(item.tab);
                    const isActive = activeTab === item.tab;
                    return (
                      <SidebarMenuItem key={item.tab}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className="rounded-xl"
                        >
                          <Link href={href}>
                            <div className="flex items-center gap-3">
                              {item.icon}
                              <span className="whitespace-nowrap">{item.label}</span>
                            </div>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="px-3 pb-4">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary" className="rounded-xl">
                  {auth.state === "offline" ? "Offline" : auth.state === "ready" ? "מוכן" : "נעול"}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setLocation("/settings")}
                >
                  הגדרות
                </Button>
              </div>
              <p className="text-[10px] text-secondary mt-2 truncate">
                {operatorName ? `מפעיל: ${operatorName}` : "מפעיל לא מזוהה"}
              </p>
            </SidebarFooter>
          </Sidebar>

          <SidebarRail />

          <SidebarInset className="flex flex-col">
            <header className="j-glass-strip bp-glass-strip flex-shrink-0 flex items-center justify-between gap-4 px-4 py-3.5 border-b border-border/40">
              <div className="flex items-center gap-3">
                <SidebarTrigger
                  variant="ghost"
                  size="icon"
                  className="rounded-xl"
                  aria-label="פתח ניווט"
                />
                <div className="flex items-center gap-3 min-w-0">
                  <JusicLogo size={40} />
                  <div className="min-w-0">
                    <h1 className="text-sm font-bold font-display truncate">Master CRM</h1>
                    <p className="text-[11px] text-secondary truncate">
                      {operatorName ? `שלום ${operatorName}` : "התחברות נדרשת"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-xl">
                  {activeTab === "dashboard"
                    ? "Dashboard"
                    : activeTab === "artist"
                      ? "Artist"
                      : activeTab === "playlist"
                        ? "Playlist"
                        : "Service"}
                </Badge>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto custom-scrollbar p-4">{children}</main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}

