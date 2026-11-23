import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, ArrowDown, ArrowUp, Archive, ArchiveRestore, Plus, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyOrDash } from "@/lib/utils";
import type { LeadWithCompanies } from "@shared/schema";
import { PHASE_TYPES, CONSULTANTS } from "@shared/schema";
import { ScopeChoice } from "./scope-choice";
import type { FeeInput, WorkPhase, ProjectWork } from "@shared/project-work";

const workKey = (id: number) => ["/api/leads", id, "work"];
const leadKey = (id: number) => ["/api/leads", id];
const field = "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm";
type DraftPhase = { version: number; name: string; timeline: string; feeLines: FeeInput[] };
type NewPhaseDraft = Omit<DraftPhase, "version">;
const blankPhase: NewPhaseDraft = { name: "", timeline: "", feeLines: [] };
const statusIsConflict = (error: unknown) => (error as { status?: number } | null)?.status === 409;

export function PhaseTimelineEditor({
  leadId, generalTimeline, version, phases, work, workLoading = false, workError = false,
  disabled = false, onRetryWork, onDirtyChange,
}: {
  leadId: number;
  generalTimeline: string;
  version: number;
  phases: WorkPhase[];
  work?: ProjectWork;
  workLoading?: boolean;
  workError?: boolean;
  disabled?: boolean;
  onRetryWork?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [timeline, setTimeline] = useState(generalTimeline);
  const [timelineBase, setTimelineBase] = useState({ value: generalTimeline, version });
  const [newPhase, setNewPhase] = useState<NewPhaseDraft>(blankPhase);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Record<string, DraftPhase>>({});
  const [notice, setNotice] = useState("");
  const [reconcileChoice, setReconcileChoice] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const [reloadError, setReloadError] = useState("");
  const timelineDirty = timeline !== timelineBase.value;
  const sorted = [...phases].sort((a, b) => a.sortOrder - b.sortOrder);
  const hasPhaseDraft = adding || Object.keys(editing).length > 0;
  const hasDraft = timelineDirty || hasPhaseDraft || !!newPhase.name || !!newPhase.timeline || newPhase.feeLines.length > 0;
  const dirtyCallback = useRef(onDirtyChange);
  dirtyCallback.current = onDirtyChange;
  useEffect(() => { dirtyCallback.current?.(hasDraft); }, [hasDraft]);

  const saveTimeline = useMutation({
    mutationFn: (input: { version: number; value: string }) => apiRequest<LeadWithCompanies>("PATCH", `/api/leads/${leadId}/setup`, {
      version: input.version, generalTimeline: input.value.trim() || null,
    }),
    onSuccess: result => {
      queryClient.setQueryData(leadKey(leadId), result);
      const value = result.generalTimeline ?? "";
      setTimeline(value);
      setTimelineBase({ value, version: result.setupVersion });
      setNotice("");
      setReloadError("");
    },
    onError: error => setNotice(error instanceof Error ? error.message : "Could not save the project timeline. Your draft is preserved."),
  });
  useEffect(() => {
    if (timelineDirty || saveTimeline.isPending || reloading) return;
    setTimeline(generalTimeline);
    setTimelineBase({ value: generalTimeline, version });
  }, [generalTimeline, version, timelineDirty, saveTimeline.isPending, reloading]);

  const phaseCreate = useMutation({
    mutationFn: (draft: NewPhaseDraft) => apiRequest<WorkPhase>("POST", `/api/leads/${leadId}/work/phases`, {
      name: draft.name.trim(), timeline: draft.timeline.trim() || null, feeLines: draft.feeLines,
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: workKey(leadId) }),
        queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "proposals"] }),
      ]);
      setNewPhase(blankPhase);
      setAdding(false);
      setNotice("");
    },
    onError: error => setNotice(error instanceof Error ? error.message : "Could not create phase. Your draft is preserved."),
  });
  const phasePatch = useMutation({
    mutationFn: (input: { phaseId: string; version: number; body: Record<string, unknown> }) =>
      apiRequest<WorkPhase>("PATCH", `/api/leads/${leadId}/work/phases/${input.phaseId}`, { ...input.body, version: input.version }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: workKey(leadId) }),
        queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "proposals"] }),
      ]);
      setNotice("");
    },
    onError: error => setNotice(error instanceof Error ? error.message : "Could not save phase changes. Your draft is preserved."),
  });
  const reorder = useMutation({
    mutationFn: (items: WorkPhase[]) => apiRequest("POST", `/api/leads/${leadId}/work/phases/reorder`, { phases: items.map(phase => ({ id: phase.id, version: phase.version })) }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: workKey(leadId) }); setNotice(""); },
    onError: error => setNotice(error instanceof Error ? error.message : "Could not reorder phases."),
  });
  const reconcile = useMutation({
    mutationFn: (proposalId: string | null) => apiRequest("POST", `/api/leads/${leadId}/work/reconcile`, { proposalId }),
    onSuccess: async () => {
      setReconcileChoice(null);
      setNotice("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: workKey(leadId) }),
        queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "proposals"] }),
      ]);
    },
    onError: error => setNotice(error instanceof Error ? error.message : "Could not reconcile the existing scope."),
  });

  const isPhaseMutationPending = phaseCreate.isPending || phasePatch.isPending || reorder.isPending || reconcile.isPending;
  const locked = disabled || reloading || saveTimeline.isPending || isPhaseMutationPending;
  const hasConflict = statusIsConflict(saveTimeline.error) || statusIsConflict(phasePatch.error) || statusIsConflict(reorder.error);
  const feeTotal = (phase: WorkPhase) => phase.feeLines.reduce((sum, row) => sum + (row.feeType === "Fixed" ? Number(row.amount) || 0 : 0), 0);
  const addFee = (value: NewPhaseDraft, setter: (draft: NewPhaseDraft) => void) =>
    setter({ ...value, feeLines: [...value.feeLines, { consultant: "", feeType: "Fixed", amount: null }] });

  const move = (phase: WorkPhase, direction: -1 | 1) => {
    const index = sorted.findIndex(item => item.id === phase.id);
    const neighbor = sorted[index + direction];
    if (!neighbor || locked || hasPhaseDraft || isPhaseMutationPending) return;
    const next = [...sorted];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    reorder.mutate(next);
  };

  const reloadLatest = async () => {
    setReloading(true);
    setReloadError("");
    try {
      const [latestLead, latestWork] = await Promise.all([
        queryClient.fetchQuery<LeadWithCompanies>({ queryKey: leadKey(leadId), staleTime: 0 }),
        queryClient.fetchQuery<ProjectWork>({ queryKey: workKey(leadId), staleTime: 0 }),
      ]);
      const latestTimeline = latestLead.generalTimeline ?? "";
      setTimeline(latestTimeline);
      setTimelineBase({ value: latestTimeline, version: latestLead.setupVersion });
      setNewPhase(blankPhase);
      setAdding(false);
      setEditing({});
      setReconcileChoice(null);
      setNotice("");
      setReloadError("");
      saveTimeline.reset();
      phasePatch.reset();
      reorder.reset();
      reconcile.reset();
      // Ensure the rendered phase list reflects exactly the versions just fetched.
      queryClient.setQueryData(workKey(leadId), latestWork);
    } catch (error) {
      setReloadError(error instanceof Error ? error.message : "Could not load the latest project scope. Your draft is preserved.");
    } finally {
      setReloading(false);
    }
  };

  const cancelTimeline = () => {
    setTimeline(timelineBase.value);
  };

  return <section aria-labelledby={`phase-heading-${leadId}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-primary">Scope</p><h2 id={`phase-heading-${leadId}`} className="mt-1 text-lg font-semibold">Phases, fees & timeline</h2><p className="mt-1 text-sm text-muted-foreground">Keep this scope in one place for project work and proposals.</p></div>
      <Button variant="outline" size="sm" onClick={() => setAdding(true)} disabled={locked || adding || hasPhaseDraft || isPhaseMutationPending || workLoading || workError}><Plus className="mr-1.5 h-4 w-4" />Add phase</Button>
    </div>
    {workLoading && <div className="mt-4 space-y-2" aria-label="Loading phases"><Skeleton className="h-16 w-full rounded-lg" /><Skeleton className="h-16 w-full rounded-lg" /></div>}
    {workError && <div role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4"><p className="text-sm font-medium">Project phases could not load.</p><p className="mt-1 text-xs text-muted-foreground">Your existing scope is still saved. Retry before making phase changes.</p><Button className="mt-3" size="sm" variant="outline" disabled={locked} onClick={onRetryWork}>Retry</Button></div>}
    {work?.needsReconciliation && <section className="mt-4 rounded-lg border border-amber-500/40 bg-amber-50/60 p-4 dark:bg-amber-950/20"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div className="min-w-0 flex-1"><h3 className="font-semibold">Choose the existing proposal scope</h3><p className="mt-1 text-sm text-muted-foreground">Older proposals contain different phase and fee inputs. Select one source to establish the shared project structure, or intentionally start empty.</p><div className="mt-4 grid gap-3 md:grid-cols-2">{work.legacySources.map(source => <button key={source.id} type="button" disabled={locked || reconcile.isPending} onClick={() => setReconcileChoice(source.id)} className={`rounded-md border bg-background p-3 text-left disabled:cursor-not-allowed disabled:opacity-60 ${reconcileChoice === source.id ? "border-primary ring-1 ring-primary" : ""}`}><span className="flex items-center justify-between gap-3 font-medium">{source.name}<span className="text-xs text-muted-foreground">{source.status}</span></span><div className="mt-2 space-y-1">{source.phases.map((phase, index) => <div key={`${phase.name}-${index}`} className="flex justify-between gap-3 text-xs text-muted-foreground"><span>{phase.name}</span><span>{formatCurrencyOrDash(phase.total)}</span></div>)}</div></button>)}</div><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" disabled={locked || !reconcileChoice || reconcile.isPending} onClick={() => reconcile.mutate(reconcileChoice)}>{reconcile.isPending ? "Applying…" : "Use selected source"}</Button><Button size="sm" variant="outline" disabled={locked || reconcile.isPending} onClick={() => reconcile.mutate(null)}>Start with an empty project</Button></div></div></div></section>}
    <div className="mt-4 rounded-lg border bg-background p-3 sm:p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[220px] flex-1 space-y-1.5 text-xs font-medium">General project timeline <Input disabled={locked || saveTimeline.isPending} maxLength={500} value={timeline} onChange={event => setTimeline(event.target.value)} placeholder="For example, 5 weeks or 8–10 weeks" /></label>
        <span className="pb-2 text-[11px] text-muted-foreground">{timeline.length}/500</span>
        {timelineDirty && <div className="flex gap-2 pb-0.5"><Button variant="ghost" size="sm" disabled={locked || saveTimeline.isPending} onClick={cancelTimeline}>Cancel</Button><Button size="sm" disabled={locked || saveTimeline.isPending} onClick={() => saveTimeline.mutate({ version: timelineBase.version, value: timeline })}>{saveTimeline.isPending ? "Saving…" : "Save timeline"}</Button></div>}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Use a plain-language estimate. No dates are assumed.</p>
    </div>
    {notice && <p role="alert" className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{notice}</p>}
    {hasConflict && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/30 bg-amber-50/50 p-3 text-xs dark:bg-amber-950/20"><span className="mr-auto">The project scope changed elsewhere. Your draft is preserved.</span><Button size="sm" variant="outline" disabled={locked || isPhaseMutationPending || saveTimeline.isPending} onClick={() => void reloadLatest()}>{reloading ? "Loading…" : "Reload latest"}</Button><Button size="sm" variant="ghost" disabled={locked || isPhaseMutationPending || saveTimeline.isPending} onClick={() => void reloadLatest()}>Discard draft & reload</Button></div>}
    {reloadError && <p role="alert" className="mt-2 text-xs text-destructive">{reloadError}</p>}
    {adding && <div className="mt-3 rounded-lg border border-primary/25 bg-primary/[.025] p-3 sm:p-4">
      <h3 className="text-sm font-semibold">New phase</h3>
      <fieldset disabled={locked || phaseCreate.isPending} className="m-0 min-w-0 border-0 p-0">
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 text-xs font-medium"><span>Phase name</span><ScopeChoice autoFocus label="Phase name" options={PHASE_TYPES} value={newPhase.name} onChange={name => setNewPhase({ ...newPhase, name })} placeholder="Select a phase" /></div>
          <label className="space-y-1 text-xs font-medium">Estimated timeline<Input maxLength={200} value={newPhase.timeline} onChange={event => setNewPhase({ ...newPhase, timeline: event.target.value })} placeholder="5 weeks or 8–10 weeks" /></label>
          <div className="sm:col-span-2">
            <div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium">Fee lines <span className="font-normal text-muted-foreground">optional</span></span><Button variant="outline" size="sm" disabled={locked || phaseCreate.isPending} onClick={() => addFee(newPhase, setNewPhase)}><Plus className="mr-1 h-3.5 w-3.5" />Fee line</Button></div>
            <FeeRows lines={newPhase.feeLines} onChange={feeLines => setNewPhase({ ...newPhase, feeLines })} disabled={locked || phaseCreate.isPending} />
          </div>
        </div>
      </fieldset>
      <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" size="sm" disabled={locked || phaseCreate.isPending} onClick={() => { if ((newPhase.name || newPhase.timeline || newPhase.feeLines.length) && !window.confirm("Discard this phase draft?")) return; setNewPhase(blankPhase); setAdding(false); }}>Cancel</Button><Button size="sm" disabled={locked || !newPhase.name.trim() || newPhase.feeLines.some(line => !line.consultant.trim()) || phaseCreate.isPending} onClick={() => phaseCreate.mutate(newPhase)}>{phaseCreate.isPending ? "Saving…" : "Create phase"}</Button></div>
    </div>}
    {!workLoading && !workError && sorted.length === 0 && !adding ? <div className="mt-3 rounded-lg border border-dashed px-4 py-7 text-center"><p className="text-sm font-medium">No phases defined</p><p className="mt-1 text-xs text-muted-foreground">Start with a clear stage of work. You can add fees and a flexible timeline whenever they are known.</p></div> :
      <div className="mt-3 space-y-2">{sorted.map((phase, index) => {
        const draft = editing[phase.id];
        return <article key={phase.id} className={`rounded-lg border bg-background p-3 sm:p-4 ${phase.archived ? "opacity-70" : ""}`}>
          {draft ? <div>
            <fieldset disabled={locked || phasePatch.isPending} className="m-0 min-w-0 border-0 p-0">
              <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1 text-xs font-medium"><span>Phase name</span><ScopeChoice label="Phase name" options={PHASE_TYPES} value={draft.name} onChange={name => setEditing(current => ({ ...current, [phase.id]: { ...draft, name } }))} placeholder="Select a phase" /></div><label className="space-y-1 text-xs font-medium">Timeline<Input maxLength={200} value={draft.timeline} onChange={event => setEditing(current => ({ ...current, [phase.id]: { ...draft, timeline: event.target.value } }))} /></label>
                <div className="sm:col-span-2"><div className="mb-2 flex justify-between"><span className="text-xs font-medium">Fee lines</span><Button variant="outline" size="sm" disabled={locked || phasePatch.isPending} onClick={() => setEditing(current => ({ ...current, [phase.id]: { ...draft, feeLines: [...draft.feeLines, { consultant: "", feeType: "Fixed", amount: null }] } }))}><Plus className="mr-1 h-3.5 w-3.5" />Fee line</Button></div><FeeRows lines={draft.feeLines} onChange={feeLines => setEditing(current => ({ ...current, [phase.id]: { ...draft, feeLines } }))} disabled={locked || phasePatch.isPending} /></div>
              </div>
            </fieldset>
            <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" size="sm" disabled={locked || phasePatch.isPending} onClick={() => setEditing(current => { const next = { ...current }; delete next[phase.id]; return next; })}>Cancel</Button><Button size="sm" disabled={locked || !draft.name.trim() || draft.feeLines.some(line => !line.consultant.trim()) || phasePatch.isPending} onClick={() => phasePatch.mutate({ phaseId: phase.id, version: draft.version, body: { name: draft.name.trim(), timeline: draft.timeline.trim() || null, feeLines: draft.feeLines } }, { onSuccess: () => setEditing(current => { const next = { ...current }; delete next[phase.id]; return next; }) })}>{phasePatch.isPending ? "Saving…" : "Save phase"}</Button></div>
          </div> : <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{phase.name}</h3>{phase.archived && <Badge variant="secondary">Archived</Badge>}{phase.timeline && <span className="text-xs text-muted-foreground">{phase.timeline}</span>}</div>
              {phase.feeLines.length > 0 && <div className="mt-2 space-y-1">{phase.feeLines.map((line, i) => <div key={line.id || i} className="flex flex-wrap justify-between gap-x-4 text-xs text-muted-foreground"><span>{line.consultant} · {line.feeType}</span><span>{line.feeType === "Hourly" ? line.amount ? `Reference amount ${formatCurrencyOrDash(line.amount)}` : "No reference amount" : line.amount ? formatCurrencyOrDash(line.amount) : "Unpriced"}</span></div>)}{feeTotal(phase) > 0 && <p className="pt-1 text-xs font-medium text-foreground">Fixed fee subtotal {formatCurrencyOrDash(feeTotal(phase).toFixed(2))}</p>}</div>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Move ${phase.name} up`} disabled={locked || index === 0 || hasPhaseDraft || isPhaseMutationPending} onClick={() => move(phase, -1)}><ArrowUp className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Move ${phase.name} down`} disabled={locked || index === sorted.length - 1 || hasPhaseDraft || isPhaseMutationPending} onClick={() => move(phase, 1)}><ArrowDown className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" disabled={locked || hasPhaseDraft || isPhaseMutationPending} onClick={() => setEditing({ [phase.id]: { version: phase.version, name: phase.name, timeline: phase.timeline ?? "", feeLines: phase.feeLines.map(({ consultant, feeType, amount }) => ({ consultant, feeType, amount })) } })}>Edit</Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={phase.archived ? `Restore ${phase.name}` : `Archive ${phase.name}`} disabled={locked || hasPhaseDraft || isPhaseMutationPending} onClick={() => phasePatch.mutate({ phaseId: phase.id, version: phase.version, body: { archived: !phase.archived } })}>{phase.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</Button>
            </div>
          </div>}
        </article>;
      })}</div>}
  </section>;
}

function FeeRows({ lines, onChange, disabled = false }: { lines: FeeInput[]; onChange: (lines: FeeInput[]) => void; disabled?: boolean }) {
  if (!lines.length) return <p className="rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground">No fee lines. Fees are optional.</p>;
  return <div className="space-y-2">{lines.map((line, index) => <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_130px_36px]">
    <ScopeChoice disabled={disabled} label={`Consultant or service ${index + 1}`} options={CONSULTANTS} value={line.consultant} onChange={consultant => onChange(lines.map((item, i) => i === index ? { ...item, consultant } : item))} placeholder="Select consultant or service" />
    <select disabled={disabled} aria-label={`Fee type ${index + 1}`} className={field} value={line.feeType} onChange={event => onChange(lines.map((item, i) => i === index ? { ...item, feeType: event.target.value as FeeInput["feeType"] } : item))}><option>Fixed</option><option>Hourly</option></select>
    <Input disabled={disabled} aria-label={`${line.feeType === "Hourly" ? "Reference amount" : "Fee amount"} ${index + 1}`} type="number" min="0" step="0.01" value={line.amount ?? ""} onChange={event => onChange(lines.map((item, i) => i === index ? { ...item, amount: event.target.value || null } : item))} placeholder={line.feeType === "Hourly" ? "Reference amount" : "Amount"} />
    <Button disabled={disabled} variant="ghost" size="icon" aria-label={`Remove fee line ${index + 1}`} onClick={() => onChange(lines.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
  </div>)}</div>;
}
