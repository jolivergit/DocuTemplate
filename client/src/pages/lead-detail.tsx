import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  ChevronLeft,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Edit,
  Trash2,
  ChevronDown,
  ChevronRight,
  Plus,
  FileText,
  MessageSquare,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { LeadFormDialog } from "@/components/lead-form-dialog";
import { ProposalFormDialog } from "@/components/proposal-form-dialog";
import { ProposalDetailPanel } from "@/components/proposal-detail-panel";
import { InvoiceBuilderPanel } from "@/components/invoice-builder-panel";
import { InvoiceDetailPanel } from "@/components/invoice-detail-panel";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type {
  LeadWithCompanies,
  LeadStatus,
  LeadProbability,
  CompanyRole,
  ProposalWithPhases,
  ProposalStatus,
  Invoice,
  ProjectComment,
} from "@shared/schema";
import { COMPANY_ROLE_LABELS, LEAD_STATUSES } from "@shared/schema";

const STATUS_COLORS: Record<LeadStatus, string> = {
  Lead: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  Proposal: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "Active Project": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  Completed: "bg-secondary text-secondary-foreground",
  Lost: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const PROBABILITY_COLORS: Record<LeadProbability, string> = {
  LOW: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  HIGH: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

const PROPOSAL_STATUS_COLORS: Record<ProposalStatus, string> = {
  Draft: "bg-secondary text-secondary-foreground",
  Sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  Revision: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  Signed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  Declined: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const INVOICE_STATUS_COLORS: Record<string, string> = {
  Draft: "bg-secondary text-secondary-foreground",
  Sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  Paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

function formatCurrency(value: string | null | undefined): string {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num);
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm" data-testid={`text-detail-${label.toLowerCase().replace(/\s+/g, "-")}`}>
        {value || <span className="text-muted-foreground">—</span>}
      </p>
    </div>
  );
}

function CompanySection({ role, company }: { role: CompanyRole; company?: { companyName?: string | null; addressLine1?: string | null; addressLine2?: string | null; city?: string | null; state?: string | null; zip?: string | null; contactFullName?: string | null; contactTitle?: string | null; contactPhone?: string | null; contactEmail?: string | null } | null }) {
  const [open, setOpen] = useState(false);
  const label = COMPANY_ROLE_LABELS[role];
  const hasData = company && (company.companyName || company.contactFullName);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className="w-full flex items-center justify-between py-3 px-4 rounded-md hover-elevate text-left"
          data-testid={`button-company-${role}`}
        >
          <div className="flex items-center gap-3">
            <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div>
              <span className="text-sm font-medium">{label}</span>
              {hasData && (
                <p className="text-xs text-muted-foreground">{company?.companyName || company?.contactFullName}</p>
              )}
            </div>
          </div>
          {open ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {!hasData ? (
          <p className="text-xs text-muted-foreground px-4 pb-3">No information provided</p>
        ) : (
          <div className="px-4 pb-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <DetailField label="Company Name" value={company?.companyName} />
              <div />
              {(company?.addressLine1 || company?.city) && (
                <>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground mb-0.5">Address</p>
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        {company?.addressLine1 && <p>{company.addressLine1}</p>}
                        {company?.addressLine2 && <p>{company.addressLine2}</p>}
                        {(company?.city || company?.state || company?.zip) && (
                          <p>
                            {[company?.city, company?.state, company?.zip].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {(company?.contactFullName || company?.contactPhone || company?.contactEmail) && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Primary Contact</p>
                  <div className="space-y-2">
                    {company?.contactFullName && (
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        <div>
                          <span className="text-sm">{company.contactFullName}</span>
                          {company?.contactTitle && (
                            <span className="text-xs text-muted-foreground ml-1">· {company.contactTitle}</span>
                          )}
                        </div>
                      </div>
                    )}
                    {company?.contactPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                        <a href={`tel:${company.contactPhone}`} className="text-sm text-primary" data-testid={`link-phone-${role}`}>
                          {company.contactPhone}
                        </a>
                      </div>
                    )}
                    {company?.contactEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                        <a href={`mailto:${company.contactEmail}`} className="text-sm text-primary" data-testid={`link-email-${role}`}>
                          {company.contactEmail}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Proposals Tab ─────────────────────────────────────────────────────────────

function ProposalsTab({ leadId }: { leadId: number }) {
  const { toast } = useToast();
  const [showNew, setShowNew] = useState(false);
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
        onBack={() => setSelectedProposal(null)}
      />
    );
  }

  const grandTotal = (proposal: ProposalWithPhases) =>
    proposal.phases.reduce((sum, ph) =>
      sum + ph.feeLines.reduce((s, fl) => {
        if (fl.feeType === "Fixed" && fl.amount) {
          const n = parseFloat(fl.amount);
          return isNaN(n) ? s : s + n;
        }
        return s;
      }, 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {proposals.length === 0 ? "No proposals yet" : `${proposals.length} proposal${proposals.length !== 1 ? "s" : ""}`}
        </p>
        <Button size="sm" onClick={() => setShowNew(true)} data-testid="button-new-proposal">
          <Plus className="w-3.5 h-3.5" />
          New Proposal
        </Button>
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
                  </div>
                  <p className="text-sm font-medium">{proposal.name}</p>
                  {proposal.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{proposal.description}</p>
                  )}
                </div>
                {total > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total Fee</p>
                    <p className="text-sm font-semibold">{formatCurrency(total.toFixed(2))}</p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Created {new Date(proposal.createdAt).toLocaleDateString()}</span>
                {proposal.dateSent && <span>Sent {new Date(proposal.dateSent).toLocaleDateString()}</span>}
                {proposal.dateSigned && <span>Signed {new Date(proposal.dateSigned).toLocaleDateString()}</span>}
                <span>{proposal.phases.length} phase{proposal.phases.length !== 1 ? "s" : ""}</span>
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
    </div>
  );
}

// ─── Project Tab ───────────────────────────────────────────────────────────────

type ProjectView = { type: "list" } | { type: "builder"; proposal: ProposalWithPhases } | { type: "invoice"; invoiceId: string };

function ProjectTab({ leadId, lead }: { leadId: number; lead: LeadWithCompanies }) {
  const { toast } = useToast();
  const [view, setView] = useState<ProjectView>({ type: "list" });
  const [commentText, setCommentText] = useState("");

  const { data: proposals = [] } = useQuery<ProposalWithPhases[]>({
    queryKey: ["/api/leads", leadId, "proposals"],
    queryFn: async () => {
      const r = await fetch(`/api/leads/${leadId}/proposals`);
      if (!r.ok) throw new Error("Failed to load proposals");
      return r.json();
    },
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/leads", leadId, "invoices"],
    queryFn: async () => {
      const r = await fetch(`/api/leads/${leadId}/invoices`);
      if (!r.ok) throw new Error("Failed to load invoices");
      return r.json();
    },
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery<ProjectComment[]>({
    queryKey: ["/api/leads", leadId, "comments"],
    queryFn: async () => {
      const r = await fetch(`/api/leads/${leadId}/comments`);
      if (!r.ok) throw new Error("Failed to load comments");
      return r.json();
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/leads/${leadId}/comments`, { content: commentText.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "comments"] });
      setCommentText("");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add comment", description: err.message, variant: "destructive" });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => apiRequest("DELETE", `/api/leads/${leadId}/comments/${commentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "comments"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete comment", description: err.message, variant: "destructive" });
    },
  });

  const signedProposal = proposals.find((p) => p.status === "Signed");

  if (view.type === "builder" && signedProposal) {
    return (
      <InvoiceBuilderPanel
        leadId={leadId}
        proposal={signedProposal}
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
    <div className="space-y-6">
      {/* Signed proposal note */}
      {!signedProposal && (
        <div className="rounded-md border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 p-4">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            No signed proposal yet. Sign a proposal on the Proposals tab to start creating invoices.
          </p>
        </div>
      )}

      {/* Invoices */}
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

      {/* Comments */}
      <div className="rounded-md border bg-card">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Project Comments</h3>
        </div>

        <div className="p-4 space-y-2">
          <Textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a project note…"
            rows={2}
            data-testid="input-comment"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => addCommentMutation.mutate()}
              disabled={!commentText.trim() || addCommentMutation.isPending}
              data-testid="button-add-comment"
            >
              <Send className="w-3.5 h-3.5" />
              {addCommentMutation.isPending ? "Posting…" : "Post"}
            </Button>
          </div>
        </div>

        <Separator />

        {commentsLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : comments.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground text-center">No comments yet.</p>
        ) : (
          <div className="divide-y">
            {comments.map((c) => (
              <div key={c.id} className="px-4 py-3 space-y-1 group" data-testid={`comment-${c.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deleteCommentMutation.mutate(c.id)}
                    data-testid={`button-delete-comment-${c.id}`}
                  >
                    <Trash2 className="w-3 h-3 text-muted-foreground" />
                  </Button>
                </div>
                <p className="text-sm whitespace-pre-wrap">{c.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

interface Props {
  params: { id: string };
}

export default function LeadDetailPage({ params }: Props) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const leadId = parseInt(params.id, 10);

  const { data: lead, isLoading } = useQuery<LeadWithCompanies>({
    queryKey: ["/api/leads", leadId],
    queryFn: async () => {
      const r = await fetch(`/api/leads/${leadId}`);
      if (!r.ok) throw new Error(`Failed to load lead: ${r.status}`);
      return r.json() as Promise<LeadWithCompanies>;
    },
    enabled: !isNaN(leadId),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/leads/${leadId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Lead deleted" });
      navigate("/leads");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete lead", description: err.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) =>
      apiRequest("PATCH", `/api/leads/${leadId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
      toast({ title: "Status updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
    },
  });

  if (isNaN(leadId)) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Invalid lead ID</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-md" />
        <Skeleton className="h-48 w-full rounded-md" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Lead not found</p>
      </div>
    );
  }

  const companyMap = new Map(lead.companies.map((c) => [c.companyRole, c]));
  const isProject = lead.status === "Active Project" || lead.status === "Completed";

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full p-6 space-y-6">
        {/* Back + actions header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Link href="/leads">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ChevronLeft className="w-4 h-4" />
              Leads
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEdit(true)}
              data-testid="button-edit-lead"
            >
              <Edit className="w-4 h-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDelete(true)}
              data-testid="button-delete-lead"
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>

        {/* Lead header card */}
        <div className="rounded-md border bg-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-muted-foreground" data-testid="text-lead-id">
                  #{lead.id}
                </span>
                <Badge
                  variant="secondary"
                  className={STATUS_COLORS[lead.status as LeadStatus] || ""}
                  data-testid="badge-status"
                >
                  {lead.status}
                </Badge>
                <Badge
                  variant="secondary"
                  className={PROBABILITY_COLORS[lead.probability as LeadProbability] || ""}
                  data-testid="badge-probability"
                >
                  {lead.probability}
                </Badge>
              </div>
              <h1 className="text-xl font-semibold" data-testid="text-project-name">{lead.projectName}</h1>
              {lead.description && (
                <p className="text-sm text-muted-foreground mt-1" data-testid="text-description">{lead.description}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t">
            <DetailField label="Square Footage" value={lead.squareFootage ? Number(lead.squareFootage).toLocaleString() + " sq ft" : null} />
            <DetailField label="Potential Fee" value={formatCurrency(lead.potentialFee)} />
            <DetailField label="Created" value={new Date(lead.createdAt).toLocaleDateString()} />
          </div>
        </div>

        {/* Status progression */}
        <div className="rounded-md border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">Update Status</p>
          <div className="flex flex-wrap gap-2">
            {LEAD_STATUSES.map((s) => (
              <Button
                key={s}
                variant={lead.status === s ? "default" : "outline"}
                size="sm"
                onClick={() => lead.status !== s && updateStatusMutation.mutate(s)}
                disabled={updateStatusMutation.isPending}
                data-testid={`button-status-${s.replace(/\s+/g, "-").toLowerCase()}`}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList className={`w-full ${isProject ? "grid grid-cols-3" : "grid grid-cols-2"}`}>
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="proposals" data-testid="tab-proposals">Proposals</TabsTrigger>
            {isProject && (
              <TabsTrigger value="project" data-testid="tab-project">Project</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="rounded-md border bg-card">
              <div className="px-4 py-3 border-b">
                <h2 className="text-sm font-semibold">Associated Companies</h2>
              </div>
              <div className="divide-y">
                {(["ContractHolder", "Client", "MEP", "Structural", "EquipmentVendor", "FurnitureVendor"] as CompanyRole[]).map((role) => (
                  <CompanySection key={role} role={role} company={companyMap.get(role)} />
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="proposals" className="mt-6">
            <ProposalsTab leadId={leadId} />
          </TabsContent>

          {isProject && (
            <TabsContent value="project" className="mt-6">
              <ProjectTab leadId={leadId} lead={lead} />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Edit dialog */}
      <LeadFormDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        lead={lead}
      />

      {/* Delete confirm */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent data-testid="dialog-delete-lead">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{lead.projectName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
