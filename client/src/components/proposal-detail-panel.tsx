import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ExternalLink, Check, X, Edit, Trash2, ArrowLeft, FileText, ScrollText, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  type ProposalWithPhases,
  type ProposalStatus,
  type ConsultantContract,
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

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

interface ConsultantContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: string;
  consultant: string;
  proposal: ProposalWithPhases;
  onGenerated: (contract: ConsultantContract) => void;
}

function ConsultantContractDialog({
  open,
  onOpenChange,
  proposalId,
  consultant,
  proposal,
  onGenerated,
}: ConsultantContractDialogProps) {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<GoogleDriveFile | null>(null);
  const [outputName, setOutputName] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");

  const { data: files = [], isLoading: filesLoading } = useQuery<GoogleDriveFile[]>({
    queryKey: ["/api/google-drive/files"],
    enabled: open,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest<{ docUrl: string; contract: ConsultantContract }>(
        "POST",
        `/api/proposals/${proposalId}/consultant-contracts/generate`,
        { consultant, templateId: selectedTemplate!.id, outputName }
      );
    },
    onSuccess: (data) => {
      toast({ title: "Contract generated", description: `${consultant} contract created successfully.` });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals", proposalId, "consultant-contracts"] });
      onGenerated(data.contract);
      onOpenChange(false);
      setSelectedTemplate(null);
      setOutputName("");
      setTemplateSearch("");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to generate contract", description: err.message, variant: "destructive" });
    },
  });

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

  const filteredFiles = files.filter(f =>
    f.name.toLowerCase().includes(templateSearch.toLowerCase())
  );

  const canGenerate = selectedTemplate && outputName.trim();

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) { setSelectedTemplate(null); setOutputName(""); setTemplateSearch(""); }
      onOpenChange(v);
    }}>
      <DialogContent className="max-w-lg" data-testid="dialog-consultant-contract">
        <DialogHeader>
          <DialogTitle data-testid="text-contract-dialog-title">Generate Consultant Contract</DialogTitle>
          <DialogDescription>
            Generating contract for <span className="font-medium text-foreground">{consultant}</span>
          </DialogDescription>
        </DialogHeader>

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
            {selectedTemplate ? (
              <div className="flex items-center gap-2 rounded-md border p-2.5">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm flex-1 truncate" data-testid="text-selected-template">{selectedTemplate.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedTemplate(null)}
                  data-testid="button-clear-template"
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <div className="p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search templates..."
                      value={templateSearch}
                      onChange={e => setTemplateSearch(e.target.value)}
                      className="pl-8 h-8 text-xs"
                      data-testid="input-template-search"
                    />
                  </div>
                </div>
                <ScrollArea className="h-44">
                  {filesLoading ? (
                    <div className="flex items-center justify-center h-full py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredFiles.length === 0 ? (
                    <div className="flex items-center justify-center h-full py-6">
                      <p className="text-xs text-muted-foreground">No templates found</p>
                    </div>
                  ) : (
                    <div className="p-1.5 space-y-0.5">
                      {filteredFiles.map(file => (
                        <button
                          key={file.id}
                          onClick={() => setSelectedTemplate(file)}
                          className="w-full flex items-center gap-2.5 p-2 rounded text-left hover-elevate active-elevate-2"
                          data-testid={`button-template-${file.id}`}
                        >
                          <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">Modified {new Date(file.modifiedTime).toLocaleDateString()}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Generate button */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} data-testid="button-cancel-contract">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => generateMutation.mutate()}
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
        </div>
      </DialogContent>
    </Dialog>
  );
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
  const [contractDialogConsultant, setContractDialogConsultant] = useState<string | null>(null);

  const { data: consultantContracts = [] } = useQuery<ConsultantContract[]>({
    queryKey: ["/api/proposals", proposal.id, "consultant-contracts"],
    enabled: proposal.status === "Signed",
  });

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
      await fetch("/api/field-values/by-prefix", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: ["proposal_", "project_name", "_proposal_phases"] }),
      });

      const grandTotal = proposal.phases.reduce((sum, ph) => sum + phaseTotal(ph), 0);

      const profileRes = await fetch("/api/profile");
      const profile = profileRes.ok ? await profileRes.json() : null;

      const fieldMappings: { name: string; value: string }[] = [
        { name: "project_name", value: projectName || "" },
        { name: "proposal_name", value: proposal.name },
        { name: "proposal_total", value: grandTotal > 0 ? `$${grandTotal.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "" },
        { name: "proposal_date", value: proposal.dateSent ? new Date(proposal.dateSent).toLocaleDateString() : new Date().toLocaleDateString() },
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

      const phasesRows = proposal.phases.flatMap(phase =>
        phase.feeLines.map(fl => ({
          phase: phase.name,
          consultant: fl.consultant,
          feeType: fl.feeType,
          amount: fl.amount,
        }))
      );

      const allWrites = [
        ...fieldMappings.filter((f) => f.value).map((f) =>
          fetch("/api/field-values/upsert-by-name", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(f),
          })
        ),
        phasesRows.length > 0
          ? fetch("/api/field-values/upsert-by-name", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: "_proposal_phases_json", value: JSON.stringify(phasesRows) }),
            })
          : Promise.resolve(),
      ];

      await Promise.all(allWrites);

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
                    onClick={() => setContractDialogConsultant(consultant)}
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
      <ProposalFormDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        leadId={leadId}
        existing={proposal}
      />

      {contractDialogConsultant && (
        <ConsultantContractDialog
          open={!!contractDialogConsultant}
          onOpenChange={(v) => { if (!v) setContractDialogConsultant(null); }}
          proposalId={proposal.id}
          consultant={contractDialogConsultant}
          proposal={proposal}
          onGenerated={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/proposals", proposal.id, "consultant-contracts"] });
          }}
        />
      )}

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
