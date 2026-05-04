import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Briefcase, ChevronRight, TrendingUp, FileCheck, Clock, CircleDollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardStats } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  Lead: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  Proposal: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  "Active Project": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  Completed: "bg-secondary text-secondary-foreground",
  Lost: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

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

  const activeProjects = stats?.leadsByStatus?.["Active Project"] ?? 0;
  const openLeads = stats?.leadsByStatus?.["Lead"] ?? 0;
  const proposals = stats?.leadsByStatus?.["Proposal"] ?? 0;
  const completed = stats?.leadsByStatus?.["Completed"] ?? 0;
  const pipelineTotal = openLeads + proposals + activeProjects;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Page header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-dashboard-title">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Oliver Studios project pipeline overview</p>
          </div>
          <Link href="/projects">
            <Button size="sm" data-testid="button-go-to-projects">
              <Briefcase className="w-4 h-4" />
              All Projects
            </Button>
          </Link>
        </div>

        {/* Pipeline stat cards */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">Pipeline</h2>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-md" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                title="Active Projects"
                value={activeProjects}
                icon={FileCheck}
                sub="In production"
                testId="stat-active-projects"
              />
              <StatCard
                title="Open Leads"
                value={openLeads}
                icon={Briefcase}
                sub="Awaiting proposal"
                testId="stat-open-leads"
              />
              <StatCard
                title="In Proposal"
                value={proposals}
                icon={Clock}
                sub="Awaiting signature"
                testId="stat-proposals"
              />
              <StatCard
                title="Completed"
                value={completed}
                icon={TrendingUp}
                sub="All time"
                testId="stat-completed"
              />
            </div>
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
          <div className="flex items-center justify-between mb-3">
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

        {/* Pipeline summary bar */}
        {!isLoading && pipelineTotal > 0 && (
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">Pipeline Breakdown</h2>
            <Card>
              <CardContent className="pt-5 space-y-3">
                {(["Lead", "Proposal", "Active Project", "Completed", "Lost"] as const).map((s) => {
                  const count = stats?.leadsByStatus?.[s] ?? 0;
                  const total = Object.values(stats?.leadsByStatus ?? {}).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  if (count === 0) return null;
                  return (
                    <div key={s} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{s}</span>
                        <span className="font-medium">{count} <span className="text-muted-foreground font-normal text-xs">({pct}%)</span></span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                          data-testid={`bar-status-${s.replace(/\s+/g, "-").toLowerCase()}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </div>
  );
}
