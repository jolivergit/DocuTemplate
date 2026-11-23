import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronRight, MessageSquare, Plus, RotateCcw, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useWorkspace } from "@/lib/workspace";
import { useToast } from "@/hooks/use-toast";
import { formatCurrencyOrDash } from "@/lib/utils";
import { TASK_PRIORITIES, TASK_STATUSES, isTaskOverdue, type ProjectWork, type WorkTask, type WorkPhase, type TaskNote, type TaskInput, type FeeInput } from "@shared/project-work";

const workKey = (id: number) => ["/api/leads", id, "work"];
type Filters = { assignee: string; status: string; priority: string; search: string; archived: boolean; sort: "due" | "priority" };
const blankFilters: Filters = { assignee: "all", status: "all", priority: "all", search: "", archived: false, sort: "due" };
const fieldClass = "h-9 w-auto max-w-full rounded-md border border-input bg-background px-3 text-sm";

function moneyTotal(phase: WorkPhase) {
  return phase.feeLines.reduce((sum, line) => sum + (line.feeType === "Fixed" && line.amount ? Number(line.amount) || 0 : 0), 0);
}
function dateLabel(value: string | null) {
  if (!value) return "No due date";
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function priorityRank(value: string) { return ["Urgent", "High", "Normal", "Low"].indexOf(value); }
function friendlyError(error: unknown) { return error instanceof Error ? error.message : "Something went wrong. Your changes are still here."; }

export function ProjectWorkWorkspace({ leadId }: { leadId: number }) {
  const { userId } = useWorkspace();
  const { toast } = useToast();
  const [filters, setFilters] = useState<Filters>(blankFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [taskDirty, setTaskDirty] = useState(false);
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [addTask, setAddTask] = useState(false);
  const [addPhase, setAddPhase] = useState(false);
  const [phaseDraft, setPhaseDraft] = useState({ name: "", timeline: "", consultant: "", feeType: "Fixed", amount: "" });
  const [taskDraft, setTaskDraft] = useState<TaskInput>({ title: "", description: "", phaseId: null, assigneeId: null, priority: "Normal", status: "To do", dueDate: null });
  const [reconcileChoice, setReconcileChoice] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const { data, isLoading, isError, refetch } = useQuery<ProjectWork>({ queryKey: workKey(leadId) });
  const phases = data?.phases ?? [];
  const tasks = data?.tasks ?? [];
  const todayTasks = tasks.filter(task => !task.archived);
  const summary = {
    open: todayTasks.filter(task => task.status !== "Done").length,
    blocked: todayTasks.filter(task => task.status === "Blocked").length,
    overdue: todayTasks.filter(task => isTaskOverdue(task)).length,
    done: todayTasks.filter(task => task.status === "Done").length,
  };
  const selectedTask = tasks.find(task => task.id === selectedId) ?? null;
  const assigneeOptions = useMemo(() => data?.assignees ?? [], [data?.assignees]);
  const phaseName = (id: string | null) => id ? phases.find(phase => phase.id === id)?.name ?? "Archived phase" : "General";
  const visibleTasks = useMemo(() => {
    const q = filters.search.trim().toLocaleLowerCase();
    return tasks.filter(task => {
      if (task.archived !== filters.archived) return false;
      if (filters.assignee === "unassigned" && task.assigneeId) return false;
      if (filters.assignee === "me" && task.assigneeId !== userId) return false;
      if (filters.assignee !== "all" && filters.assignee !== "unassigned" && filters.assignee !== "me" && task.assigneeId !== filters.assignee) return false;
      if (filters.status !== "all" && task.status !== filters.status) return false;
      if (filters.priority !== "all" && task.priority !== filters.priority) return false;
      return !q || task.title.toLocaleLowerCase().includes(q);
    }).sort((a, b) => {
      if (filters.sort === "priority") return priorityRank(a.priority) - priorityRank(b.priority);
      if (!a.dueDate) return b.dueDate ? 1 : a.title.localeCompare(b.title);
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [tasks, filters, userId]);
  const groups = useMemo(() => {
    const sortedPhases = [...phases].sort((a, b) => a.sortOrder - b.sortOrder);
    const groups = sortedPhases.map(phase => ({ id: phase.id, name: phase.name, items: visibleTasks.filter(task => task.phaseId === phase.id) }));
    groups.push({ id: "general", name: "General", items: visibleTasks.filter(task => !task.phaseId) });
    return groups.filter(group => group.items.length > 0 || !filters.search && !filters.archived);
  }, [phases, visibleTasks, filters.search, filters.archived]);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: workKey(leadId) });
  const taskCreate = useMutation({
    mutationFn: (body: TaskInput) => apiRequest<WorkTask>("POST", `/api/leads/${leadId}/work/tasks`, body),
    onSuccess: task => { void invalidate(); setTaskDraft({ title: "", description: "", phaseId: null, assigneeId: null, priority: "Normal", status: "To do", dueDate: null }); setAddTask(false); setSelectedId(task.id); },
    onError: error => setNotice(friendlyError(error)),
  });
  const phaseCreate = useMutation({
    mutationFn: () => apiRequest<WorkPhase>("POST", `/api/leads/${leadId}/work/phases`, {
      name: phaseDraft.name, timeline: phaseDraft.timeline.trim() || null,
      feeLines: phaseDraft.consultant.trim() ? [{ consultant: phaseDraft.consultant.trim(), feeType: phaseDraft.feeType, amount: phaseDraft.amount.trim() || null }] : [],
    }),
    onSuccess: () => { void invalidate(); void queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "proposals"] }); setPhaseDraft({ name: "", timeline: "", consultant: "", feeType: "Fixed", amount: "" }); setAddPhase(false); },
    onError: error => setNotice(friendlyError(error)),
  });
  const phasePatch = useMutation({
    mutationFn: ({ phase, body, version }: { phase: WorkPhase; body: Record<string, unknown>; version?: number }) => apiRequest("PATCH", `/api/leads/${leadId}/work/phases/${phase.id}`, { ...body, version: version ?? phase.version }),
    onSuccess: () => { void invalidate(); void queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "proposals"] }); },
    onError: error => setNotice(friendlyError(error)),
  });
  const phaseReorder = useMutation({
    mutationFn: (ordered: WorkPhase[]) => apiRequest("POST", `/api/leads/${leadId}/work/phases/reorder`, { phases: ordered.map(phase => ({ id: phase.id, version: phase.version })) }),
    onSuccess: () => { void invalidate(); void queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "proposals"] }); },
    onError: error => setNotice(friendlyError(error)),
  });
  const movePhase = (phase: WorkPhase, direction: -1 | 1) => {
    if (editingPhaseId || phaseReorder.isPending || phasePatch.isPending) return;
    const ordered = [...phases].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = ordered.findIndex(item => item.id === phase.id);
    const neighbor = ordered[index + direction];
    if (!neighbor) return;
    const next = ordered.slice();
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    phaseReorder.mutate(next);
  };
  const reconcile = useMutation({
    mutationFn: (proposalId: string | null) => apiRequest("POST", `/api/leads/${leadId}/work/reconcile`, { proposalId }),
    onSuccess: () => { setReconcileChoice(null); void invalidate(); },
    onError: error => setNotice(friendlyError(error)),
  });
  const taskPatch = useMutation({
    mutationFn: ({ task, body }: { task: WorkTask; body: Record<string, unknown> }) => apiRequest("PATCH", `/api/leads/${leadId}/work/tasks/${task.id}`, { ...body, version: task.version }),
    onSuccess: () => { setNotice(""); return invalidate(); },
    onError: error => {
      if ((error as { status?: number })?.status === 409) setNotice("This task changed elsewhere. Your draft is preserved. Reload the latest version before retrying.");
      else setNotice(friendlyError(error));
    },
  });
  const patchTask = async (task: WorkTask, body: Record<string, unknown>) => {
    try {
      await taskPatch.mutateAsync({ task, body });
      return true;
    } catch { return false; }
  };
  const openNewTask = () => {
    if (addTask || taskCreate.isPending) return;
    setTaskDraft({ title: "", description: "", phaseId: null, assigneeId: null, priority: "Normal", status: "To do", dueDate: null });
    setAddTask(true);
  };
  const isNewPhaseDirty = !!phaseDraft.name.trim() || !!phaseDraft.timeline.trim() || !!phaseDraft.consultant.trim() || !!phaseDraft.amount.trim();
  const togglePhaseForm = () => {
    if (!addPhase) { setAddPhase(true); return; }
    if (isNewPhaseDirty && !window.confirm("Discard this phase draft?")) return;
    setPhaseDraft({ name: "", timeline: "", consultant: "", feeType: "Fixed", amount: "" });
    setAddPhase(false);
  };

  if (isLoading) return <section className="space-y-4" aria-label="Project work loading"><Skeleton className="h-24 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-56 w-full" /></section>;
  if (isError || !data) return <section className="rounded-lg border border-destructive/30 bg-card p-6" role="alert"><h2 className="font-semibold">Project work could not load</h2><p className="mt-1 text-sm text-muted-foreground">Your project is still available. Try loading tasks and phases again.</p><Button className="mt-4" variant="outline" onClick={() => void refetch()}>Retry</Button></section>;

  return <div className="space-y-7">
    {notice && notice !== "unsaved-task" && <div role="alert" className="flex items-start justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"><span>{notice}</span><Button size="icon" variant="ghost" aria-label="Dismiss error" onClick={() => setNotice("")}><X className="h-4 w-4" /></Button></div>}
    {data.needsReconciliation && <section className="rounded-lg border border-amber-500/40 bg-amber-50/60 p-4 dark:bg-amber-950/20"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div className="min-w-0 flex-1"><h2 className="font-semibold">Choose the existing project scope</h2><p className="mt-1 text-sm text-muted-foreground">Older proposals contain different phase and fee inputs. Select one source to establish the shared project structure, or intentionally start empty.</p><div className="mt-4 grid gap-3 md:grid-cols-2">{data.legacySources.map(source => <button key={source.id} type="button" onClick={() => setReconcileChoice(source.id)} className={`rounded-md border bg-background p-3 text-left ${reconcileChoice === source.id ? "border-primary ring-1 ring-primary" : ""}`}><span className="flex items-center justify-between font-medium">{source.name}<span className="text-xs text-muted-foreground">{source.status}</span></span><div className="mt-2 space-y-1">{source.phases.map((phase, i) => <div key={`${phase.name}-${i}`} className="flex justify-between gap-3 text-xs text-muted-foreground"><span>{phase.name}</span><span>{formatCurrencyOrDash(phase.total)}</span></div>)}</div></button>)}</div><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" disabled={!reconcileChoice || reconcile.isPending} onClick={() => reconcile.mutate(reconcileChoice)}>{reconcile.isPending ? "Applying…" : "Use selected source"}</Button><Button size="sm" variant="outline" disabled={reconcile.isPending} onClick={() => reconcile.mutate(null)}>Start with an empty project</Button></div></div></div></section>}
    <section aria-label="Task summary" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
      {[["Open", summary.open, "work remains"], ["Blocked", summary.blocked, "needs attention"], ["Overdue", summary.overdue, "past due"], ["Done", summary.done, "completed"]].map(([label, value, detail]) => <div key={String(label)} className="bg-card px-4 py-3"><p className="text-[11px] font-medium uppercase tracking-[.12em] text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{detail}</p></div>)}
    </section>
    <section className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 sm:px-5">
        <div>
          <div className="flex items-center gap-2"><h2 className="text-lg font-semibold normal-case tracking-normal">Work in motion</h2><Badge variant="secondary">{visibleTasks.length} shown</Badge></div>
          <p className="mt-1 text-sm text-muted-foreground">A clear view of what needs doing next.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={togglePhaseForm}><Plus className="mr-1.5 h-4 w-4" />Phase</Button>
          <Button size="sm" disabled={taskCreate.isPending} onClick={openNewTask}><Plus className="mr-1.5 h-4 w-4" />New task</Button>
        </div>
      </div>
      {addTask && <form className="grid gap-3 border-b bg-muted/20 p-4 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); taskCreate.mutate(taskDraft); }}><label className="space-y-1 text-xs font-medium sm:col-span-2">Task title<Input autoFocus required maxLength={240} value={taskDraft.title} onChange={e => setTaskDraft({ ...taskDraft, title: e.target.value })} placeholder="What needs to move forward?" /></label><label className="space-y-1 text-xs font-medium">Phase<select className={`${fieldClass} w-full`} value={taskDraft.phaseId ?? ""} onChange={e => setTaskDraft({ ...taskDraft, phaseId: e.target.value || null })}><option value="">General</option>{phases.filter(p => !p.archived).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="space-y-1 text-xs font-medium">Assignee<select className={`${fieldClass} w-full`} value={taskDraft.assigneeId ?? ""} onChange={e => setTaskDraft({ ...taskDraft, assigneeId: e.target.value || null })}><option value="">Unassigned</option>{assigneeOptions.map(p => <option key={p.userId} value={p.userId}>{p.name}</option>)}</select></label><label className="space-y-1 text-xs font-medium">Priority<select className={`${fieldClass} w-full`} value={taskDraft.priority} onChange={e => setTaskDraft({ ...taskDraft, priority: e.target.value as TaskInput["priority"] })}>{TASK_PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></label><label className="space-y-1 text-xs font-medium">Due date<input className={`${fieldClass} w-full`} type="date" value={taskDraft.dueDate ?? ""} onChange={e => setTaskDraft({ ...taskDraft, dueDate: e.target.value || null })} /></label><div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" size="sm" variant="ghost" onClick={() => { const dirty = !!taskDraft.title.trim() || !!taskDraft.description.trim() || !!taskDraft.phaseId || !!taskDraft.assigneeId || taskDraft.priority !== "Normal" || taskDraft.status !== "To do" || !!taskDraft.dueDate; if (!dirty || window.confirm("Discard this new task?")) setAddTask(false); }}>Cancel</Button><Button size="sm" disabled={!taskDraft.title.trim() || taskCreate.isPending}>{taskCreate.isPending ? "Adding…" : "Add task"}</Button></div></form>}
      {addPhase && <form className="grid gap-3 border-b bg-muted/20 p-4 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); phaseCreate.mutate(); }}><label className="space-y-1 text-xs font-medium">Phase name<Input autoFocus required maxLength={200} value={phaseDraft.name} onChange={e => setPhaseDraft({ ...phaseDraft, name: e.target.value })} placeholder="e.g. Lighting design" /></label><label className="space-y-1 text-xs font-medium">Estimated timeline<Input maxLength={200} value={phaseDraft.timeline} onChange={e => setPhaseDraft({ ...phaseDraft, timeline: e.target.value })} placeholder="5 weeks or 8–10 weeks" /></label><label className="space-y-1 text-xs font-medium">Consultant fee row (optional)<Input maxLength={200} value={phaseDraft.consultant} onChange={e => setPhaseDraft({ ...phaseDraft, consultant: e.target.value })} placeholder="Consultant name" /></label><div className="grid grid-cols-2 gap-2"><label className="space-y-1 text-xs font-medium">Type<select className={`${fieldClass} w-full`} value={phaseDraft.feeType} onChange={e => setPhaseDraft({ ...phaseDraft, feeType: e.target.value })}><option>Fixed</option><option>Hourly</option></select></label><label className="space-y-1 text-xs font-medium">{phaseDraft.feeType === "Hourly" ? "Hourly rate" : "Fee amount"}<Input type="number" min="0" step="0.01" value={phaseDraft.amount} disabled={!phaseDraft.consultant.trim()} onChange={e => setPhaseDraft({ ...phaseDraft, amount: e.target.value })} placeholder="Optional" /></label></div><div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" size="sm" variant="ghost" onClick={() => { const dirty = !!phaseDraft.name.trim() || !!phaseDraft.timeline.trim() || !!phaseDraft.consultant.trim() || !!phaseDraft.amount.trim(); if (!dirty || window.confirm("Discard this phase draft?")) setAddPhase(false); }}>Cancel</Button><Button size="sm" disabled={!phaseDraft.name.trim() || phaseCreate.isPending}>{phaseCreate.isPending ? "Saving…" : "Create phase"}</Button></div></form>}
      <div className="flex flex-wrap items-center gap-2 border-b p-3"><div className="relative min-w-[180px] flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Search task titles" className="h-9 pl-8" value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} placeholder="Search tasks" /></div><select aria-label="Filter by assignee" className={fieldClass} value={filters.assignee} onChange={e => setFilters({ ...filters, assignee: e.target.value })}><option value="all">All assignees</option><option value="me">Me</option><option value="unassigned">Unassigned</option>{assigneeOptions.map(a => <option key={a.userId} value={a.userId}>{a.name}</option>)}</select><select aria-label="Filter by status" className={fieldClass} value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}><option value="all">All statuses</option>{TASK_STATUSES.map(s => <option key={s}>{s}</option>)}</select><select aria-label="Filter by priority" className={fieldClass} value={filters.priority} onChange={e => setFilters({ ...filters, priority: e.target.value })}><option value="all">All priorities</option>{TASK_PRIORITIES.map(p => <option key={p}>{p}</option>)}</select><Button variant={filters.archived ? "default" : "outline"} size="sm" onClick={() => setFilters({ ...filters, archived: !filters.archived })}>{filters.archived ? "Archived" : "Active"}</Button><Button variant="ghost" size="sm" onClick={() => setFilters({ ...filters, sort: filters.sort === "due" ? "priority" : "due" })}><SlidersHorizontal className="mr-1.5 h-4 w-4" />Sort: {filters.sort === "due" ? "Due date" : "Priority"}</Button></div>
      {groups.length === 0 || visibleTasks.length === 0 ? <div className="px-6 py-12 text-center"><div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground"><Check className="h-5 w-5" /></div><h3 className="mt-3 font-medium">{filters.archived ? "No archived tasks" : tasks.length ? "No tasks match these filters" : "A good place to begin"}</h3><p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{tasks.length ? "Adjust the filters or search a different title." : "Capture the next real piece of work. Leave it unassigned or connect it to a shared phase."}</p>{tasks.length === 0 && <Button className="mt-4" size="sm" onClick={openNewTask}>Add the first task</Button>}</div> : <div className="divide-y">{groups.map(group => <div key={group.id}><div className="flex items-center justify-between bg-muted/30 px-4 py-2.5 sm:px-5"><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary/60" /><h3 className="text-xs font-semibold uppercase tracking-[.12em]">{group.name}</h3><span className="text-xs tabular-nums text-muted-foreground">{group.items.length}</span></div>{group.id !== "general" && <span className="text-xs text-muted-foreground">{phases.find(p => p.id === group.id)?.timeline || ""}</span>}</div><div className="divide-y">{group.items.map(task => <TaskRow key={task.id} task={task} saving={taskPatch.isPending} onOpen={() => { if (taskPatch.isPending) return; if (taskDirty && !window.confirm("Discard unsaved task edits?")) return; setTaskDirty(false); setSelectedId(task.id); }} onQuickUpdate={async (field, value) => { const success = await patchTask(task, { [field]: value }); if (success) toast({ title: "Task updated" }); }} phase={phaseName(task.phaseId)} />)}</div></div>)}</div>}
      <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground"><span>{phases.filter(phase => !phase.archived).length} active phases · {tasks.length} total tasks</span><Button variant="ghost" size="sm" className="h-8" onClick={() => setAddPhase(true)}><Plus className="mr-1 h-3.5 w-3.5" />Manage phases</Button></div>
    </section>
      <section className="rounded-lg border bg-card"><div className="flex items-start justify-between gap-3 border-b px-4 py-4 sm:px-5"><div><h2 className="text-lg font-semibold normal-case tracking-normal">Shared project phases</h2><p className="mt-1 text-sm text-muted-foreground">Maintained once for project work and proposal preparation.</p></div><Button variant="outline" size="sm" onClick={togglePhaseForm}><Plus className="mr-1.5 h-4 w-4" />Add phase</Button></div>{phases.length === 0 ? <div className="px-5 py-6 text-sm text-muted-foreground">No phases yet. Tasks can stay under General, or add a phase whenever the project structure becomes clear.</div> : <div className="divide-y">{[...phases].sort((a,b) => a.sortOrder-b.sortOrder).map((phase,index,array) => <PhaseRow key={phase.id} phase={phase} position={index} count={array.length} blocked={!!editingPhaseId && editingPhaseId !== phase.id} onEditingChange={editing => setEditingPhaseId(editing ? phase.id : null)} onSave={(body, version) => phasePatch.mutateAsync({ phase, body, version }).then(() => true).catch(() => false)} onMove={direction => void movePhase(phase, direction)} saving={phasePatch.isPending || phaseReorder.isPending} />)}</div>}</section>
    <TaskDetail task={selectedTask} leadId={leadId} phases={phases} assignees={assigneeOptions} isSaving={taskPatch.isPending} onDirtyChange={setTaskDirty} onClose={() => { setNotice(""); setSelectedId(null); }} onConflictResolved={() => setNotice("")} onSave={async (task, body) => patchTask(task, body)} onUpdated={invalidate} />
  </div>;
}

function TaskRow({ task, phase, onOpen, onQuickUpdate, saving }: { task: WorkTask; phase: string; onOpen: () => void; onQuickUpdate: (field: string, value: unknown) => void; saving: boolean }) {
  const overdue = isTaskOverdue(task);
  return <div className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 xl:grid-cols-[minmax(150px,1.7fr)_minmax(80px,1fr)_minmax(100px,1fr)_90px_110px_130px] sm:px-5">
    <button type="button" onClick={onOpen} className="min-w-0 text-left"><span className={`block truncate text-sm font-medium ${task.status === "Done" ? "text-muted-foreground line-through" : ""}`}>{task.title}</span><span className={`mt-1 block truncate text-xs xl:hidden ${overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}>{phase} · {task.assigneeName || (task.assigneeId ? "Needs reassignment" : "Unassigned")} · {task.priority} · {dateLabel(task.dueDate)}</span></button>
    <span className="hidden truncate text-xs text-muted-foreground xl:block">{phase}</span>
    <span className={`hidden truncate text-xs xl:block ${task.assigneeId && !task.assigneeEligible ? "font-medium text-amber-700" : "text-muted-foreground"}`}>{task.assigneeId && !task.assigneeEligible ? "Needs reassignment" : task.assigneeName || "Unassigned"}</span>
    <select aria-label={`Priority for ${task.title}`} disabled={saving} className="hidden h-8 rounded border border-input bg-background px-2 text-xs xl:block" value={task.priority} onChange={e => onQuickUpdate("priority", e.target.value)}>{TASK_PRIORITIES.map(p => <option key={p}>{p}</option>)}</select>
    <select aria-label={`Status for ${task.title}`} disabled={saving} className="h-8 max-w-[130px] rounded border border-input bg-background px-2 text-xs" value={task.status} onChange={e => onQuickUpdate("status", e.target.value)}>{TASK_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
    <button type="button" onClick={onOpen} className={`hidden items-center justify-end gap-1.5 whitespace-nowrap text-xs tabular-nums xl:flex ${overdue ? "font-semibold text-destructive" : "text-muted-foreground"}`}><span>{dateLabel(task.dueDate)}</span>{task.noteCount > 0 && <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{task.noteCount}</span>}</button>
  </div>;
}

function PhaseRow({ phase, position, count, onSave, onMove, onEditingChange, blocked, saving }: { phase: WorkPhase; position: number; count: number; onSave: (body: Record<string, unknown>, version?: number) => Promise<boolean>; onMove: (direction: -1 | 1) => void; onEditingChange: (editing: boolean) => void; blocked: boolean; saving: boolean }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(phase.name);
  const [timeline, setTimeline] = useState(phase.timeline ?? "");
  const [feeLines, setFeeLines] = useState<FeeInput[]>([]);
  const [editVersion, setEditVersion] = useState(phase.version);
  const phaseDirty = name !== phase.name || timeline !== (phase.timeline ?? "") || JSON.stringify(feeLines) !== JSON.stringify(phase.feeLines.map(({ consultant, feeType, amount }) => ({ consultant, feeType, amount })));
  const startEdit = () => {
    setName(phase.name);
    setTimeline(phase.timeline ?? "");
    setFeeLines(phase.feeLines.map(({ consultant, feeType, amount }) => ({ consultant, feeType, amount })));
    setEditVersion(phase.version);
    setEditing(true);
    onEditingChange(true);
  };
  return <div className={`px-4 py-3 sm:px-5 ${phase.archived ? "bg-muted/25 opacity-75" : ""}`}>
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        {editing ? <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-medium">Phase name<Input value={name} onChange={e => setName(e.target.value)} maxLength={200} /></label>
          <label className="space-y-1 text-xs font-medium">Timeline<Input value={timeline} onChange={e => setTimeline(e.target.value)} maxLength={200} placeholder="Optional, e.g. 5 weeks" /></label>
          <div className="sm:col-span-2">
            <div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium">Consultant fee lines</span><Button type="button" size="sm" variant="outline" onClick={() => setFeeLines(lines => lines.concat({ consultant: "", feeType: "Fixed", amount: null }))}><Plus className="mr-1 h-3.5 w-3.5" />Add fee line</Button></div>
            {feeLines.length === 0 ? <p className="rounded border border-dashed p-3 text-xs text-muted-foreground">No fee rows. Fees are optional.</p> : <div className="space-y-2">{feeLines.map((line, index) => <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_100px_120px_36px]">
              <Input aria-label={`Consultant ${index + 1}`} value={line.consultant} onChange={e => setFeeLines(lines => lines.map((item, i) => i === index ? { ...item, consultant: e.target.value } : item))} placeholder="Consultant" maxLength={200} />
              <select aria-label={`Fee type ${index + 1}`} className={fieldClass} value={line.feeType} onChange={e => setFeeLines(lines => lines.map((item, i) => i === index ? { ...item, feeType: e.target.value as FeeInput["feeType"] } : item))}><option>Fixed</option><option>Hourly</option></select>
              <Input aria-label={`${line.feeType === "Hourly" ? "Hourly rate" : "Amount"} ${index + 1}`} type="number" min="0" step="0.01" value={line.amount ?? ""} onChange={e => setFeeLines(lines => lines.map((item, i) => i === index ? { ...item, amount: e.target.value || null } : item))} placeholder={line.feeType === "Hourly" ? "Hourly rate" : "Amount"} />
              <Button type="button" size="icon" variant="ghost" aria-label={`Remove fee line ${index + 1}`} onClick={() => setFeeLines(lines => lines.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
            </div>)}</div>}
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2"><Button size="sm" variant="ghost" disabled={saving} onClick={() => { if (!phaseDirty || window.confirm("Discard unsaved phase and fee changes?")) { setEditing(false); onEditingChange(false); } }}>Cancel</Button><Button size="sm" disabled={!name.trim() || saving || feeLines.some(line => !line.consultant.trim())} onClick={() => { void onSave({ name: name.trim(), timeline: timeline.trim() || null, feeLines }, editVersion).then(saved => { if (saved) { setEditing(false); onEditingChange(false); } }); }}>{saving ? "Saving…" : "Save phase"}</Button></div>
        </div> : <>
          <div className="flex items-center gap-2"><span className="font-medium">{phase.name}</span>{phase.archived && <Badge variant="secondary">Archived</Badge>}{phase.timeline && <span className="text-xs text-muted-foreground">{phase.timeline}</span>}</div>
          <div className="mt-1 space-y-1">{phase.feeLines.map((line, i) => <div key={line.id || i} className="flex justify-between gap-3 text-xs text-muted-foreground"><span>{line.consultant} · {line.feeType}{line.feeType === "Hourly" && line.amount ? " · reference amount" : ""}</span><span>{line.amount ? formatCurrencyOrDash(line.amount) : line.feeType === "Hourly" ? "Hourly" : "Unpriced"}</span></div>)}{phase.feeLines.length > 0 && moneyTotal(phase) > 0 && <p className="pt-1 text-xs font-medium text-foreground">Fixed fee subtotal {formatCurrencyOrDash(moneyTotal(phase).toFixed(2))}</p>}</div>
        </>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Move phase up" disabled={position === 0 || saving || editing || blocked} onClick={() => onMove(-1)}><ArrowUp className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Move phase down" disabled={position === count - 1 || saving || editing || blocked} onClick={() => onMove(1)}><ArrowDown className="h-4 w-4" /></Button>
        {!editing && <Button variant="outline" size="sm" disabled={saving || blocked} onClick={startEdit}>Edit</Button>}
        <Button variant="ghost" size="sm" disabled={saving || editing || blocked} onClick={() => void onSave({ archived: !phase.archived })}>{phase.archived ? <><RotateCcw className="mr-1 h-3.5 w-3.5" />Restore</> : "Archive"}</Button>
      </div>
    </div>
  </div>;
}

function TaskDetail({ task, leadId, phases, assignees, onClose, onSave: persistTask, onUpdated, onDirtyChange, onConflictResolved, isSaving }: { task: WorkTask | null; leadId: number; phases: WorkPhase[]; assignees: { userId: string; name: string }[]; onClose: () => void; onSave: (task: WorkTask, body: Record<string, unknown>) => Promise<boolean>; onUpdated: () => void; onDirtyChange: (dirty: boolean) => void; onConflictResolved: () => void; isSaving: boolean }) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<WorkTask | null>(null);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  useEffect(() => {
    setDraft(null);
    setNote("");
    setNoteError("");
    setSaveError("");
    setRequestId(crypto.randomUUID());
  }, [task?.id]);
  const notesQuery = useQuery<TaskNote[]>({ queryKey: ["/api/leads", leadId, "work", "tasks", task?.id, "notes"], enabled: !!task });
  const appendNote = useMutation({
    mutationFn: () => apiRequest<TaskNote>("POST", `/api/leads/${leadId}/work/tasks/${task?.id}/notes`, { content: note.trim(), requestId }),
    onSuccess: () => { setNote(""); setNoteError(""); setRequestId(crypto.randomUUID()); void queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "work", "tasks", task?.id, "notes"] }); onUpdated(); },
    onError: error => setNoteError(friendlyError(error)),
  });
  const current = draft?.id === task?.id ? draft : task;
  const dirty = !!current && !!task && ["title","description","phaseId","assigneeId","priority","status","dueDate"].some(key => current[key as keyof WorkTask] !== task[key as keyof WorkTask]);
  const unsaved = dirty || !!note.trim();
  useEffect(() => { onDirtyChange(unsaved); }, [unsaved, onDirtyChange]);
  const onSave = (taskToSave: WorkTask, body: Record<string, unknown>) => persistTask(current && task?.id === current.id ? current : taskToSave, body);
  const update = (field: keyof WorkTask, value: unknown) => setDraft(current ? { ...current, [field]: value } : null);
  const reloadLatest = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: workKey(leadId) });
      const latest = await queryClient.fetchQuery<ProjectWork>({ queryKey: workKey(leadId) });
      const loaded = latest.tasks.find(item => item.id === task?.id);
      if (!loaded) throw new Error("Task is no longer available.");
      setDraft(loaded);
      setSaveError("");
      onConflictResolved();
    } catch (error) {
      setSaveError(friendlyError(error));
    }
  };
  return (
    <Sheet open={!!task} onOpenChange={open => {
      if (!open) {
        if (isSaving || appendNote.isPending) return;
        if (unsaved && !window.confirm("Discard unsaved task edits?")) return;
        setDraft(null);
        if (note.trim()) setNote("");
        onDirtyChange(false);
        onClose();
      }
    }}>
      <SheetContent side="right" className="flex h-[100dvh] w-full flex-col overflow-hidden p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-5 py-5 pr-14 text-left">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[.12em] text-muted-foreground"><span>Task details</span><span>·</span><span>{task ? dateLabel(task.dueDate) : ""}</span></div>
          <SheetTitle className="normal-case tracking-normal">{task?.title || "Task"}</SheetTitle>
          <SheetDescription>Fields can be changed here; discussion entries are dated and attributed.</SheetDescription>
        </SheetHeader>
        {current && task && <div className="flex-1 overflow-y-auto px-5 py-5">
          <fieldset disabled={isSaving} className="contents">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-medium sm:col-span-2">Title<Input value={current.title} maxLength={240} onChange={e => update("title", e.target.value)} /></label>
              <label className="space-y-1 text-xs font-medium sm:col-span-2">Description<Textarea value={current.description} rows={4} maxLength={20000} onChange={e => update("description", e.target.value)} placeholder="Add the context someone needs to do the work." /></label>
              <label className="space-y-1 text-xs font-medium">Phase<select className={`${fieldClass} w-full`} value={current.phaseId ?? ""} onChange={e => update("phaseId", e.target.value || null)}><option value="">General</option>{phases.map(phase => <option key={phase.id} value={phase.id} disabled={phase.archived && phase.id !== current.phaseId}>{phase.name}{phase.archived ? " (archived)" : ""}</option>)}</select></label>
              <label className="space-y-1 text-xs font-medium">Assignee<select className={`${fieldClass} w-full`} value={current.assigneeId ?? ""} onChange={e => update("assigneeId", e.target.value || null)}><option value="">Unassigned</option>{current.assigneeId && !task.assigneeEligible && !assignees.some(a => a.userId === current.assigneeId) && <option value={current.assigneeId}>Needs reassignment</option>}{assignees.map(a => <option key={a.userId} value={a.userId}>{a.name}</option>)}</select>{current.assigneeId && !task.assigneeEligible && <span className="block text-amber-700">Current assignee no longer has access. Choose an eligible person to reassign.</span>}</label>
              <label className="space-y-1 text-xs font-medium">Priority<select className={`${fieldClass} w-full`} value={current.priority} onChange={e => update("priority", e.target.value)}>{TASK_PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></label>
              <label className="space-y-1 text-xs font-medium">Status<select className={`${fieldClass} w-full`} value={current.status} onChange={e => update("status", e.target.value)}>{TASK_STATUSES.map(s => <option key={s}>{s}</option>)}</select></label>
              <label className="space-y-1 text-xs font-medium">Due date<input className={`${fieldClass} w-full`} type="date" value={current.dueDate ?? ""} onChange={e => update("dueDate", e.target.value || null)} /></label>
            </div>
          </fieldset>
          {saveError && <div role="alert" className="mt-4 rounded border border-destructive/30 p-3 text-sm">
            {saveError}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={isSaving} onClick={() => void reloadLatest()}>Reload latest</Button>
              <Button size="sm" disabled={isSaving} onClick={() => void onSave(task, { title: current.title, description: current.description, phaseId: current.phaseId, assigneeId: current.assigneeId, priority: current.priority, status: current.status, dueDate: current.dueDate }).then(ok => { if (ok) { setSaveError(""); setDraft(null); } })}>Retry my save</Button>
            </div>
          </div>}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <Button variant="ghost" size="sm" disabled={isSaving || dirty} onClick={() => void onSave(task, { archived: !task.archived }).then(ok => { if (ok) toast({ title: task.archived ? "Task restored" : "Task archived" }); })}>{task.archived ? <><RotateCcw className="mr-1.5 h-4 w-4" />Restore task</> : "Archive task"}</Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={!dirty || isSaving} onClick={() => setDraft(task)}>Discard edits</Button>
              <Button size="sm" disabled={!dirty || !current.title.trim() || isSaving} onClick={() => void onSave(task, { title: current.title.trim(), description: current.description || "", phaseId: current.phaseId, assigneeId: current.assigneeId, priority: current.priority, status: current.status, dueDate: current.dueDate }).then(ok => { if (ok) { setDraft(null); setSaveError(""); toast({ title: "Task saved" }); } else setSaveError("The latest version could not be saved. Your text remains here."); })}>{isSaving ? "Saving…" : "Save task"}</Button>
            </div>
          </div>
          <section className="mt-8 border-t pt-5">
            <div className="flex items-center justify-between"><h3 className="font-semibold">Discussion</h3><span className="text-xs text-muted-foreground">{notesQuery.data?.length ?? task.noteCount} notes</span></div>
            {notesQuery.isError ? <div className="mt-3 text-sm text-muted-foreground">Discussion could not load. <Button size="sm" variant="outline" onClick={() => void notesQuery.refetch()}>Retry</Button></div> : <div className="mt-4 space-y-3">
              {(notesQuery.data ?? []).map(item => <article key={item.id} className="rounded-md bg-muted/45 p-3"><div className="flex justify-between gap-3 text-xs"><span className="font-medium">{item.authorName}</span><time className="text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</time></div><p className="mt-2 whitespace-pre-wrap text-sm">{item.content}</p></article>)}
              {notesQuery.isLoading && <><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></>}
              {!notesQuery.isLoading && !notesQuery.data?.length && <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">No discussion yet. Add the first useful detail.</p>}
            </div>}
            <form className="mt-4 space-y-2" onSubmit={event => { event.preventDefault(); appendNote.mutate(); }}>
              <Textarea value={note} disabled={appendNote.isPending} onChange={e => setNote(e.target.value)} rows={3} maxLength={20000} placeholder="Add a dated note for the project team…" aria-label="New task note" />
              {noteError && <p role="alert" className="text-xs text-destructive">{noteError} Your note is still here; retry to submit the same entry.</p>}
              <div className="flex justify-end"><Button size="sm" disabled={!note.trim() || appendNote.isPending}>{appendNote.isPending ? "Posting…" : "Add note"}</Button></div>
            </form>
          </section>
        </div>}
      </SheetContent>
    </Sheet>
  );
}
