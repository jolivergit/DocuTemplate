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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { LeadFormDialog } from "@/components/lead-form-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { LeadWithCompanies, LeadStatus, LeadProbability, CompanyRole } from "@shared/schema";
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

function formatCurrency(value: string | null | undefined): string {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num);
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
    queryFn: () => fetch(`/api/leads/${leadId}`).then((r) => r.json()),
    enabled: !isNaN(leadId),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/leads/${leadId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Lead deleted" });
      navigate("/");
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

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full p-6 space-y-6">
        {/* Back + actions header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Link href="/">
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

        {/* Companies */}
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
