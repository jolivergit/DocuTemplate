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
  Clock,
  Receipt,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Contact,
  HoursEntry,
  ExpenseEntry,
} from "@shared/schema";
import { COMPANY_ROLE_LABELS, EXPENSE_TYPES, LEAD_STATUSES } from "@shared/schema";

const STATUS_COLORS: Record<LeadStatus, string> = {
  Lead: "bg-secondary text-secondary-foreground",
  Proposal: "bg-secondary text-secondary-foreground",
  "Active Project": "bg-secondary text-secondary-foreground",
  Completed: "bg-secondary text-secondary-foreground",
  Lost: "bg-secondary text-secondary-foreground",
};

const PROBABILITY_COLORS: Record<LeadProbability, string> = {
  LOW: "bg-secondary text-secondary-foreground",
  MEDIUM: "bg-secondary text-secondary-foreground",
  HIGH: "bg-secondary text-secondary-foreground",
};

const PROPOSAL_STATUS_COLORS: Record<ProposalStatus, string> = {
  Draft: "bg-secondary text-secondary-foreground",
  Sent: "bg-secondary text-secondary-foreground",
  Revision: "bg-secondary text-secondary-foreground",
  Signed: "bg-secondary text-secondary-foreground",
  Declined: "bg-secondary text-secondary-foreground",
};

const INVOICE_STATUS_COLORS: Record<string, string> = {
  Draft: "bg-secondary text-secondary-foreground",
  Sent: "bg-secondary text-secondary-foreground",
  Paid: "bg-secondary text-secondary-foreground",
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

function CompanySection({ role, company }: {
  role: CompanyRole;
  company?: {
    companyName?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    linkedContact?: Contact | null;
  } | null;
}) {
  const [open, setOpen] = useState(false);
  const label = COMPANY_ROLE_LABELS[role];
  const contact = company?.linkedContact;
  const hasData = company && (company.companyName || contact);

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
                <p className="text-xs text-muted-foreground">{company?.companyName || contact?.fullName}</p>
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

            {contact && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Primary Contact</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      <div>
                        <span className="text-sm">{contact.fullName}</span>
                        {contact.title && (
                          <span className="text-xs text-muted-foreground ml-1">· {contact.title}</span>
                        )}
                      </div>
                    </div>
                    {contact.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                        <a href={`tel:${contact.phone}`} className="text-sm" data-testid={`link-phone-${role}`}>
                          {contact.phone}
                        </a>
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                        <a href={`mailto:${contact.email}`} className="text-sm" data-testid={`link-email-${role}`}>
                          {contact.email}
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

function ProposalsTab({ leadId, projectName }: { leadId: number; projectName: string }) {
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
        projectName={projectName}
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

// ─── Time & Expenses Tab ────────────────────────────────────────────────────────

const MILEAGE_RATE_DEFAULT = "0.67";

function calcExpenseAmount(e: ExpenseEntry): number {
  if (e.expenseType === "Mileage") {
    return (parseFloat(e.milesTraveled || "0") || 0) * (parseFloat(e.ratePerMile || "0") || 0);
  }
  return parseFloat(e.amount || "0") || 0;
}

function TimeExpensesTab({ leadId }: { leadId: number }) {
  const { toast } = useToast();

  const { data: allHours = [], isLoading: hoursLoading } = useQuery<HoursEntry[]>({
    queryKey: ["/api/leads", leadId, "hours"],
    queryFn: async () => {
      const r = await fetch(`/api/leads/${leadId}/hours`);
      if (!r.ok) throw new Error("Failed to load hours");
      return r.json();
    },
  });

  const { data: allExpenses = [], isLoading: expensesLoading } = useQuery<ExpenseEntry[]>({
    queryKey: ["/api/leads", leadId, "expenses"],
    queryFn: async () => {
      const r = await fetch(`/api/leads/${leadId}/expenses`);
      if (!r.ok) throw new Error("Failed to load expenses");
      return r.json();
    },
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/leads", leadId, "invoices"],
    queryFn: async () => {
      const r = await fetch(`/api/leads/${leadId}/invoices`);
      if (!r.ok) throw new Error("Failed to load invoices");
      return r.json();
    },
  });

  const invoiceMap = new Map(invoices.map((inv) => [inv.id, inv.invoiceNumber]));

  // Hours form state (add)
  const [showHoursForm, setShowHoursForm] = useState(false);
  const [hDate, setHDate] = useState("");
  const [hDesc, setHDesc] = useState("");
  const [hHours, setHHours] = useState("");
  const [hRate, setHRate] = useState("");

  // Hours edit state
  const [editingHoursId, setEditingHoursId] = useState<string | null>(null);
  const [ehDate, setEhDate] = useState("");
  const [ehDesc, setEhDesc] = useState("");
  const [ehHours, setEhHours] = useState("");
  const [ehRate, setEhRate] = useState("");

  // Expense form state (add)
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [eDate, setEDate] = useState("");
  const [eType, setEType] = useState<string>("Parking");
  const [eMiles, setEMiles] = useState("");
  const [eRatePerMile, setERatePerMile] = useState(MILEAGE_RATE_DEFAULT);
  const [eAmount, setEAmount] = useState("");

  // Expense edit state
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [eeDate, setEeDate] = useState("");
  const [eeType, setEeType] = useState<string>("Parking");
  const [eeMiles, setEeMiles] = useState("");
  const [eeRatePerMile, setEeRatePerMile] = useState(MILEAGE_RATE_DEFAULT);
  const [eeAmount, setEeAmount] = useState("");

  function startEditHours(h: HoursEntry) {
    setEditingHoursId(h.id);
    setEhDate(h.date);
    setEhDesc(h.description);
    setEhHours(h.hours);
    setEhRate(h.ratePerHour);
  }

  function startEditExpense(e: ExpenseEntry) {
    setEditingExpenseId(e.id);
    setEeDate(e.date);
    setEeType(e.expenseType);
    setEeMiles(e.milesTraveled || "");
    setEeRatePerMile(e.ratePerMile || MILEAGE_RATE_DEFAULT);
    setEeAmount(e.amount || "");
  }

  const addHoursMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/leads/${leadId}/hours`, {
        date: hDate,
        description: hDesc,
        hours: hHours,
        ratePerHour: hRate,
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "hours"] });
      setShowHoursForm(false);
      setHDate(""); setHDesc(""); setHHours(""); setHRate("");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add hours", description: err.message, variant: "destructive" });
    },
  });

  const addExpenseMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string | undefined> = { date: eDate, expenseType: eType };
      if (eType === "Mileage") {
        body.milesTraveled = eMiles;
        body.ratePerMile = eRatePerMile;
      } else {
        body.amount = eAmount;
      }
      const r = await apiRequest("POST", `/api/leads/${leadId}/expenses`, body);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "expenses"] });
      setShowExpenseForm(false);
      setEDate(""); setEType("Parking"); setEMiles(""); setERatePerMile(MILEAGE_RATE_DEFAULT); setEAmount("");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add expense", description: err.message, variant: "destructive" });
    },
  });

  const updateHoursMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("PATCH", `/api/hours/${id}`, {
        date: ehDate,
        description: ehDesc,
        hours: ehHours,
        ratePerHour: ehRate,
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "hours"] });
      setEditingHoursId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update hours entry", description: err.message, variant: "destructive" });
    },
  });

  const deleteHoursMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hours/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "hours"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete entry", description: err.message, variant: "destructive" });
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      const body: Record<string, string | undefined> = { date: eeDate, expenseType: eeType };
      if (eeType === "Mileage") {
        body.milesTraveled = eeMiles;
        body.ratePerMile = eeRatePerMile;
      } else {
        body.amount = eeAmount;
      }
      const r = await apiRequest("PATCH", `/api/expenses/${id}`, body);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "expenses"] });
      setEditingExpenseId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update expense entry", description: err.message, variant: "destructive" });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "expenses"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete entry", description: err.message, variant: "destructive" });
    },
  });

  const hoursTotal = allHours.reduce((sum, h) => sum + (parseFloat(h.hours) || 0) * (parseFloat(h.ratePerHour) || 0), 0);
  const expensesTotal = allExpenses.reduce((sum, e) => sum + calcExpenseAmount(e), 0);

  return (
    <div className="space-y-4">
      {/* Hours */}
      <div className="rounded-md border bg-card">
        <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Hours</h3>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowHoursForm(true)} data-testid="button-add-hours-entry">
            <Plus className="w-3.5 h-3.5" />
            Add
          </Button>
        </div>

        {showHoursForm && (
          <div className="px-4 py-3 border-b bg-muted/20 space-y-3">
            <div className="grid grid-cols-[120px_1fr_80px_90px] gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={hDate} onChange={(e) => setHDate(e.target.value)} className="h-8 text-xs" data-testid="input-te-hours-date" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input value={hDesc} onChange={(e) => setHDesc(e.target.value)} placeholder="Task description" className="h-8 text-sm" data-testid="input-te-hours-desc" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hours</Label>
                <Input type="number" min="0" step="0.5" value={hHours} onChange={(e) => setHHours(e.target.value)} className="h-8 text-sm" data-testid="input-te-hours-hrs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rate/hr</Label>
                <Input type="number" min="0" step="5" value={hRate} onChange={(e) => setHRate(e.target.value)} placeholder="0.00" className="h-8 text-sm" data-testid="input-te-hours-rate" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowHoursForm(false)}>Cancel</Button>
              <Button
                size="sm"
                onClick={() => addHoursMutation.mutate()}
                disabled={!hDate || !hDesc || !hHours || !hRate || addHoursMutation.isPending}
                data-testid="button-save-hours-entry"
              >
                {addHoursMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        )}

        {hoursLoading ? (
          <div className="p-4 space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
        ) : allHours.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted-foreground text-center">No hours entries yet.</p>
        ) : (
          <div className="divide-y">
            {allHours.map((h) => {
              const amount = (parseFloat(h.hours) || 0) * (parseFloat(h.ratePerHour) || 0);
              const invoiceNum = h.invoiceId ? invoiceMap.get(h.invoiceId) : null;
              const isEditing = editingHoursId === h.id;

              if (isEditing) {
                return (
                  <div key={h.id} className="px-4 py-3 bg-muted/10 space-y-2" data-testid={`row-hours-edit-${h.id}`}>
                    <div className="grid grid-cols-[120px_1fr_80px_90px] gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Date</Label>
                        <Input type="date" value={ehDate} onChange={(e) => setEhDate(e.target.value)} className="h-8 text-xs" data-testid={`input-edit-hours-date-${h.id}`} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Input value={ehDesc} onChange={(e) => setEhDesc(e.target.value)} className="h-8 text-sm" data-testid={`input-edit-hours-desc-${h.id}`} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Hours</Label>
                        <Input type="number" min="0" step="0.5" value={ehHours} onChange={(e) => setEhHours(e.target.value)} className="h-8 text-sm" data-testid={`input-edit-hours-hrs-${h.id}`} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Rate/hr</Label>
                        <Input type="number" min="0" step="5" value={ehRate} onChange={(e) => setEhRate(e.target.value)} className="h-8 text-sm" data-testid={`input-edit-hours-rate-${h.id}`} />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => setEditingHoursId(null)}>Cancel</Button>
                      <Button
                        size="sm"
                        onClick={() => updateHoursMutation.mutate(h.id)}
                        disabled={!ehDate || !ehDesc || !ehHours || !ehRate || updateHoursMutation.isPending}
                        data-testid={`button-save-edit-hours-${h.id}`}
                      >
                        {updateHoursMutation.isPending ? "Saving…" : "Save"}
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={h.id} className="px-4 py-3 flex items-center justify-between gap-3 group" data-testid={`row-hours-${h.id}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{h.description}</p>
                        {invoiceNum != null ? (
                          <Badge variant="secondary" className="text-xs shrink-0">Invoice #{invoiceNum}</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs shrink-0 text-muted-foreground">Unattached</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{h.date} · {h.hours} hrs @ ${h.ratePerHour}/hr</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium">{fmtCurrency(amount)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startEditHours(h)}
                      data-testid={`button-edit-hours-${h.id}`}
                    >
                      <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteHoursMutation.mutate(h.id)}
                      disabled={deleteHoursMutation.isPending}
                      data-testid={`button-delete-hours-${h.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {allHours.length > 0 && (
          <div className="px-4 py-2.5 border-t flex justify-between items-center bg-muted/10">
            <span className="text-xs text-muted-foreground font-medium">Total</span>
            <span className="text-sm font-semibold">{fmtCurrency(hoursTotal)}</span>
          </div>
        )}
      </div>

      {/* Expenses */}
      <div className="rounded-md border bg-card">
        <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Expenses</h3>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowExpenseForm(true)} data-testid="button-add-expense-entry">
            <Plus className="w-3.5 h-3.5" />
            Add
          </Button>
        </div>

        {showExpenseForm && (
          <div className="px-4 py-3 border-b bg-muted/20 space-y-3">
            <div className="grid grid-cols-[120px_140px_1fr] gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} className="h-8 text-xs" data-testid="input-te-expense-date" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={eType} onValueChange={setEType}>
                  <SelectTrigger className="h-8 text-sm" data-testid="select-te-expense-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {eType === "Mileage" ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Miles</Label>
                      <Input type="number" min="0" step="1" value={eMiles} onChange={(e) => setEMiles(e.target.value)} className="h-8 text-sm" data-testid="input-te-expense-miles" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">$/Mile</Label>
                      <Input type="number" min="0" step="0.01" value={eRatePerMile} onChange={(e) => setERatePerMile(e.target.value)} className="h-8 text-sm" data-testid="input-te-expense-rate" />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">Amount ($)</Label>
                  <Input type="number" min="0" step="0.01" value={eAmount} onChange={(e) => setEAmount(e.target.value)} placeholder="0.00" className="h-8 text-sm" data-testid="input-te-expense-amount" />
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowExpenseForm(false)}>Cancel</Button>
              <Button
                size="sm"
                onClick={() => addExpenseMutation.mutate()}
                disabled={!eDate || addExpenseMutation.isPending}
                data-testid="button-save-expense-entry"
              >
                {addExpenseMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        )}

        {expensesLoading ? (
          <div className="p-4 space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
        ) : allExpenses.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted-foreground text-center">No expense entries yet.</p>
        ) : (
          <div className="divide-y">
            {allExpenses.map((e) => {
              const amount = calcExpenseAmount(e);
              const invoiceNum = e.invoiceId ? invoiceMap.get(e.invoiceId) : null;
              const isEditing = editingExpenseId === e.id;
              const detail = e.expenseType === "Mileage"
                ? `${e.milesTraveled} mi @ $${e.ratePerMile}/mi`
                : fmtCurrency(parseFloat(e.amount || "0") || 0);

              if (isEditing) {
                return (
                  <div key={e.id} className="px-4 py-3 bg-muted/10 space-y-2" data-testid={`row-expense-edit-${e.id}`}>
                    <div className="grid grid-cols-[120px_140px_1fr] gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Date</Label>
                        <Input type="date" value={eeDate} onChange={(ev) => setEeDate(ev.target.value)} className="h-8 text-xs" data-testid={`input-edit-expense-date-${e.id}`} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <Select value={eeType} onValueChange={setEeType}>
                          <SelectTrigger className="h-8 text-sm" data-testid={`select-edit-expense-type-${e.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EXPENSE_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {eeType === "Mileage" ? (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Miles</Label>
                            <Input type="number" min="0" step="1" value={eeMiles} onChange={(ev) => setEeMiles(ev.target.value)} className="h-8 text-sm" data-testid={`input-edit-expense-miles-${e.id}`} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">$/Mile</Label>
                            <Input type="number" min="0" step="0.01" value={eeRatePerMile} onChange={(ev) => setEeRatePerMile(ev.target.value)} className="h-8 text-sm" data-testid={`input-edit-expense-rate-${e.id}`} />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Label className="text-xs">Amount ($)</Label>
                          <Input type="number" min="0" step="0.01" value={eeAmount} onChange={(ev) => setEeAmount(ev.target.value)} className="h-8 text-sm" data-testid={`input-edit-expense-amount-${e.id}`} />
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => setEditingExpenseId(null)}>Cancel</Button>
                      <Button
                        size="sm"
                        onClick={() => updateExpenseMutation.mutate(e.id)}
                        disabled={!eeDate || updateExpenseMutation.isPending}
                        data-testid={`button-save-edit-expense-${e.id}`}
                      >
                        {updateExpenseMutation.isPending ? "Saving…" : "Save"}
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={e.id} className="px-4 py-3 flex items-center justify-between gap-3" data-testid={`row-expense-${e.id}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{e.expenseType}</p>
                      {invoiceNum != null ? (
                        <Badge variant="secondary" className="text-xs shrink-0">Invoice #{invoiceNum}</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs shrink-0 text-muted-foreground">Unattached</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{e.date} · {detail}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium">{fmtCurrency(amount)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startEditExpense(e)}
                      data-testid={`button-edit-expense-${e.id}`}
                    >
                      <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteExpenseMutation.mutate(e.id)}
                      disabled={deleteExpenseMutation.isPending}
                      data-testid={`button-delete-expense-${e.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {allExpenses.length > 0 && (
          <div className="px-4 py-2.5 border-t flex justify-between items-center bg-muted/10">
            <span className="text-xs text-muted-foreground font-medium">Total</span>
            <span className="text-sm font-semibold">{fmtCurrency(expensesTotal)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Invoices Tab ──────────────────────────────────────────────────────────────

type InvoicesView = { type: "list" } | { type: "builder"; proposal: ProposalWithPhases } | { type: "invoice"; invoiceId: string };

function InvoicesTab({ leadId, lead }: { leadId: number; lead: LeadWithCompanies }) {
  const [view, setView] = useState<InvoicesView>({ type: "list" });

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

// ─── Notes Tab ─────────────────────────────────────────────────────────────────

function NotesTab({ leadId }: { leadId: number }) {
  const { toast } = useToast();
  const [commentText, setCommentText] = useState("");

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

  return (
    <div className="rounded-md border bg-card">
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Project Notes</h3>
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
        <p className="px-4 py-4 text-sm text-muted-foreground text-center">No notes yet.</p>
      ) : (
        <div className="divide-y">
          {comments.map((c) => (
            <div key={c.id} className="px-4 py-3 space-y-1 group" data-testid={`comment-${c.id}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
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
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

interface Props {
  params: { id: string };
}

export default function ProjectDetailPage({ params }: Props) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const leadId = parseInt(params.id, 10);

  const { data: lead, isLoading } = useQuery<LeadWithCompanies>({
    queryKey: ["/api/leads", leadId],
    queryFn: async () => {
      const r = await fetch(`/api/leads/${leadId}`);
      if (!r.ok) throw new Error(`Failed to load project: ${r.status}`);
      return r.json() as Promise<LeadWithCompanies>;
    },
    enabled: !isNaN(leadId),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/leads/${leadId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Project deleted" });
      navigate("/projects");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete project", description: err.message, variant: "destructive" });
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
        <p className="text-muted-foreground">Invalid project ID</p>
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
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  const companyMap = new Map(lead.companies.map((c) => [c.companyRole, c]));
  const isProject = lead.status === "Active Project" || lead.status === "Completed";

  const tabColsClass = isProject ? "grid grid-cols-5" : "grid grid-cols-3";

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full p-6 space-y-6">
        {/* Back + actions header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Link href="/projects">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ChevronLeft className="w-4 h-4" />
              Projects
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEdit(true)}
              data-testid="button-edit-project"
            >
              <Edit className="w-4 h-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDelete(true)}
              data-testid="button-delete-project"
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>

        {/* Project header card */}
        <div className="rounded-md border bg-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-muted-foreground" data-testid="text-project-id">
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
          <TabsList className={`w-full ${tabColsClass}`}>
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="proposals" data-testid="tab-proposals">Proposals</TabsTrigger>
            {isProject && (
              <TabsTrigger value="time-expenses" data-testid="tab-time-expenses">Time & Expenses</TabsTrigger>
            )}
            {isProject && (
              <TabsTrigger value="invoices" data-testid="tab-invoices">Invoices</TabsTrigger>
            )}
            <TabsTrigger value="notes" data-testid="tab-notes">Notes</TabsTrigger>
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
            <ProposalsTab leadId={leadId} projectName={lead.projectName} />
          </TabsContent>

          {isProject && (
            <TabsContent value="time-expenses" className="mt-6">
              <TimeExpensesTab leadId={leadId} />
            </TabsContent>
          )}

          {isProject && (
            <TabsContent value="invoices" className="mt-6">
              <InvoicesTab leadId={leadId} lead={lead} />
            </TabsContent>
          )}

          <TabsContent value="notes" className="mt-6">
            <NotesTab leadId={leadId} />
          </TabsContent>
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
        <AlertDialogContent data-testid="dialog-delete-project">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
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
