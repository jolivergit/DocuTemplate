import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ExternalLink, Check, X, Edit, Trash2, ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ProposalFormDialog } from "@/components/proposal-form-dialog";
import {
  SERVICE_CATEGORIES,
  DISCIPLINES,
  type ProposalWithPhases,
  type ProposalStatus,
} from "@shared/schema";

const STATUS_COLORS: Record<ProposalStatus, string> = {
  Draft: "bg-secondary text-secondary-foreground",
  Sent: "bg-muted text-muted-foreground",
  Revision: "bg-muted text-muted-foreground",
  Signed: "bg-foreground text-background",
  Declined: "bg-muted text-muted-foreground",
};

function fmt(value: string | null | undefined): string {
  if (!value) return "—";
  const n = parseFloat(value);
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d as string).toLocaleDateString();
}

function phaseTotal(phase: ProposalWithPhases["phases"][0]): number {
  return phase.feeLines.reduce((sum, fl) => {
    if (fl.feeType === "Fixed" && fl.amount) {
      const n = parseFloat(fl.amount);
      return isNaN(n) ? sum : sum + n;
    }
    return sum;
  }, 0);
}

interface Props {
  proposal: ProposalWithPhases;
  leadId: number;
  projectName?: string;
  onBack: () => void;
}

export function ProposalDetailPanel({ proposal, leadId, projectName, onBack }: Props) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSignConfirm, setShowSignConfirm] = useState(false);
  const [isLoadingDocBuilder, setIsLoadingDocBuilder] = useState(false);

  const signMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/proposals/${proposal.id}/sign`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "proposals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
      toast({ title: "Proposal signed — lead is now an Active Project" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to sign proposal", description: err.message, variant: "destructive" });
    },
  });

  const declineMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/proposals/${proposal.id}/decline`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "proposals"] });
      toast({ title: "Proposal marked as declined" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to decline proposal", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/proposals/${proposal.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "proposals"] });
      toast({ title: "Proposal deleted" });
      onBack();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete proposal", description: err.message, variant: "destructive" });
    },
  });

  const handleLoadToDocBuilder = async () => {
    setIsLoadingDocBuilder(true);
    try {
      // Clear stale proposal context fields before loading fresh values
      // Note: client_ is intentionally excluded — proposals don't populate those fields
      await fetch("/api/field-values/by-prefix", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: ["proposal_", "project_name"] }),
      });

      const grandTotal = proposal.phases.reduce((sum, ph) => sum + phaseTotal(ph), 0);

      // Fetch firm profile (may not exist yet — gracefully handle 404)
      const profileRes = await fetch("/api/profile");
      const profile = profileRes.ok ? await profileRes.json() : null;

      const fieldMappings: { name: string; value: string }[] = [
        { name: "project_name", value: projectName || "" },
        { name: "proposal_name", value: proposal.name },
        { name: "proposal_total", value: grandTotal > 0 ? `$${grandTotal.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "" },
        { name: "proposal_date", value: proposal.dateSent ? new Date(proposal.dateSent).toLocaleDateString() : new Date().toLocaleDateString() },
        // Firm info from profile
        ...(profile ? [
          { name: "firm_name", value: profile.name || "" },
          { name: "firm_contact_name", value: profile.contactName || "" },
          { name: "firm_contact_title", value: profile.contactTitle || "" },
          { name: "firm_address", value: [profile.addressLine1, profile.addressLine2].filter(Boolean).join(", ") },
          { name: "firm_city", value: profile.city || "" },
          { name: "firm_state", value: profile.state || "" },
          { name: "firm_zip", value: profile.zip || "" },
          { name: "firm_phone", value: profile.phone || "" },
          { name: "firm_email", value: profile.email || "" },
        ] : []),
      ];

      await Promise.all(
        fieldMappings
          .filter((f) => f.value)
          .map((f) =>
            fetch("/api/field-values/upsert-by-name", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(f),
            })
          )
      );

      queryClient.invalidateQueries({ queryKey: ["/api/field-values"] });
      toast({ title: "Loaded to Doc Builder", description: "Proposal and firm info pre-filled as field values." });
      setLocation("/doc-builder");
    } catch (e: unknown) {
      toast({ title: "Failed to load to Doc Builder", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsLoadingDocBuilder(false);
    }
  };

  const grandTotal = proposal.phases.reduce((sum, ph) => sum + phaseTotal(ph), 0);
  const isActionable = proposal.status !== "Signed" && proposal.status !== "Declined";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-proposals">
          <ArrowLeft className="w-4 h-4" />
          Proposals
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadToDocBuilder}
            disabled={isLoadingDocBuilder}
            data-testid="button-load-proposal-to-doc-builder"
          >
            <FileText className="w-4 h-4" />
            {isLoadingDocBuilder ? "Loading..." : "Load to Doc Builder"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)} data-testid="button-edit-proposal">
            <Edit className="w-4 h-4" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(true)} data-testid="button-delete-proposal">
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Proposal card */}
      <div className="rounded-md border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge
                variant="secondary"
                className={STATUS_COLORS[proposal.status as ProposalStatus] || ""}
                data-testid="badge-proposal-status"
              >
                {proposal.status}
              </Badge>
            </div>
            <h2 className="text-lg font-semibold" data-testid="text-proposal-name">{proposal.name}</h2>
            {proposal.description && (
              <p className="text-sm text-muted-foreground mt-1">{proposal.description}</p>
            )}
          </div>
          {grandTotal > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total Fee</p>
              <p className="text-xl font-semibold" data-testid="text-proposal-total">{fmt(grandTotal.toFixed(2))}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 pt-3 border-t text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Created</p>
            <p>{fmtDate(proposal.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Sent</p>
            <p>{fmtDate(proposal.dateSent)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Signed</p>
            <p>{fmtDate(proposal.dateSigned)}</p>
          </div>
        </div>

        {proposal.docUrl && (
          <div className="pt-2 border-t">
            <a href={proposal.docUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary">
              <ExternalLink className="w-3.5 h-3.5" />
              View Document
            </a>
          </div>
        )}

        {/* Status actions */}
        {isActionable && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSignConfirm(true)}
              disabled={signMutation.isPending}
              data-testid="button-sign-proposal"
            >
              <Check className="w-3.5 h-3.5" />
              Mark as Signed
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => declineMutation.mutate()}
              disabled={declineMutation.isPending}
              data-testid="button-decline-proposal"
              className="text-destructive border-destructive/30"
            >
              <X className="w-3.5 h-3.5" />
              Mark as Declined
            </Button>
          </div>
        )}
      </div>

      {/* Fee breakdown */}
      {proposal.phases.length > 0 && (
        <div className="rounded-md border bg-card">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold">Fee Breakdown</h3>
            {grandTotal > 0 && (
              <span className="text-sm font-semibold">Total: {fmt(grandTotal.toFixed(2))}</span>
            )}
          </div>
          <div className="divide-y">
            {proposal.phases.map((phase) => {
              const total = phaseTotal(phase);
              return (
                <div key={phase.id}>
                  <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20">
                    <span className="text-sm font-medium">{phase.name}</span>
                    {total > 0 && <span className="text-sm font-medium">{fmt(total.toFixed(2))}</span>}
                  </div>
                  <div className="divide-y">
                    {SERVICE_CATEGORIES.map((cat) => {
                      const catLines = phase.feeLines.filter((fl) => fl.serviceCategory === cat);
                      if (catLines.every((fl) => !fl.amount && fl.feeType !== "Hourly")) return null;
                      return (
                        <div key={cat}>
                          <div className="px-4 py-1.5 bg-muted/10">
                            <span className="text-xs font-medium text-muted-foreground">{cat}</span>
                          </div>
                          <div className="divide-y">
                            {catLines.map((fl) => {
                              if (!fl.amount && fl.feeType !== "Hourly") return null;
                              return (
                                <div key={fl.id} className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 text-sm">
                                  <span className="text-muted-foreground pl-2">{fl.discipline}</span>
                                  <Badge variant="secondary" className="text-xs">{fl.feeType}</Badge>
                                  <span className="font-medium text-right min-w-[80px]">
                                    {fl.feeType === "Hourly" ? <span className="text-muted-foreground italic text-xs">Hourly</span> : fmt(fl.amount)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <ProposalFormDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        leadId={leadId}
        existing={proposal}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Proposal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{proposal.name}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-proposal"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showSignConfirm} onOpenChange={setShowSignConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Proposal as Signed</AlertDialogTitle>
            <AlertDialogDescription>
              Signing this proposal will automatically advance the lead status to "Active Project". Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { signMutation.mutate(); setShowSignConfirm(false); }}
              data-testid="button-confirm-sign"
            >
              Sign Proposal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
