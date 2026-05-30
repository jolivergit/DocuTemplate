import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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

export function ProposalsTab({ leadId, projectName }: { leadId: number; projectName: string }) {
  const [showNew, setShowNew] = useState(false);
  const [showNewAS, setShowNewAS] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<ProposalWithPhases | null>(null);

  const { data: proposals = [], isLoading } = useQuery<ProposalWithPhases[]>({
    queryKey: ["/api/leads", leadId, "proposals"],
    queryFn: async () => {
      const r = await fetch(`/api/leads/${leadId}/proposals`);
      if (!r.ok) throw new Error("Failed to load proposals");
      return r.json();
    },
  });

  if (selectedProposal) {
    const current = proposals.find((p) => p.id === selectedProposal.id) || selectedProposal;
    return (
      <ProposalDetailPanel
        proposal={current}
        leadId={leadId}
        projectName={projectName}
        onBack={() => setSelectedProposal(null)}
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {proposals.length === 0 ? "No proposals yet" : `${proposals.length} proposal${proposals.length !== 1 ? "s" : ""}`}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" data-testid="button-new-proposal">
              <Plus className="w-3.5 h-3.5" />
              New Proposal
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowNew(true)} data-testid="menu-new-standard-proposal">
              Standard Proposal
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowNewAS(true)} data-testid="menu-new-as-proposal">
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

      {!isLoading && proposals.length === 0 && (
        <div className="rounded-md border bg-card p-8 text-center">
          <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No proposals yet. Create one to get started.</p>
        </div>
      )}

      <div className="space-y-3">
        {proposals.map((proposal) => {
          const total = grandTotal(proposal);
          return (
            <button
              key={proposal.id}
              className="w-full text-left rounded-md border bg-card p-4 hover-elevate active-elevate-2 space-y-2"
              onClick={() => setSelectedProposal(proposal)}
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
      </div>

      <ProposalFormDialog
        open={showNew}
        onOpenChange={setShowNew}
        leadId={leadId}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "proposals"] })}
      />
      <AdditionalServicesFormDialog
        open={showNewAS}
        onOpenChange={setShowNewAS}
        leadId={leadId}
      />
    </div>
  );
}
