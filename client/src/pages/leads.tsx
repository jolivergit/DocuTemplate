import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Plus,
  Briefcase,
  ChevronRight,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LeadFormDialog } from "@/components/lead-form-dialog";
import type { LeadWithCompanies, LeadStatus, LeadProbability } from "@shared/schema";
import { LEAD_STATUSES, LEAD_PROBABILITIES } from "@shared/schema";

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

export default function LeadsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);

  const { data: leads = [], isLoading } = useQuery<LeadWithCompanies[]>({
    queryKey: ["/api/leads"],
  });

  const filtered = leads.filter((lead) => {
    const matchesSearch =
      lead.projectName.toLowerCase().includes(search.toLowerCase()) ||
      (lead.description || "").toLowerCase().includes(search.toLowerCase()) ||
      String(lead.id).includes(search);
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 flex-wrap flex-shrink-0 bg-background">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Leads</h1>
          <p className="text-sm text-muted-foreground">Manage your project pipeline</p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          data-testid="button-create-lead"
        >
          <Plus className="w-4 h-4" />
          New Lead
        </Button>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b flex items-center gap-3 flex-wrap flex-shrink-0 bg-background">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-leads"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44" data-testid="select-status-filter">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s} value={s} data-testid={`select-status-${s}`}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-md" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
            <Briefcase className="w-12 h-12 mb-4 text-muted-foreground" data-testid="icon-empty-leads" />
            <h3 className="text-sm font-medium mb-1" data-testid="text-no-leads-title">
              {search || statusFilter !== "all" ? "No matching leads" : "No leads yet"}
            </h3>
            <p className="text-xs text-muted-foreground mb-4" data-testid="text-no-leads-description">
              {search || statusFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Create your first lead to start tracking opportunities"}
            </p>
            {!search && statusFilter === "all" && (
              <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-create-lead-empty">
                <Plus className="w-4 h-4" />
                New Lead
              </Button>
            )}
          </div>
        ) : (
          <div className="p-6 space-y-3">
            {filtered.map((lead) => (
              <Link key={lead.id} href={`/leads/${lead.id}`}>
                <div
                  className="rounded-md border bg-card p-4 hover-elevate cursor-pointer flex items-center gap-4"
                  data-testid={`card-lead-${lead.id}`}
                >
                  {/* ID badge */}
                  <div className="flex-shrink-0 w-12 text-center">
                    <span className="text-xs font-mono text-muted-foreground" data-testid={`text-lead-id-${lead.id}`}>
                      #{lead.id}
                    </span>
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-sm font-semibold truncate" data-testid={`text-lead-name-${lead.id}`}>
                        {lead.projectName}
                      </h3>
                      <Badge
                        variant="secondary"
                        className={`text-xs flex-shrink-0 ${STATUS_COLORS[lead.status as LeadStatus] || ""}`}
                        data-testid={`badge-lead-status-${lead.id}`}
                      >
                        {lead.status}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={`text-xs flex-shrink-0 ${PROBABILITY_COLORS[lead.probability as LeadProbability] || ""}`}
                        data-testid={`badge-lead-probability-${lead.id}`}
                      >
                        {lead.probability}
                      </Badge>
                    </div>
                    {lead.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1" data-testid={`text-lead-desc-${lead.id}`}>
                        {lead.description}
                      </p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-6 flex-shrink-0 text-right">
                    {lead.squareFootage && (
                      <div>
                        <p className="text-xs text-muted-foreground">Sq Ft</p>
                        <p className="text-sm font-medium" data-testid={`text-lead-sqft-${lead.id}`}>
                          {Number(lead.squareFootage).toLocaleString()}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">Potential Fee</p>
                      <p className="text-sm font-medium" data-testid={`text-lead-fee-${lead.id}`}>
                        {formatCurrency(lead.potentialFee)}
                      </p>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Total count footer */}
      {!isLoading && leads.length > 0 && (
        <div className="border-t px-6 py-2 flex-shrink-0 bg-background">
          <p className="text-xs text-muted-foreground" data-testid="text-leads-count">
            {filtered.length} of {leads.length} leads
          </p>
        </div>
      )}

      <LeadFormDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
