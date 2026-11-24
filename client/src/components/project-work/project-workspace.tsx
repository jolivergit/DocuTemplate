import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Archive, Circle, MessageSquare, RotateCcw, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/lib/workspace";
import { TASK_PRIORITIES, TASK_STATUSES, type EntryInput, type EntryType, type ProjectWork, type TaskNote, type WorkEntry } from "@shared/project-work";
import { Composer, emptyDraft, entryHasContent, PhaseAssigneeFields, type EntryDraft } from "@/components/project-work/work-entry-composer";
import { WorkLogFilters } from "@/components/project-work/work-log-filters";
import { workMotionSummary } from "@/lib/work-motion-summary";
import { WorkMotionHeader } from "@/components/project-work/work-motion-header";
import { WorkEntryContent } from "@/components/project-work/work-entry-content";
import { WorkDateField } from "@/components/project-work/work-date-field";

const workKey = (id: number) => ["/api/leads", id, "work"];
const fieldClass = "h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm";
const friendlyError = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Your changes remain here.";
const isConflict = (error: unknown) => (error as { status?: number })?.status === 409;

function toInput(draft: EntryDraft): EntryInput {
  const common = { description: draft.description, phaseId: draft.phaseId || null, assigneeId: draft.assigneeId || null };
  if (draft.entryType === "Task") return { ...common, entryType: "Task", title: draft.title, priority: draft.priority as "Low" | "Normal" | "High" | "Urgent", status: draft.status as "To do" | "In progress" | "Blocked" | "Done", dueDate: draft.dueDate || null, meetingDate: null, meetingTime: null };
  if (draft.entryType === "Reminder") return { ...common, entryType: "Reminder", title: draft.title, priority: null, status: draft.status as "To do" | "Done", dueDate: draft.dueDate || null, meetingDate: null, meetingTime: null };
  if (draft.entryType === "Meeting") return { ...common, entryType: "Meeting", title: draft.title, priority: null, status: null, dueDate: null, meetingDate: draft.meetingDate || null, meetingTime: draft.meetingTime || null };
  return { ...common, entryType: "Note", title: "", priority: null, status: null, dueDate: null, meetingDate: null, meetingTime: null, description: draft.description };
}
function draftFromInput(input: EntryInput): EntryDraft {
  return {
    entryType: input.entryType, title: input.title, description: input.description, phaseId: input.phaseId ?? "",
    assigneeId: input.assigneeId ?? "", priority: input.priority ?? "Normal", status: input.status ?? "To do",
    dueDate: input.dueDate ?? "", meetingDate: input.meetingDate ?? "", meetingTime: input.meetingTime ?? "",
  };
}
function fromEntry(entry: WorkEntry): EntryDraft {
  return {
    entryType: entry.entryType, title: entry.title, description: entry.description,
    phaseId: entry.phaseId ?? "", assigneeId: entry.assigneeId ?? "", priority: entry.priority ?? "Normal",
    status: entry.status ?? "To do", dueDate: entry.dueDate ?? "", meetingDate: entry.meetingDate ?? "",
    meetingTime: entry.meetingTime ?? "",
  };
}
function fieldPatch(draft: EntryDraft) {
  return {
    title: draft.entryType === "Note" ? "" : draft.title,
    description: draft.description,
    phaseId: draft.phaseId || null,
    assigneeId: draft.assigneeId || null,
    priority: draft.entryType === "Task" ? draft.priority : null,
    status: draft.entryType === "Task" || draft.entryType === "Reminder" ? draft.status : null,
    dueDate: draft.entryType === "Task" || draft.entryType === "Reminder" ? draft.dueDate || null : null,
    meetingDate: draft.entryType === "Meeting" ? draft.meetingDate || null : null,
    meetingTime: draft.entryType === "Meeting" ? draft.meetingTime || null : null,
  };
}
export function ProjectWorkWorkspace({ leadId, onDirtyChange }: { leadId: number; onDirtyChange?: (dirty: boolean) => void }) {
  const { userId } = useWorkspace();
  const [entryTypeFilter, setEntryTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [actionableOnly, setActionableOnly] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [archived, setArchived] = useState(false);
  const [composer, setComposer] = useState<EntryDraft | null>(null);
  const [composerRequestId, setComposerRequestId] = useState(() => crypto.randomUUID());
  const [createError, setCreateError] = useState("");
  const [uncertainInput, setUncertainInput] = useState<EntryInput | null>(null);
  const [originalResolved, setOriginalResolved] = useState(false);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EntryDraft | null>(null);
  const [editVersion, setEditVersion] = useState<number | null>(null);
  const [editError, setEditError] = useState("");
  const [discussionId, setDiscussionId] = useState<string | null>(null);
  const [discussion, setDiscussion] = useState("");
  const [discussionRequestId, setDiscussionRequestId] = useState(() => crypto.randomUUID());
  const [discussionError, setDiscussionError] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [reloadPending, setReloadPending] = useState(false);
  const [summaryNow, setSummaryNow] = useState(() => new Date());
  const dirtyCallback = useRef(onDirtyChange);
  dirtyCallback.current = onDirtyChange;
  const { data, isLoading, isError, error, refetch } = useQuery<ProjectWork>({ queryKey: workKey(leadId) });
  const invalidate = async () => { await queryClient.invalidateQueries({ queryKey: workKey(leadId) }); };
  const createMutation = useMutation({
    mutationKey: ["project-work-entry-create", leadId],
    mutationFn: ({ input, requestId }: { input: EntryInput; requestId: string }) => apiRequest<WorkEntry>("POST", `/api/leads/${leadId}/work/entries`, { requestId, entry: input }),
    onSuccess: async () => { await invalidate(); },
  });
  const patchMutation = useMutation({
    mutationKey: ["project-work-entry-patch", leadId],
    mutationFn: ({ id, patch, version }: { id: string; patch: Record<string, unknown>; version: number }) => apiRequest<WorkEntry>("PATCH", `/api/leads/${leadId}/work/entries/${id}`, { ...patch, version }),
    onSuccess: async () => { await invalidate(); },
  });
  const discussionMutation = useMutation({
    mutationKey: ["project-work-entry-discussion", leadId],
    mutationFn: ({ entryId, content, requestId }: { entryId: string; content: string; requestId: string }) => apiRequest<TaskNote[]>("POST", `/api/leads/${leadId}/work/entries/${entryId}/notes`, { content, requestId }),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "work", "entries", variables.entryId, "notes"] });
      await invalidate();
    },
  });
  const entries = data?.entries ?? [];
  const phases = data?.phases ?? [];
  const assignees = data?.assignees ?? [];
  const hasDraft = !!composer && (entryHasContent(composer) || !!composer.description || !!composer.phaseId || !!composer.assigneeId || composer.priority !== "Normal" || composer.status !== "To do" || !!composer.dueDate || !!composer.meetingDate || !!composer.meetingTime);
  const editDirty = !!editDraft && !!editingId && (() => {
    const original = entries.find(entry => entry.id === editingId);
    return !!original && JSON.stringify(fieldPatch(editDraft)) !== JSON.stringify(fieldPatch(fromEntry(original)));
  })();
  const [pendingCount, setPendingCount] = useState(0);
  const [recoveryChecked, setRecoveryChecked] = useState(false);
  const workDirty = hasDraft || editDirty || !!discussion.trim() || pendingCount > 0;
  useEffect(() => { dirtyCallback.current?.(workDirty); }, [workDirty]);
  useEffect(() => {
    const update = () => setSummaryNow(new Date());
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!workDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [workDirty]);
  const summary = workMotionSummary(entries, summaryNow);
  const phaseName = (id: string | null) => id ? phases.find(phase => phase.id === id)?.name ?? "Archived phase" : "";
  const visibleEntries = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return entries.filter(entry => {
      if (entry.id === editingId || entry.id === discussionId) return true;
      if (entry.archived !== archived) return false;
      if (entryTypeFilter !== "all" && entry.entryType !== entryTypeFilter) return false;
      if (actionableOnly && entry.entryType !== "Task" && entry.entryType !== "Reminder") return false;
      if (mineOnly && entry.assigneeId !== userId) return false;
      if (q && !`${entry.title} ${entry.description} ${entry.authorName ?? ""} ${entry.assigneeName ?? ""}`.toLocaleLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [entries, archived, entryTypeFilter, actionableOnly, mineOnly, userId, search, editingId, discussionId]);
  const activeEditor = !!composer || !!editingId || !!discussionId;
  const requestClose = () => {
    if (workDirty) setConfirmDiscard(true);
    else discardCurrent();
  };
  const discardCurrent = () => {
    setComposer(null); setCreateError(""); setUncertainInput(null);
    setEditingId(null); setEditDraft(null); setEditError(""); setEditVersion(null);
    setDiscussionId(null); setDiscussion(""); setDiscussionError("");
    setConfirmDiscard(false);
  };
  const startPending = () => setPendingCount(count => count + 1);
  const finishPending = () => setPendingCount(count => Math.max(0, count - 1));
  const createEntry = async (input: EntryInput, requestId: string) => {
    startPending();
    try {
      await createMutation.mutateAsync({ requestId, input });
      setComposer(null); setCreateError(""); setSaveError(""); setUncertainInput(null);
      setComposerRequestId(crypto.randomUUID());
    } catch (error) {
      setCreateError(isConflict(error) ? "The save may have reached the server. Check for your entry before retrying; your draft and request ID are preserved." : friendlyError(error));
      setUncertainInput(input);
      setRecoveryChecked(false);
      setOriginalResolved(false);
    } finally { finishPending(); }
  };
  const checkCreateRecovery = async () => {
    setRecoveryPending(true);
    setSaveError("");
    try {
      const latest = await queryClient.fetchQuery<ProjectWork>({ queryKey: workKey(leadId), queryFn: () => apiRequest("GET", `/api/leads/${leadId}/work`), staleTime: 0 });
      const match = latest.entries.find(entry => entry.creationRequestId === composerRequestId && entry.authorId === userId);
      const changedSinceRequest = !!composer && !!uncertainInput && JSON.stringify(toInput(composer)) !== JSON.stringify(uncertainInput);
      if (match) {
        if (changedSinceRequest) {
          setRecoveryChecked(true);
          setOriginalResolved(true);
          setCreateError("The previous request was saved. Your changed draft is still here; choose a new request only if you intend to save it as another entry.");
        } else {
          setComposer(null); setCreateError(""); setUncertainInput(null); setComposerRequestId(crypto.randomUUID());
        }
        await invalidate();
      } else {
        setRecoveryChecked(true);
        setOriginalResolved(false);
        setSaveError(changedSinceRequest
          ? "No entry was found for the original request. Your changed draft remains here; restore the original to retry it or explicitly start a new save for these changes."
          : "No saved entry was found. Retry the same save, or explicitly start a new save if you change its contents.");
      }
    } catch (error) { setSaveError(`Could not check saved entries: ${friendlyError(error)}`); }
    finally { setRecoveryPending(false); }
  };
  const saveEdit = async (entry: WorkEntry, draft: EntryDraft, version: number) => {
    startPending(); setEditError("");
    try {
      await patchMutation.mutateAsync({ id: entry.id, patch: fieldPatch(draft), version });
      setEditingId(null); setEditDraft(null); setEditVersion(null);
    } catch (error) {
      setEditError(isConflict(error) ? "This entry changed elsewhere. Your draft is preserved. Reload the latest version before making another save." : friendlyError(error));
    } finally { finishPending(); }
  };
  const patchStatusOrArchive = async (entry: WorkEntry, patch: Record<string, unknown>) => {
    startPending(); setSaveError("");
    try {
      await patchMutation.mutateAsync({ id: entry.id, patch, version: entry.version });
    } catch (error) { setSaveError(isConflict(error) ? "This entry changed elsewhere. Reload the latest entries before trying again." : friendlyError(error)); }
    finally { finishPending(); }
  };
  const reloadEntry = async (id: string) => {
    setReloadPending(true);
    try {
      const latest = await queryClient.fetchQuery<ProjectWork>({ queryKey: workKey(leadId), queryFn: () => apiRequest("GET", `/api/leads/${leadId}/work`), staleTime: 0 });
      const found = latest.entries.find(entry => entry.id === id);
      if (!found) throw new Error("This entry is no longer available.");
      setEditDraft(fromEntry(found)); setEditVersion(found.version); setEditError("");
    } catch (error) { setEditError(`Reload failed: ${friendlyError(error)} Your draft remains available.`); }
    finally { setReloadPending(false); }
  };
  const postDiscussion = async (entryId: string) => {
    startPending(); setDiscussionError("");
    try {
      await discussionMutation.mutateAsync({ entryId, content: discussion.trim(), requestId: discussionRequestId });
      setDiscussion(""); setDiscussionError(""); setDiscussionRequestId(crypto.randomUUID());
    } catch (error) { setDiscussionError(friendlyError(error)); }
    finally { finishPending(); }
  };
  const startComposer = (type: EntryType) => {
    if (activeEditor || pendingCount) return;
    setComposer(emptyDraft(type)); setComposerRequestId(crypto.randomUUID()); setCreateError(""); setSaveError(""); setUncertainInput(null); setRecoveryChecked(false); setOriginalResolved(false);
  };
  const startEdit = (entry: WorkEntry) => {
    if (activeEditor || pendingCount) return;
    setEditingId(entry.id); setEditDraft(fromEntry(entry)); setEditVersion(entry.version); setEditError("");
  };
  const startDiscussion = (entry: WorkEntry) => {
    if (activeEditor || pendingCount) return;
    setDiscussionId(entry.id); setDiscussion(""); setDiscussionRequestId(crypto.randomUUID()); setDiscussionError("");
  };

  if (isLoading) return <section className="space-y-3" aria-label="Work in motion loading"><Skeleton className="h-20 w-full" /><Skeleton className="h-14 w-full" /><Skeleton className="h-48 w-full" /></section>;
  const errorStatus = (error as { status?: number } | null)?.status;
  const accessDenied = [401, 403, 404].includes(errorStatus ?? 0);
  if ((isError && (!data || accessDenied)) || !data) return <section className="rounded-lg border border-destructive/30 bg-card p-5" role="alert"><h2 className="text-sm font-semibold">Work log could not load</h2><p className="mt-1 text-sm text-muted-foreground">{accessDenied ? "You no longer have access to this project work log." : "Your project setup is safe. Try loading the log again."}</p>{!accessDenied && <Button className="mt-3" size="sm" variant="outline" onClick={() => void refetch()}>Retry</Button>}</section>;

  return <div className="space-y-5">
    {isError && data && <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"><span>The latest refresh failed. Saved entries and any open drafts are still here.</span><Button size="sm" variant="ghost" onClick={() => void refetch()}>Retry</Button></div>}
    {saveError && !composer && <div role="alert" className="flex items-start justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm"><span>{saveError}</span><Button size="icon" variant="ghost" aria-label="Dismiss message" onClick={() => setSaveError("")}><X className="h-4 w-4" /></Button></div>}
    <section className="overflow-hidden rounded-xl border bg-card" aria-label="Work in motion">
      <WorkMotionHeader
        summary={summary}
        addDisabled={!!pendingCount || activeEditor}
        onAddUpdate={() => startComposer("Task")}
      />
      {composer && <Composer draft={composer} setDraft={setComposer} phases={phases} assignees={assignees} pending={!!pendingCount || recoveryPending}
        error={createError} saveError={saveError} onDismiss={requestClose}
        onSubmit={() => {
          try { void createEntry(toInput(composer), composerRequestId); }
          catch { setCreateError("Check the required fields and try again."); }
        }}
        onCheck={checkCreateRecovery}
        onNewRequest={() => { setComposerRequestId(crypto.randomUUID()); setCreateError(""); setUncertainInput(null); setRecoveryChecked(false); setOriginalResolved(false); setSaveError(""); }}
        onRestoreOriginal={() => { if (uncertainInput) setComposer(draftFromInput(uncertainInput)); setSaveError(""); }}
        canNewRequest={!!uncertainInput && recoveryChecked && JSON.stringify(toInput(composer)) !== JSON.stringify(uncertainInput)}
        canRestoreOriginal={!!uncertainInput && recoveryChecked && !originalResolved && JSON.stringify(toInput(composer)) !== JSON.stringify(uncertainInput)}
        blockedChangedRequest={!!uncertainInput && JSON.stringify(toInput(composer)) !== JSON.stringify(uncertainInput)}
        originalResolved={originalResolved}
        confirmDiscard={confirmDiscard} onKeepEditing={() => setConfirmDiscard(false)} onDiscard={discardCurrent}
      />}
      <fieldset aria-label="Work log filters" disabled={!!pendingCount || activeEditor} className="m-0 min-w-0 border-0 border-b border-border p-3 sm:p-4">
        <WorkLogFilters
          search={search}
          onSearchChange={setSearch}
          entryTypeFilter={entryTypeFilter}
          onEntryTypeFilterChange={setEntryTypeFilter}
          actionableOnly={actionableOnly}
          onActionableOnlyChange={setActionableOnly}
          mineOnly={mineOnly}
          onMineOnlyChange={setMineOnly}
          archived={archived}
          onArchivedChange={setArchived}
        />
      </fieldset>
      {visibleEntries.length === 0 ? <div className="px-5 py-10 text-center">
        <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground"><Circle className="h-4 w-4" /></div>
        <h3 className="mt-3 text-sm font-semibold">{entries.length ? "Nothing in this view" : "Start with what happened today"}</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{entries.length ? "Try another type, filter, or search." : "Add a task, reminder, meeting, or plain note. No workflow ceremony required."}</p>
        {!entries.length && <Button className="mt-4" size="sm" onClick={() => startComposer("Note")}>Write a note</Button>}
      </div> : <div className="divide-y">
        {visibleEntries.map(entry => <EntryRow key={entry.id} entry={entry} phase={phaseName(entry.phaseId)} editing={editingId === entry.id} editDraft={editingId === entry.id ? editDraft : null}
          setEditDraft={setEditDraft} editError={editingId === entry.id ? editError : ""} editPending={!!pendingCount || reloadPending} interactionDisabled={!!pendingCount || reloadPending || activeEditor} phases={phases} assignees={assignees}
          notesOpen={discussionId === entry.id} discussion={discussionId === entry.id ? discussion : ""} setDiscussion={setDiscussion}
          discussionError={discussionError} onEdit={() => startEdit(entry)} onSave={() => editDraft && editVersion !== null && void saveEdit(entry, editDraft, editVersion)}
          onReload={() => void reloadEntry(entry.id)} onCancelEdit={requestClose}
          onToggleStatus={() => void patchStatusOrArchive(entry, { status: entry.status === "Done" ? "To do" : "Done" })}
          onArchive={() => void patchStatusOrArchive(entry, { archived: !entry.archived })}
          onDiscussion={() => startDiscussion(entry)} onPostDiscussion={() => postDiscussion(entry.id)} onCloseDiscussion={requestClose}
          onLoadNotes={() => queryClient.fetchQuery<TaskNote[]>({ queryKey: ["/api/leads", leadId, "work", "entries", entry.id, "notes"], queryFn: () => apiRequest("GET", `/api/leads/${leadId}/work/entries/${entry.id}/notes`), staleTime: 0 })}
          onDiscard={discardCurrent} confirmDiscard={confirmDiscard} setConfirmDiscard={setConfirmDiscard} />
        )}
      </div>}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-xs text-muted-foreground"><span>{entries.length} log {entries.length === 1 ? "entry" : "entries"} · {phases.filter(phase => !phase.archived).length} active phases</span></footer>
    </section>
  </div>;
}

function EntryRow({ entry, phase, editing, editDraft, setEditDraft, editError, editPending, interactionDisabled, phases, assignees, notesOpen, discussion, setDiscussion, discussionError, onEdit, onSave, onReload, onCancelEdit, onToggleStatus, onArchive, onDiscussion, onPostDiscussion, onCloseDiscussion, onLoadNotes, onDiscard, confirmDiscard, setConfirmDiscard }: {
  entry: WorkEntry; phase: string; editing: boolean; editDraft: EntryDraft | null; setEditDraft: (draft: EntryDraft | null) => void; editError: string; editPending: boolean; interactionDisabled: boolean;
  phases: ProjectWork["phases"]; assignees: ProjectWork["assignees"]; notesOpen: boolean; discussion: string; setDiscussion: (value: string) => void; discussionError: string;
  onEdit: () => void; onSave: () => void; onReload: () => void; onCancelEdit: () => void; onToggleStatus: () => void; onArchive: () => void; onDiscussion: () => void; onPostDiscussion: () => Promise<void>; onCloseDiscussion: () => void;
  onLoadNotes: () => Promise<TaskNote[]>; onDiscard: () => void; confirmDiscard: boolean; setConfirmDiscard: (value: boolean) => void;
}) {
  const [notes, setNotes] = useState<TaskNote[] | null>(null);
  const [notesError, setNotesError] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);
  const actionable = entry.entryType === "Task" || entry.entryType === "Reminder";
  const discussionPreview = entry.discussionPreview;
  const hasDiscussionPreview = entry.noteCount > 0
    && !!discussionPreview
    && typeof discussionPreview.authorName === "string"
    && typeof discussionPreview.content === "string";
  const editDirty = !!editDraft && JSON.stringify(fieldPatch(editDraft)) !== JSON.stringify(fieldPatch(fromEntry(entry)));
  const getNotes = async () => {
    setNotesLoading(true); setNotesError("");
    try { setNotes(await onLoadNotes()); } catch (error) { setNotesError(friendlyError(error)); }
    finally { setNotesLoading(false); }
  };
  useEffect(() => {
    if (notesOpen) void getNotes();
  }, [notesOpen]);
  return <article className={`px-4 py-4 sm:px-5 ${entry.archived ? "bg-muted/20" : ""} ${entry.status === "Blocked" && !entry.archived ? "border-l-2 border-foreground/40" : ""}`}>
    <WorkEntryContent entry={entry} phase={phase} />
    <div className="ml-10">
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {actionable && !entry.archived && <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" disabled={interactionDisabled} onClick={onToggleStatus}>{entry.status === "Done" ? "Reopen" : "Mark done"}</Button>}
          <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" disabled={interactionDisabled} onClick={onEdit}>Edit</Button>
          <Button size="sm" variant="ghost" className={`h-7 px-2.5 text-xs ${entry.noteCount > 0 ? "bg-muted font-semibold" : "text-muted-foreground"}`} disabled={interactionDisabled} onClick={onDiscussion} aria-expanded={notesOpen} aria-controls={`entry-discussion-${entry.id}`}>
            <MessageSquare aria-hidden="true" className={`mr-1 h-3.5 w-3.5 ${entry.noteCount > 0 ? "fill-foreground/20 text-foreground" : "text-muted-foreground"}`} />
            Discussion{entry.noteCount > 0 ? ` (${entry.noteCount})` : ""}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" disabled={interactionDisabled} onClick={onArchive}>{entry.archived ? <><RotateCcw className="mr-1 h-3.5 w-3.5" />Restore</> : <><Archive className="mr-1 h-3.5 w-3.5" />Archive</>}</Button>
      </div>
      {!notesOpen && hasDiscussionPreview && discussionPreview && <Button
        size="sm"
        variant="ghost"
        className="mt-1.5 flex h-8 w-full min-w-0 justify-start gap-2 overflow-hidden px-2 text-left text-xs text-muted-foreground"
        disabled={interactionDisabled}
        onClick={onDiscussion}
        aria-label={`Latest comment by ${discussionPreview.authorName}: ${discussionPreview.content}`}
        aria-expanded={notesOpen}
        aria-controls={`entry-discussion-${entry.id}`}
      >
        <MessageSquare aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-foreground/75" />
        <span className="max-w-[34%] shrink-0 truncate font-medium text-foreground/80 sm:max-w-[28%]">{discussionPreview.authorName}</span>
        <span aria-hidden="true" className="shrink-0 text-muted-foreground/70">·</span>
        <span className="min-w-0 flex-1 truncate">{discussionPreview.content}</span>
      </Button>}
    </div>
    {editing && editDraft && <form className="ml-10 mt-4 space-y-3 rounded-md border bg-muted/20 p-3 sm:p-4" onSubmit={e => { e.preventDefault(); onSave(); }}>
      <fieldset disabled={editPending} className="contents">
      {entry.entryType !== "Note" && <label className="block space-y-1 text-xs font-medium">{entry.entryType === "Meeting" ? "Meeting title (optional)" : `${entry.entryType} title`}<Input required={entry.entryType !== "Meeting"} value={editDraft.title} onChange={e => setEditDraft({ ...editDraft, title: e.target.value })} maxLength={240} /></label>}
      <label className="block space-y-1 text-xs font-medium">{entry.entryType === "Note" ? "Note" : "Description"}<Textarea required={entry.entryType === "Note"} rows={3} value={editDraft.description} onChange={e => setEditDraft({ ...editDraft, description: e.target.value })} maxLength={20000} /></label>
      <PhaseAssigneeFields draft={editDraft} setDraft={setEditDraft} phases={phases} assignees={assignees} />
      {entry.entryType === "Task" && <div className="grid gap-3 sm:grid-cols-3"><label className="space-y-1 text-xs font-medium">Priority<select className={fieldClass} value={editDraft.priority} onChange={e => setEditDraft({ ...editDraft, priority: e.target.value })}>{TASK_PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></label><label className="space-y-1 text-xs font-medium">Status<select className={fieldClass} value={editDraft.status} onChange={e => setEditDraft({ ...editDraft, status: e.target.value })}>{TASK_STATUSES.map(s => <option key={s}>{s}</option>)}</select></label><label className="space-y-1 text-xs font-medium">Due date<WorkDateField label="Due date" value={editDraft.dueDate} disabled={editPending} onChange={dueDate => setEditDraft({ ...editDraft, dueDate })} /></label></div>}
      {entry.entryType === "Reminder" && <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-xs font-medium">Status<select className={fieldClass} value={editDraft.status} onChange={e => setEditDraft({ ...editDraft, status: e.target.value })}><option>To do</option><option>Done</option></select></label><label className="space-y-1 text-xs font-medium">Due date<WorkDateField label="Due date" value={editDraft.dueDate} disabled={editPending} onChange={dueDate => setEditDraft({ ...editDraft, dueDate })} /></label></div>}
      {entry.entryType === "Meeting" && <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-xs font-medium">Meeting date<WorkDateField label="Meeting date" value={editDraft.meetingDate} disabled={editPending} onChange={meetingDate => setEditDraft({ ...editDraft, meetingDate, meetingTime: meetingDate ? editDraft.meetingTime : "" })} /></label><label className="space-y-1 text-xs font-medium">Meeting time<input aria-label="Meeting time" className={`${fieldClass} [color-scheme:light] dark:[color-scheme:dark]`} type="time" value={editDraft.meetingTime} onChange={e => setEditDraft({ ...editDraft, meetingTime: e.target.value })} /></label></div>}
      {editError && <div role="alert" className="rounded border border-destructive/30 p-3 text-sm">{editError}<p className="mt-1">Reloading replaces this draft. Copy any text you want to keep first.</p><div className="mt-2"><Button type="button" size="sm" variant="outline" disabled={editPending} onClick={onReload}>Reload latest</Button></div></div>}
      {confirmDiscard && <div className="rounded border border-amber-600/30 bg-amber-500/5 p-3 text-sm"><p>Discard your unsaved work?</p><div className="mt-2 flex justify-end gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setConfirmDiscard(false)}>Keep editing</Button><Button type="button" size="sm" variant="destructive" onClick={onDiscard}>Discard</Button></div></div>}
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" size="sm" variant="ghost" disabled={editPending} onClick={onCancelEdit}>Cancel</Button><Button size="sm" disabled={!editDirty || !entryHasContent(editDraft) || editPending}>{editPending ? "Saving…" : "Save changes"}</Button></div>
      </fieldset>
    </form>}
    {notesOpen && <section id={`entry-discussion-${entry.id}`} className="ml-10 mt-4 space-y-3 border-l-2 border-primary/15 pl-3 sm:pl-4" aria-label="Entry discussion">
      <div className="flex items-center justify-between"><h4 className="text-xs font-semibold">Discussion</h4><Button size="sm" variant="ghost" className="h-7 text-xs" disabled={editPending} onClick={onCloseDiscussion}>Close</Button></div>
      {notesError && <p role="alert" className="text-xs text-destructive">{notesError} <Button size="sm" variant="outline" onClick={() => void getNotes()}>Retry</Button></p>}
      {notesLoading ? <><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></> : notes?.length ? <div className="space-y-2">{notes.map(note => <article key={note.id} className="rounded-md bg-muted/45 p-3"><div className="flex flex-wrap justify-between gap-2 text-[11px]"><span className="font-medium">{note.authorName}</span><time>{new Date(note.createdAt).toLocaleString()}</time></div><p className="mt-1 whitespace-pre-wrap text-sm">{note.content}</p></article>)}</div> : !notesError && <p className="text-xs text-muted-foreground">No discussion yet.</p>}
      <form onSubmit={e => { e.preventDefault(); void onPostDiscussion().then(getNotes); }} className="space-y-2"><Textarea aria-label="Write discussion reply" disabled={editPending} value={discussion} onChange={e => setDiscussion(e.target.value)} rows={2} maxLength={20000} placeholder="Add a dated, attributed reply…" /><div className="flex items-center justify-between"><p role="alert" className="text-xs text-destructive">{discussionError}</p><Button size="sm" disabled={!discussion.trim() || editPending}>Post reply</Button></div></form>
    </section>}
    {confirmDiscard && !editing && notesOpen && <div className="ml-10 mt-3 rounded border border-amber-600/30 bg-amber-500/5 p-3 text-sm"><p>Discard your unsaved work?</p><div className="mt-2 flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setConfirmDiscard(false)}>Keep writing</Button><Button size="sm" variant="destructive" onClick={onDiscard}>Discard</Button></div></div>}
  </article>;
}
