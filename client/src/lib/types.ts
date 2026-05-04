import type { LeadWithCompanies } from "@shared/schema";

export interface DashboardStats {
  leadsByStatus: Record<string, number>;
  sentInvoicesTotal: number;
  paidInvoicesTotal: number;
  recentLeads: LeadWithCompanies[];
}
