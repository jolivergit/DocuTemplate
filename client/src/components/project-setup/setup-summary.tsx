import type { LeadWithCompanies } from "@shared/schema";
import type { ProjectSetupOptions, ProjectTeam } from "@shared/project-setup";
import type { ProjectWork, WorkPhase } from "@shared/project-work";
import { formatCurrencyOrDash } from "@/lib/utils";

type Props = {
  lead: LeadWithCompanies;
  team?: ProjectTeam;
  teamLoading: boolean;
  teamError: boolean;
  options?: ProjectSetupOptions;
  optionsLoading: boolean;
  optionsError: boolean;
  work?: ProjectWork;
  workLoading: boolean;
  workError: boolean;
};

const MAX_ROWS = 3;

function DataState({ loading, error, hasData, label }: { loading: boolean; error: boolean; hasData: boolean; label: string }) {
  if (hasData) return error ? <p role="status" className="mt-1 text-xs text-muted-foreground">Showing saved {label}; latest refresh failed.</p> : null;
  if (loading) return <p className="mt-2 text-xs text-muted-foreground">Loading {label}…</p>;
  if (error) return <p role="status" className="mt-2 text-xs text-muted-foreground">{label} unavailable.</p>;
  return <p className="mt-2 text-xs text-muted-foreground">No {label} saved.</p>;
}

function fixedSubtotal(phase: WorkPhase) {
  return phase.feeLines
    .filter(line => line.feeType === "Fixed")
    .reduce((sum, line) => sum + (line.amount ? Number(line.amount) || 0 : 0), 0);
}

export function SetupSummary({ lead, team, teamLoading, teamError, options, optionsLoading, optionsError, work, workLoading, workError }: Props) {
  const assigned = team?.members.filter(member => member.assigned) ?? [];
  const phases = work?.phases.filter(phase => !phase.archived).sort((a, b) => a.sortOrder - b.sortOrder) ?? [];
  const shownPhases = phases.slice(0, MAX_ROWS);
  const hasTeam = !!team;
  const hasWork = !!work;
  const knownFixedTotal = phases.reduce((sum, phase) => sum + fixedSubtotal(phase), 0);
  const hasUnknownFixedAmount = phases.some(phase =>
    phase.feeLines.some(line => line.feeType === "Fixed" && (line.amount === null || line.amount === "" || !Number.isFinite(Number(line.amount))))
  );
  const fixedTotalReady = hasWork && !work?.needsReconciliation && !hasUnknownFixedAmount;
  const hourlyCount = phases.reduce((sum, phase) => sum + phase.feeLines.filter(line => line.feeType === "Hourly").length, 0);

  return (
    <div className="space-y-4 px-4 py-5 sm:px-6">
      <section aria-label="Project details" className="rounded-lg border bg-muted/20 p-3.5">
        <h3 className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Project details</h3>
        {lead.description?.trim() && <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{lead.description}</p>}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {lead.squareFootage && <span><span className="text-xs text-muted-foreground">Area </span>{Number(lead.squareFootage).toLocaleString()} sq ft</span>}
          {lead.potentialFee && <span><span className="text-xs text-muted-foreground">Potential fee </span>{formatCurrencyOrDash(lead.potentialFee)}</span>}
          {lead.generalTimeline && <span className="break-words"><span className="text-xs text-muted-foreground">Overall timeline </span>{lead.generalTimeline}</span>}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-label="Assigned project team" className="min-w-0">
          <h3 className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Project team</h3>
          <DataState loading={teamLoading} error={teamError} hasData={hasTeam} label="team records" />
          {hasTeam && (assigned.length ? (
            <ul className="mt-2 space-y-1.5">
              {assigned.slice(0, MAX_ROWS).map(member => (
                <li key={member.userId} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
                  <span className="min-w-0 break-words font-medium">{member.name}</span>
                  <span className="break-words text-xs text-muted-foreground">{member.roles.length ? member.roles.join(", ") : "No project role"}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-xs text-muted-foreground">No teammates assigned.</p>)}
          {hasTeam && assigned.length > MAX_ROWS && <p className="mt-1 text-xs text-muted-foreground">+{assigned.length - MAX_ROWS} more</p>}
        </section>

        <section aria-label="Project companies" className="min-w-0">
          <h3 className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Collaborating companies</h3>
          {optionsError && <p role="status" className="mt-1 text-xs text-muted-foreground">Company directory unavailable; showing saved project entries.</p>}
          {!options && optionsLoading && <p className="mt-1 text-xs text-muted-foreground">Loading company directory…</p>}
          {lead.companies.length ? (
            <>
              <ul className="mt-2 space-y-1.5">
                {lead.companies.slice(0, MAX_ROWS).map((company, index) => {
                  const contact = company.linkedContact ?? options?.contacts.find(item => item.id === company.contactId);
                  const companyName = company.companyName || company.linkedCompany?.name || "Unnamed company";
                  return (
                    <li key={company.id || `${company.companyRole}-${company.companyName}-${index}`} className="min-w-0 text-sm">
                    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <span className="min-w-0 break-words font-medium">{companyName}</span>
                      <span className="break-words text-xs text-muted-foreground">{company.companyRole}</span>
                    </div>
                    {contact?.fullName && <p className="break-words text-xs text-muted-foreground">Contact: {contact.fullName}</p>}
                    </li>
                  );
                })}
              </ul>
              {lead.companies.length > MAX_ROWS && <p className="mt-1 text-xs text-muted-foreground">+{lead.companies.length - MAX_ROWS} more</p>}
            </>
          ) : <p className="mt-2 text-xs text-muted-foreground">No collaborating companies saved.</p>}
        </section>
      </div>

      <section aria-label="Project scope" className="border-t pt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Active phase scope</h3>
          {hasWork && <span className="text-xs text-muted-foreground">{phases.length} {phases.length === 1 ? "phase" : "phases"}</span>}
        </div>
        <DataState loading={workLoading} error={workError} hasData={hasWork} label="scope records" />
        {work?.needsReconciliation && <p role="status" className="mt-2 text-xs text-muted-foreground">Existing proposal scope needs review. Open setup to choose the shared scope before relying on these totals.</p>}
        {hasWork && (phases.length ? (
          <>
            <ul className="mt-2 divide-y">
              {shownPhases.map(phase => {
                const fixed = phase.feeLines.filter(line => line.feeType === "Fixed");
                const hourly = phase.feeLines.filter(line => line.feeType === "Hourly");
                const incompleteFixed = fixed.some(line => line.amount === null || line.amount === "" || !Number.isFinite(Number(line.amount)));
                return (
                  <li key={phase.id} className="flex min-w-0 flex-wrap justify-between gap-x-4 gap-y-1 py-2 text-sm first:pt-0">
                    <div className="min-w-0">
                      <p className="break-words font-medium">{phase.name}</p>
                      <p className="break-words text-xs text-muted-foreground">{phase.timeline || "Timeline not set"}</p>
                      {hourly.length > 0 && <p className="mt-0.5 break-words text-xs text-muted-foreground">{hourly.length} hourly {hourly.length === 1 ? "line" : "lines"} — excluded from fixed-fee total</p>}
                    </div>
                    <span className="shrink-0 self-start text-sm tabular-nums text-muted-foreground">
                      {fixed.length ? `${incompleteFixed ? "At least " : ""}${formatCurrencyOrDash(fixedSubtotal(phase))} fixed` : "No fixed-fee lines"}
                    </span>
                  </li>
                );
              })}
            </ul>
            {phases.length > MAX_ROWS && <p className="text-xs text-muted-foreground">+{phases.length - MAX_ROWS} more phases</p>}
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t pt-2">
              <span className="text-xs font-semibold text-muted-foreground">Aggregate fixed-fee scope total{!fixedTotalReady && " · incomplete"}</span>
              <span className="font-semibold tabular-nums">{fixedTotalReady ? formatCurrencyOrDash(knownFixedTotal) : "—"}</span>
            </div>
            {hourlyCount > 0 && <p className="mt-1 text-xs text-muted-foreground">{hourlyCount} hourly {hourlyCount === 1 ? "line" : "lines"} shown separately; reference amounts are not included.</p>}
          </>
        ) : <p className="mt-2 text-xs text-muted-foreground">No active phases saved.</p>)}
      </section>
    </div>
  );
}
