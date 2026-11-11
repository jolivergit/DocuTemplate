import { createContext, useContext, useEffect, useMemo, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getActiveWorkspaceId, setActiveWorkspaceId } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export type Workspace = { id: string; name: string; role: "Owner" | "Member" };
export type WorkspaceStatus = {
  workspaces: Workspace[];
  active: Workspace & { revision: number };
  userId: string;
};
type WorkspaceContextValue = WorkspaceStatus & {
  isOwner: boolean;
  switchWorkspace: (id: string) => Promise<void>;
  refresh: () => void;
};
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function loadSavedWorkspace() {
  try { return sessionStorage.getItem("studio-pm-workspace"); } catch { return null; }
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [workspaceId, setWorkspaceId] = useState<string | null>(() => loadSavedWorkspace());
  const [revision, setRevision] = useState<number | null>(null);
  const [switching, setSwitching] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const signature = useRef("");
  const isScopedQuery = (query: { queryKey: readonly unknown[] }) =>
    query.queryKey[0] !== "/api/workspaces" && query.queryKey[0] !== "/auth/user";
  const prepareStatus = async (status: WorkspaceStatus) => {
    const next = `${status.userId}:${status.active.id}:${status.active.role}:${status.active.revision}`;
    if (signature.current !== next) {
      await qc.cancelQueries({ predicate: isScopedQuery });
      qc.removeQueries({ predicate: isScopedQuery });
      signature.current = next;
    }
    // Set the request scope before exposing data/rendering any child query.
    setActiveWorkspaceId(status.active.id);
    return status;
  };

  const { data, isLoading, isError, refetch } = useQuery<WorkspaceStatus>({
    queryKey: ["/api/workspaces"],
    queryFn: async () => {
      // During recovery, omit a stale workspace header so a revoked membership cannot strand the app.
      const headers = new Headers();
      if (!switching && workspaceId) headers.set("X-Workspace-Id", workspaceId);
      const response = await fetch("/api/workspaces", { credentials: "include", headers });
      if (!response.ok) {
        if (response.status === 403) {
          const fallback = await fetch("/api/workspaces", { credentials: "include" });
          if (fallback.ok) {
            setRecoveryError("Workspace access changed. Your personal workspace has been restored.");
            const recovered = await fallback.json();
            setWorkspaceId(recovered.active.id);
            setActiveWorkspaceId(recovered.active.id);
            try { sessionStorage.setItem("studio-pm-workspace", recovered.active.id); } catch {}
            return prepareStatus(recovered);
          }
          setWorkspaceId(null);
          setActiveWorkspaceId(null);
          try { sessionStorage.removeItem("studio-pm-workspace"); } catch {}
          setRecoveryError("Workspace access changed. Your personal workspace has been restored.");
        }
        const body = await response.text();
        throw new Error(body || response.statusText);
      }
      return prepareStatus(await response.json());
    },
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
  });

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void refetch(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refetch]);

  const active = data?.active;
  useEffect(() => {
    if (!active) return;
    setRevision(active.revision);
    if (active.id !== workspaceId) {
      setWorkspaceId(active.id);
      setActiveWorkspaceId(active.id);
      try { sessionStorage.setItem("studio-pm-workspace", active.id); } catch {}
    }
  }, [active?.id, active?.revision, workspaceId, revision, qc]);

  const switchWorkspace = async (id: string) => {
    if (id === getActiveWorkspaceId()) return;
    setSwitching(true);
    await qc.cancelQueries({ predicate: isScopedQuery });
    qc.removeQueries({ predicate: isScopedQuery });
    try {
      const response = await fetch("/api/workspaces", { credentials: "include", headers: { "X-Workspace-Id": id } });
      if (!response.ok) throw new Error(await response.text());
      const status = await prepareStatus(await response.json() as WorkspaceStatus);
      setRevision(null);
      setActiveWorkspaceId(status.active.id);
      setWorkspaceId(status.active.id);
      qc.setQueryData(["/api/workspaces"], status);
      try { sessionStorage.setItem("studio-pm-workspace", status.active.id); } catch {}
      setRecoveryError("");
    } catch (error) {
      try {
        const recovery = await fetch("/api/workspaces", { credentials: "include" });
        if (recovery.ok) {
          const status = await prepareStatus(await recovery.json() as WorkspaceStatus);
          setActiveWorkspaceId(status.active.id);
          setWorkspaceId(status.active.id);
          qc.setQueryData(["/api/workspaces"], status);
          try { sessionStorage.setItem("studio-pm-workspace", status.active.id); } catch {}
        }
      } catch {}
      setRecoveryError(error instanceof Error ? error.message : "Could not open that workspace.");
    } finally {
      setSwitching(false);
    }
  };

  const value = useMemo(() => data && ({
    ...data,
    isOwner: data.active.role === "Owner",
    switchWorkspace,
    refresh: () => { void refetch(); },
  }), [data, switchWorkspace, refetch]);

  if (isLoading || !value || switching || isError) {
    if (isError && !switching) return <div className="grid min-h-[100dvh] place-items-center p-6"><div className="max-w-sm text-center"><h1 className="text-sm font-semibold">Workspace unavailable</h1><p className="mt-2 text-xs text-muted-foreground">Studio PM could not load your workspace. Try again when your connection is restored.</p><Button className="mt-4" variant="outline" size="sm" onClick={() => void refetch()}>Retry</Button></div></div>;
    return <div className="p-6 space-y-3"><Skeleton className="h-8 w-48" /><Skeleton className="h-24 w-full" /></div>;
  }
  return (
    <WorkspaceContext.Provider value={value}>
      {recoveryError && <div role="status" className="fixed top-2 right-3 z-[100] rounded border bg-background px-3 py-2 text-xs shadow">{recoveryError}</div>}
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return value;
}

export function WorkspaceBoundary({ children }: { children: React.ReactNode }) {
  const { active } = useWorkspace();
  return <div key={`${active.id}:${active.revision}`} className="contents">{children}</div>;
}
