import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Clock3, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrencyOrDash } from "@/lib/utils";
import { PROPOSAL_STATUSES, type ProposalWithPhases } from "@shared/schema";
import type { ProjectWork, WorkPhase } from "@shared/project-work";
import { scopeSaveFields } from "@shared/proposal-scope";

type ExistingPhaseMapping = ProposalWithPhases["phases"][number] & { projectPhaseId?: string | null };
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: number;
  existing?: ProposalWithPhases;
  onSaved?: () => void;
  inline?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}
const workKey = (id: number) => ["/api/leads", id, "work"];
function phaseTotal(phase: WorkPhase) {
  return phase.feeLines.reduce((sum, line) => sum + (line.feeType === "Fixed" && line.amount ? Number(line.amount) || 0 : 0), 0);
}

export function ProposalFormDialog({ open, onOpenChange, leadId, existing, onSaved, inline = false, onDirtyChange }: Props) {
  const { toast } = useToast();
  const isEdit = !!existing;
  const isIssued = !!existing && (existing.scopeLocked || !["Draft", "Revision"].includes(existing.status));
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string>("Draft");
  const [selectedPhaseIds, setSelectedPhaseIds] = useState<string[]>([]);
  const [scopeTouched, setScopeTouched] = useState(false);
  const [legacyReplacementConfirmed, setLegacyReplacementConfirmed] = useState(false);
  const hasUnmappedScope = !!existing?.phases.some(phase => !phase.projectPhaseId);
  const [formError, setFormError] = useState("");
  const initializedFor = useRef("");
  const { data: work, isLoading: workLoading, isError: workError, refetch } = useQuery<ProjectWork>({ queryKey: workKey(leadId), enabled: open });

  useEffect(() => {
    if (!open) { initializedFor.current = ""; return; }
    const key = `${existing?.id ?? "new"}`;
    if (initializedFor.current === key || (!work && !workError)) return;
    setName(existing?.name || "");
    setDescription(existing?.description || "");
    setStatus(existing?.status || "Draft");
    const mapped = (existing?.phases || []).map(phase => {
      return (phase as ExistingPhaseMapping).projectPhaseId;
    }).filter((id): id is string => !!id);
    setSelectedPhaseIds(mapped);
    setScopeTouched(false);
    setLegacyReplacementConfirmed(false);
    setFormError("");
    initializedFor.current = key;
  }, [open, existing?.id, work, workError]);

  const sortedPhases = useMemo(() => [...(work?.phases || [])].filter(phase => !phase.archived || selectedPhaseIds.includes(phase.id)).sort((a, b) => a.sortOrder - b.sortOrder), [work?.phases, selectedPhaseIds]);
  const originalPhaseIds = (existing?.phases || []).map(phase => (phase as ExistingPhaseMapping).projectPhaseId).filter((id): id is string => !!id);
  const isInitialized = initializedFor.current === `${existing?.id ?? "new"}`;
  const dirty = isInitialized && (name !== (existing?.name || "") || description !== (existing?.description || "") || status !== (existing?.status || "Draft") || !isIssued && (selectedPhaseIds.join("|") !== originalPhaseIds.join("|") || hasUnmappedScope && scopeTouched));
  const dirtyCallback = useRef(onDirtyChange);
  dirtyCallback.current = onDirtyChange;
  const saveMutation = useMutation({
    mutationKey: ["project-proposal-save", leadId],
    mutationFn: () => {
      const body = {
        name: name.trim(), description: description.trim() || null, status,
        ...scopeSaveFields({ editing: isEdit, locked: !!isIssued, selectionChanged: scopeTouched, selectedPhaseIds }),
      };
      return isEdit ? apiRequest("PATCH", `/api/proposals/${existing.id}`, body) : apiRequest("POST", `/api/leads/${leadId}/proposals`, body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "proposals"] });
      toast({ title: isEdit ? "Proposal updated" : "Proposal created" });
      onSaved?.();
      dirtyCallback.current?.(false);
      onOpenChange(false);
    },
    onError: error => setFormError(error instanceof Error ? error.message : "Could not save proposal. Your edits remain here."),
  });
  useEffect(() => { dirtyCallback.current?.(dirty || saveMutation.isPending); }, [dirty, saveMutation.isPending]);
  const close = (next: boolean) => {
    if (!next && dirty && !window.confirm("Discard unsaved proposal edits?")) return;
    if (!next && (saveMutation.isPending || queryClient.isMutating({ mutationKey: ["project-proposal-save", leadId] }))) return;
    if (!next) setFormError("");
    onOpenChange(next);
  };
  const toggle = (id: string, checked: boolean | "indeterminate") => {
    setScopeTouched(true);
    setLegacyReplacementConfirmed(false);
    setSelectedPhaseIds(previous => checked ? previous.includes(id) ? previous : previous.concat(id) : previous.filter(value => value !== id));
  };

  const content = <>
    {inline ? <div className="mb-4"><h2 className="text-base font-semibold">{isEdit ? "Edit proposal" : "New standard proposal"}</h2></div> : <DialogHeader><DialogTitle>{isEdit ? "Edit proposal" : "New standard proposal"}</DialogTitle></DialogHeader>}
    <div className="flex-1 space-y-6 overflow-y-auto pr-1">
        {hasUnmappedScope && !isIssued && <div className="rounded-md border border-amber-500/40 p-3 text-sm">
          <p className="font-medium">Legacy proposal scope is retained</p>
          <p className="mt-1 text-xs text-muted-foreground">This document has phases that are not linked to shared project phases. Changing its name or description keeps its original phase and fee breakdown. Selecting shared phases replaces that scope only after your confirmation.</p>
          <ul className="mt-2 list-inside list-disc text-xs">{existing?.phases.map(phase => <li key={phase.id}>{phase.name}</li>)}</ul>
          {!scopeTouched && <Button className="mt-3" size="sm" variant="outline" onClick={() => setScopeTouched(true)}>Choose replacement scope</Button>}
          {scopeTouched && <label className="mt-3 flex items-start gap-2 text-xs"><Checkbox checked={legacyReplacementConfirmed} onCheckedChange={value => setLegacyReplacementConfirmed(value === true)} /><span>I intend to replace this document's legacy phases and fees with the selected shared phases.</span></label>}
        </div>}
        {work?.needsReconciliation && <div role="alert" className="rounded-md border border-amber-500/40 bg-amber-50/60 p-3 text-sm dark:bg-amber-950/20"><p className="font-medium">Reconcile existing project scope first</p><p className="mt-1 text-xs text-muted-foreground">Choose the intended legacy phase and fee source on the project before saving a Standard proposal.</p></div>}
        {isIssued && <div className="rounded-md border bg-muted/30 p-3 text-sm"><p className="font-medium">Issued scope is locked</p><p className="mt-1 text-xs text-muted-foreground">Sent and Signed proposal scope and fees remain as recorded. Only proposal metadata can be edited here; use the project page to create an updated draft.</p></div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="proposal-name">Proposal name</Label><Input id="proposal-name" value={name} onChange={e => setName(e.target.value)} maxLength={240} placeholder="e.g. Main residence renovation" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="proposal-description">Description</Label><Textarea id="proposal-description" value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Proposal-specific scope context" /></div>
          <div className="space-y-1.5"><Label>Status</Label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PROPOSAL_STATUSES.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <section className="border-t pt-5"><div className="mb-3 flex items-start justify-between gap-3"><h3 className="font-semibold">Project scope</h3><span className="text-xs text-muted-foreground">{selectedPhaseIds.length} selected</span></div>
          {workLoading ? <div className="space-y-2"><div className="h-14 animate-pulse rounded-md bg-muted" /><div className="h-14 animate-pulse rounded-md bg-muted" /></div> : workError ? <div role="alert" className="rounded-md border border-destructive/30 p-4 text-sm">Project phases could not load. <Button size="sm" variant="outline" onClick={() => void refetch()}>Retry</Button></div> : sortedPhases.length ? <div className="divide-y rounded-md border">{sortedPhases.map(phase => {
            const selected = selectedPhaseIds.includes(phase.id);
            return <label key={phase.id} className={`grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-3 py-3 ${phase.archived ? "bg-muted/30" : ""}`}><Checkbox checked={selected} disabled={isIssued || !!work?.needsReconciliation || phase.archived && !selected} onCheckedChange={value => toggle(phase.id, value)} aria-label={`Include ${phase.name}`} /><span className="min-w-0"><span className="flex flex-wrap items-center gap-2 text-sm font-medium">{phase.name}{phase.archived && <span className="text-[10px] font-normal uppercase text-muted-foreground">Archived · existing selection</span>}</span><span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">{phase.timeline && <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{phase.timeline}</span>}<span>{phase.feeLines.length ? `${phase.feeLines.length} consultant fee line${phase.feeLines.length === 1 ? "" : "s"}` : "No fee lines"}</span></span>{selected && phase.feeLines.length > 0 && <span className="mt-2 block space-y-1 border-l-2 border-primary/20 pl-2">{phase.feeLines.map(line => <span key={line.id} className="flex justify-between gap-4 text-xs text-muted-foreground"><span>{line.consultant} · {line.feeType}{line.feeType === "Hourly" && line.amount ? " · reference amount" : ""}</span><span>{line.amount ? formatCurrencyOrDash(line.amount) : line.feeType === "Hourly" ? "Hourly" : "Unpriced"}</span></span>)}</span>}</span><span className="text-right text-xs font-medium tabular-nums">{phaseTotal(phase) > 0 ? formatCurrencyOrDash(phaseTotal(phase).toFixed(2)) : "—"}</span></label>;
          })}</div> : <div className="rounded-md border border-dashed px-4 py-7 text-center"><FileText className="mx-auto h-5 w-5 text-muted-foreground" /><p className="mt-2 text-sm font-medium">No shared phases yet</p><p className="mt-1 text-xs text-muted-foreground">Add phases and optional fee inputs on the project page first.</p></div>}
        </section>
        {formError && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">{formError} Your text has been preserved.</p>}
    </div>
    <div className={`flex justify-end gap-2 border-t pt-4 ${inline ? "mt-4" : ""}`}><Button variant="outline" onClick={() => close(false)}>Cancel</Button><Button disabled={!name.trim() || saveMutation.isPending || workLoading || workError || !!work?.needsReconciliation || hasUnmappedScope && scopeTouched && !legacyReplacementConfirmed} onClick={() => saveMutation.mutate()}>{saveMutation.isPending ? "Saving…" : isEdit ? "Save proposal" : "Create proposal"}</Button></div>
  </>;
  if (inline && !open) return null;
  return inline ? <section className="rounded-lg border bg-card p-4 sm:p-6" data-testid="inline-proposal-form">{content}</section> : <Dialog open={open} onOpenChange={close}>
    <DialogContent aria-describedby={undefined} className="flex max-h-[90dvh] max-w-2xl flex-col">
      {content}
    </DialogContent>
  </Dialog>;
}
