import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceBuilderPanel } from "@/components/invoice-builder-panel";
import { InvoiceDetailPanel } from "@/components/invoice-detail-panel";
import type { Invoice, ProposalWithPhases, LeadWithCompanies } from "@shared/schema";

const INVOICE_STATUS_COLORS: Record<string, string> = {
  Draft: "bg-secondary text-secondary-foreground",
  Sent: "bg-secondary text-secondary-foreground",
  Paid: "bg-secondary text-secondary-foreground",
};

type InvoicesView =
  | { type: "list" }
  | { type: "builder"; proposal: ProposalWithPhases }
  | { type: "invoice"; invoiceId: string };

export function InvoicesTab({ leadId, lead }: { leadId: number; lead: LeadWithCompanies }) {
  const [view, setView] = useState<InvoicesView>({ type: "list" });

  const { data: proposals = [] } = useQuery<ProposalWithPhases[]>({
    queryKey: ["/api/leads", leadId, "proposals"],
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/leads", leadId, "invoices"],
  });

  const signedProposal = proposals.find((p) => p.status === "Signed" && p.proposalType !== "Additional Services");
  const signedAsProposals = proposals.filter((p) => p.status === "Signed" && p.proposalType === "Additional Services");

  if (view.type === "builder" && signedProposal) {
    return (
      <InvoiceBuilderPanel
        leadId={leadId}
        proposal={signedProposal}
        additionalServiceProposals={signedAsProposals}
        onBack={() => setView({ type: "list" })}
        onCreated={(invoiceId) => setView({ type: "invoice", invoiceId })}
      />
    );
  }

  if (view.type === "invoice") {
    return (
      <InvoiceDetailPanel
        invoiceId={view.invoiceId}
        leadId={leadId}
        lead={lead}
        onBack={() => setView({ type: "list" })}
      />
    );
  }

  return (
    <div className="space-y-4">
      {!signedProposal && (
        <div className="rounded-md border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            No signed proposal yet. Sign a proposal on the Proposals tab to start creating invoices.
          </p>
        </div>
      )}

      <div className="rounded-md border bg-card">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold">Invoices</h3>
          {signedProposal && (
            <Button
              size="sm"
              onClick={() => setView({ type: "builder", proposal: signedProposal })}
              data-testid="button-new-invoice"
            >
              <Plus className="w-3.5 h-3.5" />
              New Invoice
            </Button>
          )}
        </div>

        {invoicesLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : invoices.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">No invoices yet.</p>
        ) : (
          <div className="divide-y">
            {invoices.map((inv) => (
              <button
                key={inv.id}
                className="w-full text-left px-4 py-3 hover-elevate flex items-center justify-between gap-3"
                onClick={() => setView({ type: "invoice", invoiceId: inv.id })}
                data-testid={`card-invoice-${inv.id}`}
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Invoice #{inv.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">{new Date(inv.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {inv.docUrl && (
                    <Badge variant="secondary" className="text-xs">Has Doc</Badge>
                  )}
                  <Badge
                    variant="secondary"
                    className={INVOICE_STATUS_COLORS[inv.status] || ""}
                  >
                    {inv.status}
                  </Badge>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
