import { useState } from "react";
import { focusProjectControl } from "@/lib/project-focus";
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
  | { type: "builder"; proposal: ProposalWithPhases; additionalServiceProposals: ProposalWithPhases[] }
  | { type: "invoice"; invoiceId: string };

export function InvoicesTab({ leadId, lead, onDirtyChange, guardedDirty = false, billingAllowed = true }: { leadId: number; lead: LeadWithCompanies; onDirtyChange?: (dirty: boolean) => void; guardedDirty?: boolean; billingAllowed?: boolean }) {
  const [view, setView] = useState<InvoicesView>({ type: "list" });
  const [editorNotice, setEditorNotice] = useState("");

  const { data: proposals = [], isError: proposalsError, refetch: refetchProposals } = useQuery<ProposalWithPhases[]>({
    queryKey: ["/api/leads", leadId, "proposals"],
  });

  const { data: invoices = [], isLoading: invoicesLoading, isError: invoicesError, refetch: refetchInvoices } = useQuery<Invoice[]>({
    queryKey: ["/api/leads", leadId, "invoices"],
  });

  const signedProposal = proposals.find((p) => p.status === "Signed" && p.proposalType !== "Additional Services");
  const signedAsProposals = proposals.filter((p) => p.status === "Signed" && p.proposalType === "Additional Services");
  const startBuilder = () => {
    if (!billingAllowed) { setEditorNotice("Restore the project to Active Project or Completed before starting an invoice."); return; }
    if (guardedDirty) { setEditorNotice("Finish or cancel the open project edit before starting an invoice."); return; }
    if (!signedProposal) return;
    setEditorNotice("");
    setView({ type: "builder", proposal: signedProposal, additionalServiceProposals: signedAsProposals });
  };

  if (view.type === "builder") {
    return (
      <InvoiceBuilderPanel
        leadId={leadId}
        proposal={view.proposal}
        additionalServiceProposals={view.additionalServiceProposals}
        onBack={() => { onDirtyChange?.(false); setView({ type: "list" }); focusProjectControl('[data-testid="button-new-invoice"]'); }}
        onCreated={(invoiceId) => setView({ type: "invoice", invoiceId })}
        onDirtyChange={onDirtyChange}
        billingAllowed={billingAllowed}
      />
    );
  }

  if (view.type === "invoice") {
    return (
      <InvoiceDetailPanel
        invoiceId={view.invoiceId}
        leadId={leadId}
        lead={lead}
        onBack={() => { onDirtyChange?.(false); setView({ type: "list" }); focusProjectControl('[data-testid="button-new-invoice"]'); }}
        onDirtyChange={onDirtyChange}
        guardedDirty={guardedDirty}
        billingAllowed={billingAllowed}
      />
    );
  }

  return (
    <div className="space-y-4">
      {!billingAllowed && <p role="status" className="rounded-md border border-amber-500/30 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">The project is no longer Active or Completed. Existing invoices and any open draft remain visible; restore the project stage before creating or changing billing records.</p>}
      {editorNotice && <p role="status" className="rounded-md border border-amber-500/30 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">{editorNotice}</p>}
      {proposalsError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 p-4 text-sm"><span>Signed proposal data could not load, so invoice creation is paused.</span><Button size="sm" variant="outline" onClick={() => void refetchProposals()}>Retry proposals</Button></div>}
      {!signedProposal && !proposalsError && (
        <div className="rounded-md border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            No signed proposal yet. Sign a standard proposal above to start creating invoices.
          </p>
        </div>
      )}

      <div className="rounded-md border bg-card">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold">Invoices</h3>
          {signedProposal && (
            <Button
              size="sm"
              onClick={startBuilder}
              disabled={!billingAllowed}
              data-testid="button-new-invoice"
            >
              <Plus className="w-3.5 h-3.5" />
              New Invoice
            </Button>
          )}
        </div>

        {invoicesError ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><span>Invoices could not load.</span><Button size="sm" variant="outline" onClick={() => void refetchInvoices()}>Retry invoices</Button></div>
        ) : invoicesLoading ? (
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
