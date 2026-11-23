import { useState } from "react";
import { focusProjectControl } from "@/lib/project-focus";
import { useIsMutating, useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  Plus,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProposalDetailPanel } from "@/components/proposal-detail-panel";
import { ProposalFormDialog } from "@/components/proposal-form-dialog";
import { AdditionalServicesFormDialog } from "@/components/additional-services-form-dialog";
import { queryClient } from "@/lib/queryClient";
import { formatCurrencyOrDash } from "@/lib/utils";
import type { ProposalWithPhases, ProposalStatus } from "@shared/schema";

const PROPOSAL_STATUS_COLORS: Record<ProposalStatus, string> = {
  Draft: "bg-secondary text-secondary-foreground",
  Sent: "bg-secondary text-secondary-foreground",
  Revision: "bg-secondary text-secondary-foreground",
  Signed: "bg-secondary text-secondary-foreground",
  Declined: "bg-secondary text-secondary-foreground",
};

export function ProposalsTab({ leadId, projectName, onDirtyChange, guardedDirty = false }: { leadId: number; projectName: string; onDirtyChange?: (dirty: boolean) => void; guardedDirty?: boolean }) {
  const proposalSaving = useIsMutating({ mutationKey: ["project-proposal-save", leadId] }) > 0;
  const [showNew, setShowNew] = useState<"standard" | "additional" | null>(null);
  const [newEditorDirty, setNewEditorDirty] = useState(false);
  const [editorNotice, setEditorNotice] = useState("");
  const [selectedProposal, setSelectedProposal] = useState<ProposalWithPhases | null>(null);

  const { data: proposals = [], isLoading, isError, refetch } = useQuery<ProposalWithPhases[]>({
    queryKey: ["/api/leads", leadId, "proposals"],
  });
  const selectNewType = (type: "standard" | "additional") => {
    if (queryClient.isMutating({ mutationKey: ["project-proposal-save", leadId] })) { setEditorNotice("Wait for the proposal save to finish before switching editors."); return; }
    if (!showNew && guardedDirty) { setEditorNotice("Finish or cancel the open project edit before starting a proposal editor."); return; }
    if (showNew && showNew !== type && newEditorDirty && !window.confirm("Discard this proposal draft and switch editor?")) return;
    if (showNew && showNew !== type) { setNewEditorDirty(false); onDirtyChange?.(false); }
    setEditorNotice("");
    setShowNew(type);
    focusProjectControl(type === "standard" ? "#proposal-name" : "#as-name");
  };

  if (selectedProposal) {
    const current = proposals.find((p) => p.id === selectedProposal.id) || selectedProposal;
    return (
      <ProposalDetailPanel
        proposal={current}
        leadId={leadId}
        projectName={projectName}
        onBack={() => { onDirtyChange?.(false); setSelectedProposal(null); focusProjectControl(`[data-testid="card-proposal-${selectedProposal.id}"]`); }}
        onDirtyChange={onDirtyChange}
        guardedDirty={guardedDirty}
      />
    );
  }

  const grandTotal = (proposal: ProposalWithPhases) => {
    if (proposal.proposalType === "Additional Services") {
      return (proposal.additionalLineItems || []).reduce((sum, item) => {
        if (!item.amount) return sum;
        const n = parseFloat(item.amount);
        return isNaN(n) ? sum : sum + n;
      }, 0);
    }
    return proposal.phases.reduce((sum, ph) =>
      sum + ph.feeLines.reduce((s, fl) => {
        if (fl.feeType === "Fixed" && fl.amount) {
          const n = parseFloat(fl.amount);
          return isNaN(n) ? s : s + n;
        }
        return s;
      }, 0), 0);
  };

  return (
    <div className="space-y-4">
      {editorNotice && <p role="status" className="rounded-md border border-amber-500/30 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">{editorNotice}</p>}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Loading proposals…" : isError ? "Proposal list unavailable" : proposals.length === 0 ? "No proposals yet" : `${proposals.length} proposal${proposals.length !== 1 ? "s" : ""}`}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" disabled={proposalSaving} data-testid="button-new-proposal">
              <Plus className="w-3.5 h-3.5" />
              New Proposal
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => selectNewType("standard")} data-testid="menu-new-standard-proposal">
              Standard Proposal
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => selectNewType("additional")} data-testid="menu-new-as-proposal">
              Additional Services
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm"><span>Proposals could not load. Your project work remains available.</span><Button size="sm" variant="outline" onClick={() => void refetch()}>Retry proposals</Button></div>}
      {!isLoading && !isError && proposals.length === 0 && (
        <div className="rounded-md border bg-card p-8 text-center">
          <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No proposals yet. Create one to get started.</p>
        </div>
      )}

      {!isError && <div className="space-y-3">
        {proposals.map((proposal) => {
          const total = grandTotal(proposal);
          return (
            <button
              key={proposal.id}
              disabled={proposalSaving}
              className="w-full text-left rounded-md border bg-card p-4 hover-elevate active-elevate-2 space-y-2"
              onClick={() => {
                if (queryClient.isMutating({ mutationKey: ["project-proposal-save", leadId] })) return;
                if (showNew && newEditorDirty && !window.confirm("Discard the unsaved proposal draft and open this record?")) return;
                if (showNew) { setShowNew(null); setNewEditorDirty(false); onDirtyChange?.(false); }
                setSelectedProposal(proposal);
              }}
              data-testid={`card-proposal-${proposal.id}`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant="secondary"
                      className={PROPOSAL_STATUS_COLORS[proposal.status as ProposalStatus] || ""}
                    >
                      {proposal.status}
                    </Badge>
                    {proposal.proposalType === "Additional Services" && (
                      <Badge variant="secondary" className="text-xs" data-testid={`badge-as-${proposal.id}`}>
                        Add. Services
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium">{proposal.name}</p>
                  {proposal.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{proposal.description}</p>
                  )}
                </div>
                {total > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total Fee</p>
                    <p className="text-sm font-semibold">{formatCurrencyOrDash(total.toFixed(2))}</p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Created {new Date(proposal.createdAt).toLocaleDateString()}</span>
                {proposal.dateSent && <span>Sent {new Date(proposal.dateSent).toLocaleDateString()}</span>}
                {proposal.dateSigned && <span>Signed {new Date(proposal.dateSigned).toLocaleDateString()}</span>}
                {proposal.proposalType === "Additional Services"
                  ? <span>{(proposal.additionalLineItems || []).length} line item{(proposal.additionalLineItems || []).length !== 1 ? "s" : ""}</span>
                  : <span>{proposal.phases.length} phase{proposal.phases.length !== 1 ? "s" : ""}</span>}
              </div>
            </button>
          );
        })}
      </div>}

      {showNew === "standard" && <ProposalFormDialog open onOpenChange={open => { if (!open) { setNewEditorDirty(false); onDirtyChange?.(false); setShowNew(null); focusProjectControl('[data-testid="button-new-proposal"]'); } }} inline leadId={leadId} onDirtyChange={dirty => { setNewEditorDirty(dirty); onDirtyChange?.(dirty); }} onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "proposals"] })} />}
      {showNew === "additional" && <AdditionalServicesFormDialog open onOpenChange={open => { if (!open) { setNewEditorDirty(false); onDirtyChange?.(false); setShowNew(null); focusProjectControl('[data-testid="button-new-proposal"]'); } }} inline leadId={leadId} onDirtyChange={dirty => { setNewEditorDirty(dirty); onDirtyChange?.(dirty); }} />}
    </div>
  );
}
