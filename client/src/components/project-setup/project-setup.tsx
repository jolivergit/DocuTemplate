import { useEffect, useRef, useState } from "react";
import { useIsMutating, useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronDown, ChevronUp, Users, Building2, Layers3 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { badgeVariants } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { LeadWithCompanies } from "@shared/schema";
import type { ProjectTeam, ProjectSetupOptions } from "@shared/project-setup";
import { TeamEditor } from "./team-editor";
import { CompaniesEditor } from "./companies-editor";
import { PhaseTimelineEditor } from "./phase-timeline-editor";
import type { ProjectWork } from "@shared/project-work";
import { ProjectContextHeader } from "./project-context-header";

type Props = { lead: LeadWithCompanies; workDirty?: boolean; onDirtyChange?: (dirty: boolean) => void };
type IdentityDraft = {
  projectName: string;
  description: string;
  squareFootage: string;
  probability: string;
  potentialFee: string;
  status: string;
};
const identityFrom = (lead: LeadWithCompanies): IdentityDraft => ({
  projectName: lead.projectName,
  description: lead.description ?? "",
  squareFootage: lead.squareFootage ?? "",
  probability: lead.probability,
  potentialFee: lead.potentialFee ?? "",
  status: lead.status,
});

const teamKey = (id: number) => ["/api/leads", id, "team"];
const optionsKey = (id: number) => ["/api/leads", id, "setup-options"];
const workKey = (id: number) => ["/api/leads", id, "work"];
const inputClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export function ProjectSetup({ lead, workDirty = false, onDirtyChange }: Props) {
  const [identity, setIdentity] = useState(() => identityFrom(lead));
  const [identityBase, setIdentityBase] = useState(() => ({ value: identityFrom(lead), version: lead.setupVersion }));
  const [identityOpen, setIdentityOpen] = useState(!lead.setupComplete);
  const [setupExpanded, setSetupExpanded] = useState(!lead.setupComplete);
  const [message, setMessage] = useState("");
  const [sectionDirty, setSectionDirty] = useState({ team: false, companies: false, phases: false });
  const [teamSavingLocal, setTeamSavingLocal] = useState(false);
  const [teamStatus, setTeamStatus] = useState({ dirty: false, saving: false, error: false, reloading: false });
  const [companiesStatus, setCompaniesStatus] = useState({ dirty: false, saving: false, error: false, reloading: false });
  const [teamOpen, setTeamOpen] = useState(false);
  const [companiesOpen, setCompaniesOpen] = useState(false);
  const [identityReloading, setIdentityReloading] = useState(false);
  const id = lead.id;
  const teamMutations = useIsMutating({ mutationKey: ["project-team-save", id] });
  const teamSaving = teamSavingLocal || teamMutations > 0;
  const { data: team, isLoading: teamLoading, isError: teamError, refetch: refetchTeam } = useQuery<ProjectTeam>({ queryKey: teamKey(id) });
  const { data: options, isLoading: optionsLoading, isError: optionsError, refetch: refetchOptions } = useQuery<ProjectSetupOptions>({ queryKey: optionsKey(id) });
  const { data: work, isLoading: workLoading, isError: workError, refetch: refetchWork } = useQuery<ProjectWork>({ queryKey: workKey(id) });

  const identitySave = useMutation({
    mutationFn: (input: { body: IdentityDraft; version: number }) => apiRequest<LeadWithCompanies>("PATCH", `/api/leads/${id}/setup`, {
      version: input.version,
      projectName: input.body.projectName.trim(),
      description: input.body.description.trim() || null,
      squareFootage: input.body.squareFootage.trim() || null,
      probability: input.body.probability,
      potentialFee: input.body.potentialFee.trim() || null,
      status: input.body.status,
    }),
    onSuccess: updated => {
      queryClient.setQueryData(["/api/leads", id], updated);
      void queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      const next = identityFrom(updated);
      setIdentity(next);
      setIdentityBase({ value: next, version: updated.setupVersion });
      setIdentityOpen(false);
      setMessage("");
    },
    onError: error => setMessage(error instanceof Error ? error.message : "Could not save project details."),
  });

  const completeSetup = useMutation({
    mutationFn: () => apiRequest<LeadWithCompanies>("PATCH", `/api/leads/${id}/setup`, {
      version: lead.setupVersion, setupComplete: true,
    }),
    onSuccess: updated => {
      queryClient.setQueryData(["/api/leads", id], updated);
      void queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setSetupExpanded(false);
      setMessage("");
    },
    onError: error => setMessage(error instanceof Error ? error.message : "Could not complete setup."),
  });

  const hasAdmin = team?.hasAdmin ?? false;
  const canComplete = !!team?.canManage && team.members.some(member => member.assigned && member.roles.includes("Project Admin"));
  const dirtyIdentity = JSON.stringify(identity) !== JSON.stringify(identityBase.value);
  const setupHasUnsaved = dirtyIdentity || sectionDirty.team || sectionDirty.companies || sectionDirty.phases;
  const hasUnsaved = setupHasUnsaved || workDirty;
  const dirtyCallback = useRef(onDirtyChange);
  dirtyCallback.current = onDirtyChange;
  const setupMutationPending = teamSaving || identitySave.isPending || identityReloading || completeSetup.isPending;
  const teamBlockReason = workDirty
    ? "Save or cancel the current project edit before changing team access. Saving team access refreshes the project workspace."
    : dirtyIdentity || sectionDirty.companies || sectionDirty.phases
      ? "Save or cancel the other setup edits before saving team access."
      : undefined;
  const assignedMembers = team?.members.filter(member => member.assigned) ?? [];
  const teamSummary = assignedMembers.length
    ? `${assignedMembers.slice(0, 2).map(member => `${member.name} · ${member.roles.length ? member.roles.join(", ") : "No role"}`).join(" / ")}${assignedMembers.length > 2 ? ` · +${assignedMembers.length - 2} more` : ""}`
    : "No teammates assigned";
  const companiesSummary = lead.companies.length
    ? `${lead.companies.slice(0, 2).map(company => `${company.companyName || "Unnamed company"} · ${company.companyRole}`).join(" / ")}${lead.companies.length > 2 ? ` · +${lead.companies.length - 2} more` : ""}`
    : "No companies attached";
  useEffect(() => {
    if (dirtyIdentity || identitySave.isPending || identityReloading) return;
    const latest = identityFrom(lead);
    setIdentity(latest);
    setIdentityBase({ value: latest, version: lead.setupVersion });
  }, [lead.id, lead.setupVersion, dirtyIdentity, identitySave.isPending, identityReloading]);
  useEffect(() => {
    if (!hasUnsaved) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [hasUnsaved]);
  useEffect(() => { dirtyCallback.current?.(setupHasUnsaved); }, [setupHasUnsaved]);
  const toggleSetup = () => {
    if (setupMutationPending) return;
    if (setupExpanded && setupHasUnsaved && !window.confirm("Discard unsaved project changes and close project details?")) return;
    if (setupExpanded && setupHasUnsaved) {
      setIdentity(identityBase.value);
      setSectionDirty({ team: false, companies: false, phases: false });
    }
    setSetupExpanded(value => !value);
  };

  async function reloadIdentityLatest() {
    setIdentityReloading(true);
    setMessage("");
    try {
      const latestLead = await queryClient.fetchQuery<LeadWithCompanies>({ queryKey: ["/api/leads", id], staleTime: 0 });
      const latest = identityFrom(latestLead);
      setIdentity(latest);
      setIdentityBase({ value: latest, version: latestLead.setupVersion });
      setMessage("");
      identitySave.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load the latest project details. Your draft is preserved.");
    } finally {
      setIdentityReloading(false);
    }
  }

  function cancelIdentity() {
    if (dirtyIdentity && !window.confirm("Discard unsaved project details?")) return;
    setIdentity(identityBase.value);
    setIdentityOpen(false);
  }

  const activePhaseCount = work ? work.phases.filter(phase => !phase.archived).length : 0;

  return (
    <section className="overflow-hidden rounded-xl border bg-card" aria-label="Project details">
      <ProjectContextHeader
        projectName={lead.projectName}
        status={lead.status}
        setupComplete={lead.setupComplete}
        timeline={lead.generalTimeline?.trim() || "Timeline not set"}
        activePhaseCount={work ? activePhaseCount : undefined}
        phaseLoading={!work && !workError}
        phaseError={workError && !work}
        setupExpanded={setupExpanded}
        detailsId={`project-details-${id}`}
        setupDisabled={setupMutationPending}
        onToggleSetup={toggleSetup}
      />

      {message && <div role="alert" className="border-b border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:px-6">{message}</div>}
      <div id={`project-details-${id}`}>
      {(setupExpanded || !lead.setupComplete) && (
        <fieldset disabled={setupMutationPending} className="m-0 min-w-0 border-0 p-0">
        <div className="divide-y">
          <section className="px-4 py-5 sm:px-6">
            <button type="button" onClick={() => {
              if (setupMutationPending) return;
              if (identityOpen && dirtyIdentity && !window.confirm("Discard unsaved project details?")) return;
              if (identityOpen) setIdentity(identityBase.value);
              setIdentityOpen(value => !value);
            }} disabled={setupMutationPending} className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={identityOpen}>
              <span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Layers3 className="h-4 w-4" /></span><span className="text-sm font-semibold">Project basics</span></span>
              {identityOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {!identityOpen && <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 pl-12 text-sm"><span className="font-medium">{lead.projectName}</span><span className="text-muted-foreground">{lead.status}</span><span className="text-muted-foreground">{lead.squareFootage ? `${Number(lead.squareFootage).toLocaleString()} sq ft` : "Area not set"}</span></div>}
            {identityOpen && <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <fieldset disabled={identitySave.isPending} className="contents">
                <label className="space-y-1.5 text-xs font-medium sm:col-span-2">Project name<Input autoComplete="off" maxLength={240} value={identity.projectName} onChange={event => setIdentity({ ...identity, projectName: event.target.value })} /></label>
                <label className="space-y-1.5 text-xs font-medium sm:col-span-2">Description<Textarea rows={3} value={identity.description} onChange={event => setIdentity({ ...identity, description: event.target.value })} placeholder="A short project brief" /></label>
                <label className="space-y-1.5 text-xs font-medium">Status<select className={inputClass} value={identity.status} onChange={event => setIdentity({ ...identity, status: event.target.value })}>{["Lead", "Proposal", "Active Project", "Completed", "Lost"].map(status => <option key={status}>{status}</option>)}</select></label>
                <label className="space-y-1.5 text-xs font-medium">Probability<select className={inputClass} value={identity.probability} onChange={event => setIdentity({ ...identity, probability: event.target.value })}>{["LOW", "MEDIUM", "HIGH"].map(value => <option key={value}>{value}</option>)}</select></label>
                <label className="space-y-1.5 text-xs font-medium">Approx. area (sq ft)<Input inputMode="numeric" value={identity.squareFootage} onChange={event => setIdentity({ ...identity, squareFootage: event.target.value })} placeholder="Optional" /></label>
                <label className="space-y-1.5 text-xs font-medium">Potential fee<Input inputMode="decimal" value={identity.potentialFee} onChange={event => setIdentity({ ...identity, potentialFee: event.target.value })} placeholder="Optional" /></label>
              </fieldset>
              {identitySave.error && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive sm:col-span-2">
                <p>{identitySave.error instanceof Error ? identitySave.error.message : "Could not save project details. Your draft is preserved."}</p>
                {(identitySave.error as { status?: number }).status === 409 && <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={identityReloading} onClick={() => void reloadIdentityLatest()}>{identityReloading ? "Loading…" : "Reload latest"}</Button><Button size="sm" variant="ghost" disabled={identityReloading} onClick={() => void reloadIdentityLatest()}>Discard draft & reload</Button></div>}
                {message && <p className="mt-2">{message}</p>}
              </div>}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button type="button" variant="ghost" size="sm" onClick={cancelIdentity} disabled={identitySave.isPending || identityReloading}>Cancel</Button>
                <Button type="button" size="sm" disabled={!identity.projectName.trim() || !dirtyIdentity || identitySave.isPending || identityReloading} onClick={() => identitySave.mutate({ body: identity, version: identityBase.version })}>{identitySave.isPending ? "Saving…" : "Save details"}</Button>
              </div>
            </div>}
          </section>

          <div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0">
            <section className="min-w-0 px-4 py-4 sm:px-6">
              <button type="button" onClick={() => setTeamOpen(value => !value)} aria-expanded={teamOpen} aria-controls={`project-team-panel-${id}`} className="flex w-full min-w-0 items-start justify-between gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <span className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Users className="h-4 w-4" /></span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">Team <span className="font-normal text-muted-foreground">{teamLoading ? "Loading…" : `${assignedMembers.length} assigned`}</span></span>
                    <span className="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-muted-foreground">{team ? teamSummary : "Project access and roles"}</span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {teamStatus.dirty && <span className={badgeVariants({ variant: "outline" })}>Unsaved changes</span>}
                      {(teamStatus.saving || teamSaving) && <span className={badgeVariants({ variant: "secondary" })}>Saving…</span>}
                      {teamStatus.reloading && <span className={badgeVariants({ variant: "secondary" })}>Refreshing…</span>}
                      {(teamStatus.error || teamError) && <span className={badgeVariants({ variant: "destructive" })}>Needs attention</span>}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2 pt-1 text-xs font-medium text-primary">{teamOpen ? "Collapse" : assignedMembers.length === 0 ? "Assign a teammate" : "Edit team"}{teamOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
              </button>
              {team && !hasAdmin && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/30 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
                <span>No Project Admin is assigned. Set an admin before completing setup; project work remains available.</span>
                {!teamOpen && <Button variant="outline" size="sm" className="h-7 bg-background" onClick={() => setTeamOpen(true)}>Open team</Button>}
              </div>}
              {(teamError || teamStatus.error) && <div role="status" className="mt-2 flex flex-wrap items-center gap-2 text-xs text-destructive">
                <span>{teamError ? "Team could not load." : "Team changes need attention."}</span>
                <Button variant="ghost" size="sm" className="h-7" onClick={() => setTeamOpen(true)}>Open to review</Button>
                {teamError && <Button variant="ghost" size="sm" className="h-7" disabled={setupMutationPending} onClick={() => void refetchTeam()}>Retry</Button>}
              </div>}
              <div id={`project-team-panel-${id}`} hidden={!teamOpen} className="pt-4">
                {team ? <TeamEditor leadId={id} team={team} disabled={teamSaving} blockedReason={teamBlockReason} onSavingChange={setTeamSavingLocal} onDirtyChange={dirty => setSectionDirty(current => current.team === dirty ? current : { ...current, team: dirty })} onStatusChange={status => setTeamStatus(current => current.dirty === status.dirty && current.saving === status.saving && current.error === status.error && current.reloading === status.reloading ? current : status)} /> : teamLoading ? <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : <div role="alert" className="text-sm text-muted-foreground">Team could not load. <Button variant="ghost" size="sm" disabled={setupMutationPending} onClick={() => void refetchTeam()}>Retry</Button></div>}
              </div>
            </section>
            <section className="min-w-0 px-4 py-4 sm:px-6">
              <button type="button" onClick={() => setCompaniesOpen(value => !value)} aria-expanded={companiesOpen} aria-controls={`project-companies-panel-${id}`} className="flex w-full min-w-0 items-start justify-between gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <span className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-4 w-4" /></span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">Companies <span className="font-normal text-muted-foreground">{lead.companies.length} {lead.companies.length === 1 ? "entry" : "entries"}</span></span>
                    <span className="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-muted-foreground">{companiesSummary}</span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {companiesStatus.dirty && <span className={badgeVariants({ variant: "outline" })}>Unsaved changes</span>}
                      {companiesStatus.saving && <span className={badgeVariants({ variant: "secondary" })}>Saving…</span>}
                      {companiesStatus.reloading && <span className={badgeVariants({ variant: "secondary" })}>Refreshing…</span>}
                      {(companiesStatus.error || optionsError) && <span className={badgeVariants({ variant: "destructive" })}>Needs attention</span>}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2 pt-1 text-xs font-medium text-primary">{companiesOpen ? "Collapse" : lead.companies.length === 0 ? "Add a company" : "Edit companies"}{companiesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
              </button>
              {(optionsError || companiesStatus.error) && <div role="status" className="mt-2 flex flex-wrap items-center gap-2 text-xs text-destructive">
                <span>{optionsError ? "Company records could not load." : "Company changes need attention."}</span>
                <Button variant="ghost" size="sm" className="h-7" onClick={() => setCompaniesOpen(true)}>Open to review</Button>
                {optionsError && <Button variant="ghost" size="sm" className="h-7" disabled={setupMutationPending} onClick={() => void refetchOptions()}>Retry</Button>}
              </div>}
              <div id={`project-companies-panel-${id}`} hidden={!companiesOpen} className="pt-4">
                {options ? <CompaniesEditor leadId={id} entries={lead.companies} options={options} version={lead.setupVersion} disabled={teamSaving} onDirtyChange={dirty => setSectionDirty(current => current.companies === dirty ? current : { ...current, companies: dirty })} onStatusChange={status => setCompaniesStatus(current => current.dirty === status.dirty && current.saving === status.saving && current.error === status.error && current.reloading === status.reloading ? current : status)} /> : optionsLoading ? <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : <div role="alert" className="text-sm text-muted-foreground">Company records could not load. <Button variant="ghost" size="sm" disabled={setupMutationPending} onClick={() => void refetchOptions()}>Retry</Button></div>}
              </div>
            </section>
          </div>

          <section className="px-4 py-5 sm:px-6">
            <PhaseTimelineEditor leadId={id} generalTimeline={lead.generalTimeline ?? ""} version={lead.setupVersion} phases={work?.phases ?? []} work={work} workLoading={workLoading} workError={workError} disabled={teamSaving} onRetryWork={() => void refetchWork()} onDirtyChange={dirty => setSectionDirty(current => current.phases === dirty ? current : { ...current, phases: dirty })} />
          </section>

          <div className="flex flex-col gap-3 bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">Project details stay editable. Project scope and fee details are shared with proposal preparation.</p>
              {!lead.setupComplete && team?.canManage && <Button size="sm" onClick={() => completeSetup.mutate()} disabled={!canComplete || hasUnsaved || setupMutationPending}>
                {completeSetup.isPending ? "Finishing…" : <>Finish setup <ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>}
          </div>
        </div>
        </fieldset>
      )}
      </div>
    </section>
  );
}
