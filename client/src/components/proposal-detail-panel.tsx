import { useEffect, useRef, useState } from "react";
import { useIsMutating, useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ExternalLink, Check, X, Edit, Trash2, ArrowLeft, FileText, ScrollText, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useWorkspace } from "@/lib/workspace";
import { formatCurrencyFlexOrDash } from "@/lib/utils";
import { ProposalFormDialog } from "@/components/proposal-form-dialog";
import { focusProjectControl } from "@/lib/project-focus";
import { scopeRefreshIds } from "@shared/proposal-scope";
import { AdditionalServicesFormDialog } from "@/components/additional-services-form-dialog";
import { GoogleDocsPicker, type PickedGoogleDoc } from "@/components/google-docs-picker";
import { useGooglePickerDialog } from "@/hooks/use-google-picker-dialog";
import {
  type ProposalWithPhases,
  type ProposalStatus,
  type ConsultantContract,
} from "@shared/schema";
import type { ProjectWork } from "@shared/project-work";

const STATUS_COLORS: Record<ProposalStatus, string> = {
  Draft: "bg-secondary text-secondary-foreground",
  Sent: "bg-muted text-muted-foreground",
  Revision: "bg-muted text-muted-foreground",
  Signed: "bg-foreground text-background",
  Declined: "bg-muted text-muted-foreground",
};

const fmt = formatCurrencyFlexOrDash;

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

interface ConsultantContractDialogProps {
  onOpenChange: (open: boolean) => void;
  proposalId: string;
  consultant: string;
  proposal: ProposalWithPhases;
  onGenerated: (contract: ConsultantContract) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onPendingChange?: (pending: boolean) => void;
}

function ConsultantContractDialog({
  onOpenChange,
  proposalId,
  consultant,
  proposal,
  onGenerated,
  onDirtyChange,
  onPendingChange,
}: ConsultantContractDialogProps) {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<PickedGoogleDoc | null>(null);
  const [outputName, setOutputName] = useState("");
  const [contractError, setContractError] = useState("");
  const pickerDialog = useGooglePickerDialog(onOpenChange);
  const dirtyCallback = useRef(onDirtyChange);
  dirtyCallback.current = onDirtyChange;

  const generateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest<{ docUrl: string; contract: ConsultantContract }>(
        "POST",
        `/api/proposals/${proposalId}/consultant-contracts/generate`,
        { consultant, templateId: selectedTemplate!.id, outputName }
      );
    },
    onMutate: () => onPendingChange?.(true),
    onSuccess: async (data) => {
      setContractError("");
      toast({ title: "Contract generated", description: `${consultant} contract created successfully.` });
      await queryClient.invalidateQueries({ queryKey: ["/api/proposals", proposalId, "consultant-contracts"] });
      onGenerated(data.contract);
      dirtyCallback.current?.(false);
      onOpenChange(false);
      setSelectedTemplate(null);
      setOutputName("");
    },
    onError: () => {
      setContractError("The document service could not complete this request. Confirm Google Docs access and try again.");
      toast({ title: "Failed to generate contract", description: "Check Google Docs access and retry.", variant: "destructive" });
    },
    onSettled: () => onPendingChange?.(false),
  });
  useEffect(() => { dirtyCallback.current?.(!!selectedTemplate || !!outputName.trim() || generateMutation.isPending); }, [selectedTemplate, outputName, generateMutation.isPending]);

  const consultantRows = proposal.phases.flatMap(phase =>
    phase.feeLines
      .filter(fl => fl.consultant === consultant && (fl.amount || fl.feeType === "Hourly"))
      .map(fl => ({ phase: phase.name, feeType: fl.feeType, amount: fl.amount }))
  );

  const consultantTotal = consultantRows.reduce((sum, row) => {
    if (row.feeType === "Fixed" && row.amount) {
      const n = parseFloat(row.amount);
      return isNaN(n) ? sum : sum + n;
    }
    return sum;
  }, 0);

  const canGenerate = selectedTemplate && outputName.trim();
  const closeEditor = () => {
    if (generateMutation.isPending) return;
    if ((selectedTemplate || outputName.trim()) && !window.confirm("Discard the consultant contract setup?")) return;
    dirtyCallback.current?.(false);
    onOpenChange(false);
  };

  return (
    <section className="rounded-lg border bg-card p-4 sm:p-6" data-testid="section-consultant-contract">
      <div className="mb-5">
          <h3 className="text-base font-semibold" data-testid="text-contract-dialog-title">Generate Consultant Contract</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Generating contract for <span className="font-medium text-foreground">{consultant}</span>
          </p>
      </div>

        <div className="space-y-5">
          {/* Data preview */}
          <div className="rounded-md border bg-muted/20 p-3 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Contract Data Preview</p>
            {consultantRows.length === 0 ? (
              <p className="text-xs text-muted-foreground">No fee lines found for this consultant.</p>
            ) : (
              <div className="space-y-1">
                {consultantRows.map((row, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-3 text-xs">
                    <span className="text-muted-foreground">{row.phase}</span>
                    <Badge variant="secondary" className="text-xs">{row.feeType}</Badge>
                    <span className="text-right font-medium min-w-[70px]">
                      {row.feeType === "Hourly" ? <span className="italic text-muted-foreground">Hourly</span> : fmt(row.amount)}
                    </span>
                  </div>
                ))}
                {consultantTotal > 0 && (
                  <div className="pt-1 border-t flex justify-between text-xs font-semibold">
                    <span>Total</span>
                    <span>{fmt(consultantTotal.toFixed(2))}</span>
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground pt-1">
              Fields populated: <code className="font-mono">{"{{consultant_name}}"}</code>, <code className="font-mono">{"{{consultant_total}}"}</code>, <code className="font-mono">{"{{consultant_phases_table}}"}</code>
            </p>
          </div>

          {/* Output name */}
          <div className="space-y-1.5">
            <Label htmlFor="contract-output-name" className="text-xs uppercase tracking-wide">Document Name</Label>
            <Input
              id="contract-output-name"
              placeholder={`${proposal.name} - ${consultant} Contract`}
              value={outputName}
              onChange={e => setOutputName(e.target.value)}
              data-testid="input-contract-output-name"
            />
          </div>

          {/* Template picker */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide">Template</Label>
            <GoogleDocsPicker
              selected={selectedTemplate}
              disabled={generateMutation.isPending}
              onSelect={setSelectedTemplate}
              onPickerOpenChange={pickerDialog.onPickerOpenChange}
            />
          </div>

          {/* Generate button */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" disabled={generateMutation.isPending} onClick={closeEditor} data-testid="button-cancel-contract">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => { setContractError(""); generateMutation.mutate(); }}
              disabled={!canGenerate || generateMutation.isPending}
              data-testid="button-generate-contract"
            >
              {generateMutation.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating...</>
              ) : (
                <><ScrollText className="w-3.5 h-3.5" />Generate Contract</>
              )}
            </Button>
          </div>
          {contractError && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Contract was not generated. {contractError} No document was linked; your selections remain here.</p>}
        </div>
    </section>
  );
}

interface Props {
  proposal: ProposalWithPhases;
  leadId: number;
  projectName?: string;
  onBack: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  guardedDirty?: boolean;
}

export function ProposalDetailPanel({ proposal, leadId, projectName, onBack, onDirtyChange, guardedDirty = false }: Props) {
  const proposalSaving = useIsMutating({ mutationKey: ["project-proposal-save", leadId] }) > 0;
  const { isOwner } = useWorkspace();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSignConfirm, setShowSignConfirm] = useState(false);
  const [isLoadingDocBuilder, setIsLoadingDocBuilder] = useState(false);
  const [contractDialogConsultant, setContractDialogConsultant] = useState<string | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [editorNotice, setEditorNotice] = useState("");
  const [contractPending, setContractPending] = useState(false);
  const [scopeError, setScopeError] = useState("");
  const canRefreshScope = !proposal.scopeLocked && ["Draft", "Revision"].includes(proposal.status);
  const { data: projectWork, isLoading: isProjectWorkLoading, isError: projectWorkError, refetch: refetchProjectWork } = useQuery<ProjectWork>({
    queryKey: ["/api/leads", leadId, "work"],
  });
  const refreshScopeMutation = useMutation({
    mutationFn: async () => {
      if (!projectWork) throw new Error("Project scope is still loading. Try again in a moment.");
      if (projectWork.needsReconciliation) throw new Error("Reconcile legacy project scope before refreshing a proposal.");
      const selectedPhaseIds = scopeRefreshIds(proposal.phases);
      if (canRefreshScope) {
        return apiRequest("POST", `/api/proposals/${proposal.id}/refresh-from-project`, { selectedPhaseIds });
      }
      return apiRequest("POST", `/api/leads/${leadId}/proposals`, {
        name: `${proposal.name} — Updated draft`,
        description: proposal.description || null,
        status: "Draft",
        selectedPhaseIds,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "proposals"] });
      toast({ title: canRefreshScope ? "Project scope refreshed" : "Updated draft created", description: canRefreshScope ? "The unissued proposal now uses current project inputs." : "The issued proposal remains unchanged." });
      setScopeError("");
    },
    onMutate: () => onDirtyChange?.(true),
    onSettled: () => onDirtyChange?.(false),
    onError: error => setScopeError(error instanceof Error ? error.message : "Could not refresh project scope."),
  });

  const { data: consultantContracts = [] } = useQuery<ConsultantContract[]>({
    queryKey: ["/api/proposals", proposal.id, "consultant-contracts"],
    enabled: proposal.status === "Signed",
  });

  const signMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/proposals/${proposal.id}/sign`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "proposals"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] }),
      ]);
      if (isAdditionalServices) {
        toast({ title: "Additional Services proposal signed" });
      } else {
        toast({ title: "Proposal signed — lead is now an Active Project" });
      }
    },
    onMutate: () => onDirtyChange?.(true),
    onSettled: () => onDirtyChange?.(false),
    onError: (err: Error) => {
      toast({ title: "Failed to sign proposal", description: err.message, variant: "destructive" });
    },
  });

  const declineMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/proposals/${proposal.id}/decline`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "proposals"] });
      toast({ title: "Proposal marked as declined" });
    },
    onMutate: () => onDirtyChange?.(true),
    onSettled: () => onDirtyChange?.(false),
    onError: (err: Error) => {
      toast({ title: "Failed to decline proposal", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/proposals/${proposal.id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "proposals"] });
      toast({ title: "Proposal deleted" });
      onBack();
    },
    onMutate: () => onDirtyChange?.(true),
    onSettled: () => onDirtyChange?.(false),
    onError: (err: Error) => {
      toast({ title: "Failed to delete proposal", description: err.message, variant: "destructive" });
    },
  });

  const handleLoadToDocBuilder = async () => {
    if (guardedDirty && !window.confirm("Load this proposal to Doc Builder and leave the current project edits? Unsaved changes will be discarded.")) return;
    setIsLoadingDocBuilder(true);
    try {
      const currentProposal = await apiRequest<ProposalWithPhases>("GET", `/api/proposals/${proposal.id}`);
      await apiRequest("DELETE", "/api/field-values/by-prefix", {
        prefixes: ["proposal_", "project_name", "_proposal_phases", "_additional_services"],
      });

      let profile: Record<string, string> | null = null;
      try {
        profile = await apiRequest("GET", "/api/profile");
      } catch {
        profile = null;
      }

      const currentTotal = currentProposal.proposalType === "Additional Services"
        ? (currentProposal.additionalLineItems || []).reduce((sum, item) => sum + (item.amount ? Number(item.amount) || 0 : 0), 0)
        : currentProposal.phases.reduce((sum, phase) => sum + phaseTotal(phase), 0);
      const totalStr = currentTotal > 0 ? `$${currentTotal.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "";

      const fieldMappings: { name: string; value: string }[] = [
        { name: "project_name", value: projectName || "" },
        { name: "proposal_name", value: currentProposal.name },
        { name: "proposal_total", value: totalStr },
        { name: "proposal_date", value: currentProposal.dateSent ? new Date(currentProposal.dateSent).toLocaleDateString() : new Date().toLocaleDateString() },
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

      const allWrites = [
        ...fieldMappings.filter((f) => f.value).map((f) =>
          apiRequest("POST", "/api/field-values/upsert-by-name", f)
        ),
      ];

      if (currentProposal.proposalType === "Additional Services") {
        const asRows = (currentProposal.additionalLineItems || []).map((item) => ({
          description: item.description,
          amount: item.amount,
        }));
        if (asRows.length > 0) {
          allWrites.push(
            apiRequest("POST", "/api/field-values/upsert-by-name", {
              name: "_additional_services_json",
              value: JSON.stringify(asRows),
            })
          );
        }
      } else {
        const phasesRows = currentProposal.phases.flatMap(phase => {
          const timeline = (phase as typeof phase & { timeline?: string | null }).timeline ?? null;
          return phase.feeLines.length
            ? phase.feeLines.map(fl => ({ phase: phase.name, timeline, consultant: fl.consultant, feeType: fl.feeType, amount: fl.amount }))
            : [{ phase: phase.name, timeline, consultant: "", feeType: "", amount: null }];
        });
        if (phasesRows.length > 0) {
          allWrites.push(
            apiRequest("POST", "/api/field-values/upsert-by-name", {
              name: "_proposal_phases_json",
              value: JSON.stringify(phasesRows),
            })
          );
        }
      }

      await Promise.all(allWrites);

      queryClient.invalidateQueries({ queryKey: ["/api/field-values"] });
      onDirtyChange?.(false);
      toast({ title: "Loaded to Doc Builder", description: "Proposal and firm info pre-filled as field values." });
      setLocation(`/doc-builder?returnTo=proposal&returnToId=${proposal.id}`);
    } catch {
      toast({ title: "Failed to load to Doc Builder", description: "Check the project and document service access, then retry.", variant: "destructive" });
    } finally {
      setIsLoadingDocBuilder(false);
    }
  };

  const isAdditionalServices = proposal.proposalType === "Additional Services";
  const grandTotal = isAdditionalServices
    ? (proposal.additionalLineItems || []).reduce((sum, item) => {
        if (!item.amount) return sum;
        const n = parseFloat(item.amount);
        return isNaN(n) ? sum : sum + n;
      }, 0)
    : proposal.phases.reduce((sum, ph) => sum + phaseTotal(ph), 0);
  const isActionable = proposal.status !== "Signed" && proposal.status !== "Declined";
  const startProposalEdit = () => {
    if (guardedDirty && !editorDirty) { setEditorNotice("Finish or cancel the open project edit before editing this proposal."); return; }
    if (contractDialogConsultant) { setEditorNotice("Close the consultant contract editor before editing proposal details."); return; }
    setEditorNotice("");
    setShowEdit(true);
    focusProjectControl(proposal.proposalType === "Additional Services" ? "#as-name" : "#proposal-name");
  };

  // Derive consultants with non-zero fees (for signed proposals)
  const activeConsultants = proposal.status === "Signed"
    ? Array.from(new Set(
        proposal.phases.flatMap(phase =>
          phase.feeLines
            .filter(fl => fl.amount || fl.feeType === "Hourly")
            .map(fl => fl.consultant)
        )
      ))
    : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button variant="ghost" size="sm" disabled={proposalSaving || signMutation.isPending || declineMutation.isPending || refreshScopeMutation.isPending || deleteMutation.isPending || contractPending} onClick={() => {
            if (queryClient.isMutating({ mutationKey: ["project-proposal-save", leadId] })) return;
            if (editorDirty && !window.confirm("Discard this proposal editor and return to the record list?")) return;
            setEditorDirty(false);
            onDirtyChange?.(false);
            onBack();
          }} data-testid="button-back-proposals">
          <ArrowLeft className="w-4 h-4" />
          Proposals
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadToDocBuilder}
            disabled={isLoadingDocBuilder || signMutation.isPending || declineMutation.isPending || refreshScopeMutation.isPending || deleteMutation.isPending || contractPending}
            data-testid="button-load-proposal-to-doc-builder"
          >
            <FileText className="w-4 h-4" />
            {isLoadingDocBuilder ? "Loading..." : "Load to Doc Builder"}
          </Button>
          {proposal.proposalType !== "Additional Services" && (
            <Button
              variant="outline"
              size="sm"
            onClick={() => { if (projectWorkError) void refetchProjectWork(); else refreshScopeMutation.mutate(); }}
            disabled={showEdit || refreshScopeMutation.isPending || isProjectWorkLoading || !!projectWork?.needsReconciliation}
              data-testid="button-refresh-project-scope"
            >
              <RotateCw className="mr-1.5 h-4 w-4" />
              {refreshScopeMutation.isPending
                ? "Updating…"
                : canRefreshScope
                  ? "Refresh from project"
                  : "Create updated draft"}
            </Button>
          )}
          <Button variant="outline" size="sm" disabled={showEdit || signMutation.isPending || declineMutation.isPending || refreshScopeMutation.isPending || deleteMutation.isPending || contractPending} onClick={startProposalEdit} data-testid="button-edit-proposal">
            <Edit className="w-4 h-4" />
            Edit
          </Button>
          {isOwner && <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(true)} data-testid="button-delete-proposal">
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>}
        </div>
      </div>
      {projectWork?.needsReconciliation && <p className="rounded-md border border-amber-500/40 bg-amber-50/60 px-3 py-2 text-xs text-muted-foreground dark:bg-amber-950/20">Reconcile legacy project scope before refreshing or creating an updated draft.</p>}
      {projectWorkError && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">Project phases could not load. Use “Refresh from project” to retry before changing proposal scope.</p>}
      {scopeError && <p role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{scopeError} The existing proposal has not been changed.</p>}
      {editorNotice && <p role="status" className="rounded-md border border-amber-500/30 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">{editorNotice}</p>}

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
              disabled={showEdit || signMutation.isPending}
              data-testid="button-sign-proposal"
            >
              <Check className="w-3.5 h-3.5" />
              Mark as Signed
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => declineMutation.mutate()}
              disabled={showEdit || declineMutation.isPending}
              data-testid="button-decline-proposal"
              className="text-destructive border-destructive/30"
            >
              <X className="w-3.5 h-3.5" />
              Mark as Declined
            </Button>
          </div>
        )}
      </div>

      {/* Fee breakdown — Standard proposals */}
      {!isAdditionalServices && proposal.phases.length > 0 && (
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
                    {phase.feeLines.map((fl) => (
                      <div key={fl.id} className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 text-sm">
                        <span className="text-muted-foreground">{fl.consultant}</span>
                        <Badge variant="secondary" className="text-xs">{fl.feeType}</Badge>
                        <span className="font-medium text-right min-w-[80px]">
                          {fl.feeType === "Hourly" ? <span className="text-muted-foreground italic text-xs">Hourly</span> : fmt(fl.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Line items — Additional Services proposals */}
      {isAdditionalServices && (proposal.additionalLineItems || []).length > 0 && (
        <div className="rounded-md border bg-card">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold">Scope of Services</h3>
            {grandTotal > 0 && (
              <span className="text-sm font-semibold">Total: {fmt(grandTotal.toFixed(2))}</span>
            )}
          </div>
          <div className="divide-y">
            {(proposal.additionalLineItems || []).map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto] gap-4 px-4 py-2.5 text-sm">
                <span>{item.description}</span>
                <span className="font-medium text-right min-w-[80px]">
                  {item.amount ? fmt(item.amount) : <span className="text-muted-foreground italic text-xs">—</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Consultant Contracts — only for signed proposals */}
      {proposal.status === "Signed" && activeConsultants.length > 0 && (
        <div className="rounded-md border bg-card" data-testid="section-consultant-contracts">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-semibold">Consultant Contracts</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Generate a contract document for each consultant from this signed proposal.
            </p>
          </div>
          <div className="divide-y">
            {activeConsultants.map((consultant) => {
              const contract = consultantContracts.find(c => c.consultant === consultant);
              const consultantTotal = proposal.phases.flatMap(ph => ph.feeLines)
                .filter(fl => fl.consultant === consultant && fl.feeType === "Fixed" && fl.amount)
                .reduce((sum, fl) => {
                  const n = parseFloat(fl.amount!);
                  return isNaN(n) ? sum : sum + n;
                }, 0);

              return (
                <div
                  key={consultant}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                  data-testid={`row-consultant-${consultant.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{consultant}</p>
                    {consultantTotal > 0 && (
                      <p className="text-xs text-muted-foreground">{fmt(consultantTotal.toFixed(2))}</p>
                    )}
                    {contract && (
                      <a
                        href={contract.docUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-0.5 hover:text-foreground"
                        data-testid={`link-contract-doc-${consultant.replace(/\s+/g, "-").toLowerCase()}`}
                      >
                        <ExternalLink className="w-3 h-3" />
                        View Contract — {fmtDate(contract.generatedAt)}
                      </a>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (showEdit || contractDialogConsultant || contractPending) return;
                      if (guardedDirty) { setEditorNotice("Finish or cancel the open project edit before starting a contract editor."); return; }
                      setEditorNotice("");
                      setEditorDirty(true);
                      onDirtyChange?.(true);
                      setContractDialogConsultant(consultant);
                    }}
                    disabled={showEdit || !!contractDialogConsultant || contractPending}
                    data-testid={`button-generate-contract-${consultant.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    <ScrollText className="w-3.5 h-3.5" />
                    {contract ? "Regenerate" : "Generate Contract"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dialogs */}
      {isAdditionalServices ? (
        <AdditionalServicesFormDialog
          open={showEdit}
          onOpenChange={open => { setShowEdit(open); if (!open) { setEditorDirty(false); onDirtyChange?.(false); focusProjectControl('[data-testid="button-edit-proposal"]'); } }}
          leadId={leadId}
          existing={proposal}
          inline
          onDirtyChange={dirty => { setEditorDirty(dirty); onDirtyChange?.(dirty); }}
        />
      ) : (
        <ProposalFormDialog
          open={showEdit}
          onOpenChange={open => { setShowEdit(open); if (!open) { setEditorDirty(false); onDirtyChange?.(false); focusProjectControl('[data-testid="button-edit-proposal"]'); } }}
          leadId={leadId}
          existing={proposal}
          onSaved={() => setScopeError("")}
          inline
          onDirtyChange={dirty => { setEditorDirty(dirty); onDirtyChange?.(dirty); }}
        />
      )}

      {contractDialogConsultant && (
        <ConsultantContractDialog
          onOpenChange={(v) => { if (!v) { const trigger = contractDialogConsultant.replace(/\s+/g, "-").toLowerCase(); setEditorDirty(false); setContractPending(false); onDirtyChange?.(false); setContractDialogConsultant(null); focusProjectControl(`[data-testid="${CSS.escape("button-generate-contract-" + trigger)}"]`); } }}
          proposalId={proposal.id}
          consultant={contractDialogConsultant}
          proposal={proposal}
          onGenerated={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/proposals", proposal.id, "consultant-contracts"] });
          }}
          onDirtyChange={dirty => { setEditorDirty(dirty); onDirtyChange?.(dirty); }}
          onPendingChange={setContractPending}
        />
      )}

      {isOwner && <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
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
      </AlertDialog>}

      <AlertDialog open={showSignConfirm} onOpenChange={setShowSignConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Proposal as Signed</AlertDialogTitle>
            <AlertDialogDescription>
              {isAdditionalServices
                ? "Mark this Additional Services proposal as signed? This will not change the project status."
                : "Signing this proposal will automatically advance the lead status to \"Active Project\". Continue?"}
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
