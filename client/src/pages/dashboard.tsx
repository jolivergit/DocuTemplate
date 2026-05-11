import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Briefcase, ChevronRight, CircleDollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardStats } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  Lead: "bg-muted text-muted-foreground",
  Proposal: "bg-muted text-muted-foreground",
  "Active Project": "bg-foreground text-background",
  Completed: "bg-secondary text-secondary-foreground",
  Lost: "bg-muted text-muted-foreground",
};

const PIPELINE_STAGES: { key: string; label: string; testId: string }[] = [
  { key: "Lead", label: "Lead", testId: "stat-open-leads" },
  { key: "Proposal", label: "Proposal", testId: "stat-proposals" },
  { key: "Active Project", label: "Active Project", testId: "stat-active-projects" },
  { key: "Completed", label: "Completed", testId: "stat-completed" },
];

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function StatCard({
  title,
  value,
  icon: Icon,
  sub,
  testId,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  testId: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold" data-testid={testId}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard"],
    queryFn: async () => {
      const r = await fetch("/api/dashboard");
      if (!r.ok) throw new Error("Failed to load dashboard");
      return r.json();
    },
    staleTime: 30_000,
  });

  const pipelineTotal = PIPELINE_STAGES.reduce(
    (sum, s) => sum + (stats?.leadsByStatus?.[s.key] ?? 0),
    0
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Pipeline strip */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">Pipeline</h2>
          {isLoading ? (
            <Skeleton className="h-24 rounded-md" />
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center">
                  {PIPELINE_STAGES.map((stage, i) => {
                    const count = stats?.leadsByStatus?.[stage.key] ?? 0;
                    const pct = pipelineTotal > 0 ? (count / pipelineTotal) * 100 : 0;
                    return (
                      <div key={stage.key} className="contents">
                        <div className="flex-1 px-5 py-5 relative overflow-hidden">
                          <p
                            className="text-2xl font-semibold"
                            data-testid={stage.testId}
                          >
                            {count}
                          </p>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
                            {stage.label}
                          </p>
                          {/* proportional fill bar */}
                          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-muted" />
                          <div
                            className="absolute bottom-0 left-0 h-[2px] bg-foreground transition-all duration-500"
                            style={{ width: `${pct}%` }}
                            data-testid={`bar-stage-${stage.key.replace(/\s+/g, "-").toLowerCase()}`}
                          />
                        </div>
                        {i < PIPELINE_STAGES.length - 1 && (
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Financial stat cards */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">Billing</h2>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-28 rounded-md" />
              <Skeleton className="h-28 rounded-md" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatCard
                title="Outstanding Invoices"
                value={fmt(stats?.sentInvoicesTotal ?? 0)}
                icon={CircleDollarSign}
                sub="Sent, awaiting payment"
                testId="stat-outstanding"
              />
              <StatCard
                title="Paid Invoices"
                value={fmt(stats?.paidInvoicesTotal ?? 0)}
                icon={CircleDollarSign}
                sub="Total collected"
                testId="stat-paid"
              />
            </div>
          )}
        </section>

        {/* Recent leads */}
        <section>
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Recent Projects</h2>
            <Link href="/projects">
              <Button variant="ghost" size="sm" data-testid="button-view-all-projects">
                View all
                <ChevronRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-md" />)}
            </div>
          ) : !stats?.recentLeads?.length ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-sm text-muted-foreground">No projects yet.</p>
                <Link href="/projects">
                  <Button size="sm" className="mt-4" data-testid="button-create-first-project">
                    Create your first project
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-md border bg-card divide-y">
              {stats.recentLeads.map((lead) => {
                const client = lead.companies?.find(
                  (c) => c.companyRole === "Client" || c.companyRole === "ContractHolder"
                );
                return (
                  <Link key={lead.id} href={`/projects/${lead.id}`}>
                    <div
                      className="flex items-center justify-between gap-3 px-4 py-3 hover-elevate cursor-pointer flex-wrap"
                      data-testid={`row-recent-lead-${lead.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Briefcase className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{lead.projectName}</p>
                          {client && (
                            <p className="text-xs text-muted-foreground truncate">{client.companyName}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={STATUS_COLORS[lead.status] ?? ""}
                          data-testid={`badge-lead-status-${lead.id}`}
                        >
                          {lead.status}
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
