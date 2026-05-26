import React, { createContext, useContext, useMemo, useState } from "react";
import type { AccessStatus } from "@/lib/operator";

export type AppTab = "dashboard" | "artist" | "playlist" | "service";

type AppContextValue = {
  auth: AccessStatus;
  operatorName: string | null;
  activeTab: AppTab;
  currentPath: string;
  sessionCookieName: string;
  setAuth: (next: AccessStatus) => void;
  setActiveTab: (tab: AppTab) => void;
  setRoute: (path: string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

function pathToTab(pathname: string): AppTab {
  const path = pathname.toLowerCase();
  if (path.startsWith("/dashboard")) return "dashboard";
  if (path.startsWith("/artist")) return "artist";
  if (path.startsWith("/playlist")) return "playlist";
  if (path.startsWith("/service")) return "service";
  return "playlist";
}

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AccessStatus>({ state: "loading" });
  const [operatorName, setOperatorName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>("playlist");
  const [currentPath, setCurrentPath] = useState<string>(
    typeof window === "undefined" ? "/" : window.location.pathname
  );

  const sessionCookieName = "jusic_operator_session";

  const setRoute = (path: string) => {
    setCurrentPath(path);
    setActiveTab(pathToTab(path));
  };

  const value = useMemo<AppContextValue>(() => {
    return {
      auth,
      operatorName: auth.state === "ready" || auth.state === "offline" ? auth.operatorName : operatorName,
      activeTab,
      currentPath,
      sessionCookieName,
      setAuth: (next) => {
        setAuth(next);
        if (next.state === "ready" || next.state === "offline") setOperatorName(next.operatorName);
        if (next.state === "locked" || next.state === "register") setOperatorName(null);
      },
      setActiveTab,
      setRoute
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, activeTab, currentPath]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppContextProvider.");
  return ctx;
}

