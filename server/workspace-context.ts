import { AsyncLocalStorage } from "node:async_hooks";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { leads, companies, contacts, leadCompanies, projectAssignments } from "@shared/schema";

export interface WorkspaceContext {
  userId: string;
  workspaceId: string;
  memberId: string;
  role: "Owner" | "Member";
}
export const workspaceContext = new AsyncLocalStorage<WorkspaceContext>();

export class AccessError extends Error {
  constructor(message = "Access denied", public status = 403) { super(message); }
}
export function context(userId?: string): WorkspaceContext {
  const value = workspaceContext.getStore();
  if (!value || (userId && userId !== value.userId)) throw new AccessError();
  return value;
}
export function ownerOnly() {
  if (context().role !== "Owner") throw new AccessError("Only a company owner can perform this action.");
}
export function projectPredicate(userId: string): SQL {
  const c = context(userId);
  return and(eq(leads.workspaceId, c.workspaceId), c.role === "Owner" ? sql`true` :
    sql`exists (select 1 from ${projectAssignments} where ${projectAssignments.leadId} = ${leads.id} and ${projectAssignments.memberId} = ${c.memberId})`
  )!;
}
export function addressPredicate(userId: string, kind: "company" | "contact"): SQL {
  const c = context(userId);
  const table = kind === "company" ? companies : contacts;
  const foreignKey = kind === "company" ? leadCompanies.companyId : leadCompanies.contactId;
  return and(eq(table.workspaceId, c.workspaceId), c.role === "Owner" ? sql`true` :
    sql`exists (select 1 from ${leadCompanies} inner join ${leads} on ${leads.id} = ${leadCompanies.leadId}
        where ${foreignKey} = ${table.id} and ${projectPredicate(userId)})`
  )!;
}
