import { useEffect, useMemo, useRef, useState } from "react";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ProjectRole, ProjectTeam } from "@shared/project-setup";

const roles: ProjectRole[] = ["Project Admin", "Project Manager", "Designer"];
const teamKey = (id: number) => ["/api/leads", id, "team"];
type MemberDraft = { userId: string; assigned: boolean; roles: ProjectRole[] };
const membersFrom = (team: ProjectTeam): MemberDraft[] => team.members.map(member => ({
  userId: member.userId, assigned: member.assigned, roles: [...member.roles],
}));

export function TeamEditor({
  leadId, team, blockedReason, disabled = false, onDirtyChange, onSavingChange, onStatusChange,
}: {
  leadId: number;
  team: ProjectTeam;
  blockedReason?: string;
  disabled?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
  onStatusChange?: (status: { dirty: boolean; saving: boolean; error: boolean; reloading: boolean }) => void;
}) {
  const queryClientFromHook = useQueryClient();
  const [draft, setDraft] = useState(() => membersFrom(team));
  const [baseline, setBaseline] = useState(() => membersFrom(team));
  const [baseVersion, setBaseVersion] = useState(team.version);
  const [reloadError, setReloadError] = useState("");
  const [reloading, setReloading] = useState(false);
  const teamMutations = useIsMutating({ mutationKey: ["project-team-save", leadId] });
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const callbackRef = useRef(onDirtyChange);
  callbackRef.current = onDirtyChange;
  const savingCallbackRef = useRef(onSavingChange);
  savingCallbackRef.current = onSavingChange;
  const statusCallbackRef = useRef(onStatusChange);
  statusCallbackRef.current = onStatusChange;
  const queryKey = useMemo(() => teamKey(leadId), [leadId]);

  useEffect(() => { callbackRef.current?.(dirty); }, [dirty]);
  useEffect(() => {
    if (dirtyRef.current || reloading) return;
    const latest = membersFrom(team);
    setDraft(latest);
    setBaseline(latest);
    setBaseVersion(team.version);
  }, [team, team.version, dirty, reloading]);

  const save = useMutation({
    mutationKey: ["project-team-save", leadId],
    mutationFn: (payload: { version: number; members: MemberDraft[] }) =>
      apiRequest<ProjectTeam>("PUT", `/api/leads/${leadId}/team`, {
        version: payload.version,
        members: payload.members.filter(member => member.assigned),
      }),
    onMutate: () => savingCallbackRef.current?.(true),
    onSuccess: async result => {
      // The cache refresh remounts workspace-scoped screens. Keep the mutation pending until the new revision lands.
      await queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      queryClient.setQueryData(queryKey, result);
      const next = membersFrom(result);
      setDraft(next);
      setBaseline(next);
      setBaseVersion(result.version);
      setReloadError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKey }),
        queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] }),
        queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "work"] }),
      ]);
    },
    onSettled: () => savingCallbackRef.current?.(false),
  });

  const reloadLatest = async () => {
    setReloading(true);
    setReloadError("");
    try {
      await queryClientFromHook.invalidateQueries({ queryKey });
      const latest = await queryClientFromHook.fetchQuery<ProjectTeam>({ queryKey, staleTime: 0 });
      queryClient.setQueryData(queryKey, latest);
      const next = membersFrom(latest);
      setDraft(next);
      setBaseline(next);
      setBaseVersion(latest.version);
      setReloadError("");
      save.reset();
    } catch (error) {
      setReloadError(error instanceof Error ? error.message : "Could not load the latest team. Your draft is preserved.");
    } finally {
      setReloading(false);
    }
  };
  const discardDraft = () => {
    const next = membersFrom(team);
    setDraft(next);
    setBaseline(next);
    setBaseVersion(team.version);
    setReloadError("");
  };
  const update = (userId: string, changes: Partial<MemberDraft>) =>
    setDraft(current => current.map(member => member.userId === userId ? { ...member, ...changes } : member));
  const cancel = () => {
    if (dirty && !window.confirm("Discard unsaved team changes?")) return;
    discardDraft();
  };
  const canManage = team.canManage;
  const assignedCount = draft.filter(member => member.assigned).length;
  const admins = draft.filter(member => member.assigned && member.roles.includes("Project Admin")).length;
  const isConflict = (save.error as { status?: number } | null)?.status === 409;
  const locked = disabled || save.isPending || teamMutations > 0 || reloading;
  const hasError = !!save.error || !!reloadError;

  useEffect(() => {
    statusCallbackRef.current?.({
      dirty,
      saving: save.isPending || teamMutations > 0,
      error: hasError,
      reloading,
    });
  }, [dirty, save.isPending, teamMutations, hasError, reloading]);

  return <div>
    <p className="mb-3 text-xs text-muted-foreground">Project roles apply here only. Firm Owners retain access even when not assigned to this project.</p>
    {!canManage && <p className="mb-3 text-xs text-muted-foreground">Team roles are read-only for your account. You can continue working on the project below.</p>}
    {blockedReason && canManage && <p className="mb-3 rounded-md border border-amber-500/25 bg-amber-50/50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">{blockedReason}</p>}
    {team.members.length === 0 ? <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No team candidates are available. Existing project access and ordinary project work remain available.</div> : (
      <fieldset disabled={!canManage || locked} className="m-0 min-w-0 space-y-2 border-0 p-0">
        {team.members.map(member => {
          const current = draft.find(person => person.userId === member.userId);
          if (!current) return null;
          return <article key={member.userId} className={`rounded-lg border px-3 py-3 ${current.assigned ? "bg-background" : "bg-muted/20"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{member.name}</p><Badge variant="outline" className="text-[10px]">{member.firmRole}</Badge></div>
                {member.email && <p className="mt-0.5 truncate text-xs text-muted-foreground">{member.email}</p>}
                {current.assigned && current.roles.length === 0 && <p className="mt-2 text-[11px] text-amber-800 dark:text-amber-200">Roles not configured</p>}
              </div>
              <label className="flex min-h-8 cursor-pointer items-center gap-2 text-xs font-medium">
                <input type="checkbox" aria-label={`Project access for ${member.name}`} checked={current.assigned} onChange={event => update(member.userId, { assigned: event.target.checked, roles: event.target.checked ? current.roles : [] })} className="h-4 w-4 accent-primary" />
                Access
              </label>
            </div>
            {current.assigned && <fieldset className="mt-3 flex flex-wrap gap-2 border-0 p-0">
              <legend className="sr-only">Project roles for {member.name}</legend>
              {roles.map(role => {
                const checked = current.roles.includes(role);
                return <label key={role} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] transition-colors ${checked ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                  <input type="checkbox" className="sr-only" checked={checked} onChange={event => update(member.userId, { roles: event.target.checked ? [...current.roles, role] : current.roles.filter(item => item !== role) })} />
                  {checked && <Check className="h-3 w-3" />}{role}
                </label>;
              })}
            </fieldset>}
          </article>;
        })}
      </fieldset>
    )}
    {save.error && <p role="alert" className="mt-3 text-xs text-destructive">{save.error instanceof Error ? save.error.message : "Could not save team changes. Your edits are preserved."}</p>}
    {isConflict && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/30 bg-amber-50/50 p-3 text-xs dark:bg-amber-950/20">
      <span className="mr-auto">The team changed elsewhere. Your draft is preserved.</span>
      <Button size="sm" variant="outline" disabled={locked} onClick={() => void reloadLatest()}>{reloading ? "Loading…" : "Reload latest"}</Button>
      <Button size="sm" variant="ghost" disabled={locked} onClick={() => void reloadLatest()}>Discard draft & reload</Button>
    </div>}
    {reloadError && <p role="alert" className="mt-2 text-xs text-destructive">{reloadError}</p>}
    {canManage && dirty && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
      <p className="text-xs text-muted-foreground">{assignedCount} with access · {admins} Project Admin{admins === 1 ? "" : "s"}</p>
      <div className="flex gap-2"><Button size="sm" variant="ghost" disabled={locked} onClick={cancel}><X className="mr-1 h-3.5 w-3.5" />Cancel</Button><Button size="sm" disabled={locked || !!blockedReason || (team.hasAdmin && admins === 0)} onClick={() => save.mutate({ version: baseVersion, members: draft })}>{save.isPending ? "Saving…" : "Save team"}</Button></div>
    </div>}
  </div>;
}
