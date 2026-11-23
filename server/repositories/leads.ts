import { db } from "../db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { context, projectPredicate, addressPredicate, ownerOnly, AccessError } from "../workspace-context";
import {
  leads,
  leadCompanies,
  companies,
  contacts,
  projectAssignments,
  workspaceMembers,
  workspaces,
  type Lead,
  type InsertLead,
  type LeadCompany,
  type LeadCompanyWithLinked,
  type InsertLeadCompany,
  type LeadWithCompanies,
  type Company,
  type Contact,
} from "@shared/schema";
import { accessProject } from "../project-team";

// ─── Shared helper (exported for use by proposals + invoices repos) ───────────

export async function verifyLeadOwnership(userId: string, leadId: number): Promise<boolean> {
  const [lead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, leadId), projectPredicate(userId)));
  return !!lead;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function attachCompanies(leadRows: Lead[]): Promise<LeadWithCompanies[]> {
  if (leadRows.length === 0) return [];
  const ids = leadRows.map(l => l.id);
  const allLeadCompanies = await db.select().from(leadCompanies).where(inArray(leadCompanies.leadId, ids));

  const linkedCompanyIds = Array.from(new Set(allLeadCompanies.map(c => c.companyId).filter(Boolean) as string[]));
  const linkedContactIds = Array.from(new Set(allLeadCompanies.map(c => c.contactId).filter(Boolean) as string[]));

  const [linkedCompanyRows, linkedContactRows] = await Promise.all([
    linkedCompanyIds.length > 0
      ? db.select().from(companies).where(and(inArray(companies.id, linkedCompanyIds), eq(companies.workspaceId, context().workspaceId)))
      : Promise.resolve([] as Company[]),
    linkedContactIds.length > 0
      ? db.select().from(contacts).where(and(inArray(contacts.id, linkedContactIds), eq(contacts.workspaceId, context().workspaceId)))
      : Promise.resolve([] as Contact[]),
  ]);

  return leadRows.map(lead => ({
    ...lead,
    companies: allLeadCompanies
      .filter(c => c.leadId === lead.id)
      .map((c): LeadCompanyWithLinked => ({
        ...c,
        linkedCompany: c.companyId ? (linkedCompanyRows.find(co => co.id === c.companyId) || null) : null,
        linkedContact: c.contactId ? (linkedContactRows.find(ct => ct.id === c.contactId) || null) : null,
      })),
  }));
}

async function sanitizeLeadCompanyFKs(
  userId: string,
  companiesData: Omit<InsertLeadCompany, 'leadId'>[],
  tx: Pick<typeof db, "select"> = db,
  allowFirmChoices = false,
  freshMember?: { id: string; role: string },
): Promise<Omit<InsertLeadCompany, 'leadId'>[]> {
  const companyIds = Array.from(new Set(companiesData.map(c => c.companyId).filter(Boolean) as string[]));
  const contactIds = Array.from(new Set(companiesData.map(c => c.contactId).filter(Boolean) as string[]));

  const [ownedCompanies, ownedContacts] = await Promise.all([
    companyIds.length > 0
      ? tx.select({ id: companies.id }).from(companies).where(and(inArray(companies.id, companyIds), allowFirmChoices ? eq(companies.workspaceId, context().workspaceId) : addressPredicate(userId, "company", freshMember)))
      : Promise.resolve([] as { id: string }[]),
    contactIds.length > 0
      ? tx.select({ id: contacts.id }).from(contacts).where(and(inArray(contacts.id, contactIds), allowFirmChoices ? eq(contacts.workspaceId, context().workspaceId) : addressPredicate(userId, "contact", freshMember)))
      : Promise.resolve([] as { id: string }[]),
  ]);

  const ownedCompanySet = new Set(ownedCompanies.map(c => c.id));
  const ownedContactSet = new Set(ownedContacts.map(c => c.id));
  if (companyIds.some(id => !ownedCompanySet.has(id)) || contactIds.some(id => !ownedContactSet.has(id))) {
    throw new AccessError("A company or contact is not available in this workspace.");
  }

  return companiesData.map(c => ({
    ...c,
    companyId: c.companyId && ownedCompanySet.has(c.companyId) ? c.companyId : null,
    contactId: c.contactId && ownedContactSet.has(c.contactId) ? c.contactId : null,
  }));
}

// ─── Leads ────────────────────────────────────────────────────────────────────

export async function getLeads(userId: string): Promise<LeadWithCompanies[]> {
  const rows = await db.select().from(leads).where(projectPredicate(userId)).orderBy(leads.id);
  return attachCompanies(rows);
}

export async function getLeadById(userId: string, id: number): Promise<LeadWithCompanies | undefined> {
  const [lead] = await db.select().from(leads).where(and(eq(leads.id, id), projectPredicate(userId)));
  if (!lead) return undefined;
  const [enriched] = await attachCompanies([lead]);
  return enriched;
}

export async function createLead(
  userId: string,
  leadData: InsertLead,
  companiesData: Omit<InsertLeadCompany, 'leadId'>[]
): Promise<LeadWithCompanies> {
  const c = context(userId);
  const lead = await db.transaction(async tx => {
    await tx.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, c.workspaceId)).for("update");
    const [member] = await tx.select().from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, c.workspaceId), eq(workspaceMembers.userId, userId)));
    if (!member) throw new AccessError("Your firm access changed.");
    const sanitized = await sanitizeLeadCompanyFKs(userId, companiesData, tx, member.role === "Owner", member);
    const [created] = await tx.insert(leads).values({ ...leadData, userId, workspaceId: c.workspaceId, setupComplete: false, setupVersion: 1, teamVersion: 1 }).returning();
    if (sanitized.length > 0) await tx.insert(leadCompanies).values(sanitized.map(v => ({ ...v, leadId: created.id })));
    await tx.insert(projectAssignments).values({ leadId: created.id, memberId: member.id, roles: ["Project Admin"] });
    return created;
  });
  const [enriched] = await attachCompanies([lead]);
  return enriched;
}

export async function updateLead(
  userId: string, id: number, data: Partial<InsertLead>,
  companiesData?: Omit<InsertLeadCompany, 'leadId'>[],
  setup?: { version: number; setupComplete?: boolean },
): Promise<Lead | undefined> {
  return db.transaction(async tx => {
    const access = await accessProject(tx, id);
    if (setup && setup.version !== access.lead.setupVersion) throw new AccessError("Project setup changed elsewhere. Your edits are preserved; reload before saving.", 409);
    if (setup?.setupComplete !== undefined && !access.canManage) throw new AccessError("A Project Admin or firm Owner must finish or reopen setup.");
    if (setup?.setupComplete && !access.assignments.some(a => a.roles.includes("Project Admin"))) throw new AccessError("Assign at least one Project Admin before finishing setup.", 409);
    const sanitized = companiesData === undefined ? undefined : await sanitizeLeadCompanyFKs(userId, companiesData, tx, access.canManage, access.actor);
    const [lead] = await tx.update(leads)
      .set({ ...data, ...(setup?.setupComplete !== undefined ? { setupComplete: setup.setupComplete } : {}), updatedAt: sql`CURRENT_TIMESTAMP`, setupVersion: sql`${leads.setupVersion}+1` })
      .where(and(eq(leads.id, id), projectPredicate(userId, access.actor))).returning();
    if (!lead) return undefined;
    if (sanitized !== undefined) {
      await tx.delete(leadCompanies).where(eq(leadCompanies.leadId, id));
      if (sanitized.length) await tx.insert(leadCompanies).values(sanitized.map(company => ({ ...company, leadId: id })));
    }
    return lead;
  });
}

export async function upsertLeadCompanies(
  userId: string,
  leadId: number,
  companiesData: Omit<InsertLeadCompany, 'leadId'>[]
): Promise<LeadCompany[]> {
  const [existingLead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, leadId), projectPredicate(userId)));
  if (!existingLead) throw new Error(`Lead not found or access denied`);

  const sanitized = await sanitizeLeadCompanyFKs(userId, companiesData);
  await db.delete(leadCompanies).where(eq(leadCompanies.leadId, leadId));
  if (sanitized.length === 0) return [];
  return db.insert(leadCompanies).values(sanitized.map(c => ({ ...c, leadId }))).returning();
}

export async function deleteLead(userId: string, id: number): Promise<boolean> {
  ownerOnly();
  const result = await db.delete(leads).where(and(eq(leads.id, id), projectPredicate(userId)));
  return result.rowCount ? result.rowCount > 0 : false;
}
