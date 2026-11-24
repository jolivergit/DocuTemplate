import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Props = {
  projectName: string;
  status: string;
  setupComplete: boolean;
  timeline: string;
  activePhaseCount?: number;
  phaseLoading?: boolean;
  phaseError?: boolean;
  setupExpanded: boolean;
  detailsId: string;
  setupDisabled: boolean;
  onToggleSetup: () => void;
};

export function ProjectContextHeader({
  projectName, status, setupComplete, timeline, activePhaseCount, phaseLoading, phaseError,
  setupExpanded, detailsId, setupDisabled, onToggleSetup,
}: Props) {
  return <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
    <div className="min-w-0">
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="line-clamp-2 max-w-full break-words text-base font-semibold">{projectName}</h2>
        <Badge variant="outline" className="text-[10px]">{status}</Badge>
      </div>
      {setupComplete ? (
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="line-clamp-1 max-w-full break-words sm:max-w-[32rem]">{timeline}</span>
          <span aria-hidden="true">·</span>
          <span>{phaseError ? "Phase scope unavailable" : phaseLoading ? "Loading phase scope…" : `${activePhaseCount ?? 0} active ${(activePhaseCount ?? 0) === 1 ? "phase" : "phases"}`}</span>
        </p>
      ) : null}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      {setupComplete && <Button type="button" variant="outline" size="sm" onClick={onToggleSetup} disabled={setupDisabled} aria-expanded={setupExpanded} aria-controls={detailsId}>
        Project details
        {setupExpanded ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
      </Button>}
    </div>
  </div>;
}
