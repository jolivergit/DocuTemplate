import { db } from "../db";
import { eq, and, inArray, sql } from "drizzle-orm";
import {
  leads,
  leadCompanies,
  companies,
  contacts,
  type Lead,
  type InsertLead,
  type LeadCompany,
  type LeadCompanyWithLinked,
  type InsertLeadCompany,
  type LeadWithCompanies,
  type Company,
  type Contact,
} from "@shared/schema";

// ─── Shared helper (exported for use by proposals + invoices repos) ───────────

export async function verifyLeadOwnership(userId: string, leadId: number): Promise<boolean> {
  const [lead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.userId, userId)));
  return !!lead;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function attachCompanies(leadRows: Lead[]): Promise<LeadWithCompanies[]> {
  if (leadRows.length === 0) return [];
  const userId = leadRows[0].userId;
  const ids = leadRows.map(l => l.id);
  const allLeadCompanies = await db.select().from(leadCompanies).where(inArray(leadCompanies.leadId, ids));

  const linkedCompanyIds = Array.from(new Set(allLeadCompanies.map(c => c.companyId).filter(Boolean) as string[]));
  const linkedContactIds = Array.from(new Set(allLeadCompanies.map(c => c.contactId).filter(Boolean) as string[]));

  const [linkedCompanyRows, linkedContactRows] = await Promise.all([
    linkedCompanyIds.length > 0
      ? db.select().from(companies).where(and(inArray(companies.id, linkedCompanyIds), eq(companies.userId, userId)))
      : Promise.resolve([] as Company[]),
    linkedContactIds.length > 0
      ? db.select().from(contacts).where(and(inArray(contacts.id, linkedContactIds), eq(contacts.userId, userId)))
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
  companiesData: Omit<InsertLeadCompany, 'leadId'>[]
): Promise<Omit<InsertLeadCompany, 'leadId'>[]> {
  const companyIds = Array.from(new Set(companiesData.map(c => c.companyId).filter(Boolean) as string[]));
  const contactIds = Array.from(new Set(companiesData.map(c => c.contactId).filter(Boolean) as string[]));

  const [ownedCompanies, ownedContacts] = await Promise.all([
    companyIds.length > 0
      ? db.select({ id: companies.id }).from(companies).where(and(inArray(companies.id, companyIds), eq(companies.userId, userId)))
      : Promise.resolve([] as { id: string }[]),
    contactIds.length > 0
      ? db.select({ id: contacts.id }).from(contacts).where(and(inArray(contacts.id, contactIds), eq(contacts.userId, userId)))
      : Promise.resolve([] as { id: string }[]),
  ]);

  const ownedCompanySet = new Set(ownedCompanies.map(c => c.id));
  const ownedContactSet = new Set(ownedContacts.map(c => c.id));

  return companiesData.map(c => ({
    ...c,
    companyId: c.companyId && ownedCompanySet.has(c.companyId) ? c.companyId : null,
    contactId: c.contactId && ownedContactSet.has(c.contactId) ? c.contactId : null,
  }));
}

// ─── Leads ────────────────────────────────────────────────────────────────────

export async function getLeads(userId: string): Promise<LeadWithCompanies[]> {
  const rows = await db.select().from(leads).where(eq(leads.userId, userId)).orderBy(leads.id);
  return attachCompanies(rows);
}

export async function getLeadById(userId: string, id: number): Promise<LeadWithCompanies | undefined> {
  const [lead] = await db.select().from(leads).where(and(eq(leads.id, id), eq(leads.userId, userId)));
  if (!lead) return undefined;
  const [enriched] = await attachCompanies([lead]);
  return enriched;
}

export async function createLead(
  userId: string,
  leadData: InsertLead,
  companiesData: Omit<InsertLeadCompany, 'leadId'>[]
): Promise<LeadWithCompanies> {
  const sanitized = await sanitizeLeadCompanyFKs(userId, companiesData);
  const [lead] = await db.insert(leads).values({ ...leadData, userId }).returning();
  if (sanitized.length > 0) {
    await db.insert(leadCompanies).values(sanitized.map(c => ({ ...c, leadId: lead.id })));
  }
  const [enriched] = await attachCompanies([lead]);
  return enriched;
}

export async function updateLead(userId: string, id: number, data: Partial<InsertLead>): Promise<Lead | undefined> {
  const [lead] = await db
    .update(leads)
    .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(and(eq(leads.id, id), eq(leads.userId, userId)))
    .returning();
  return lead || undefined;
}

export async function upsertLeadCompanies(
  userId: string,
  leadId: number,
  companiesData: Omit<InsertLeadCompany, 'leadId'>[]
): Promise<LeadCompany[]> {
  const [existingLead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.userId, userId)));
  if (!existingLead) throw new Error(`Lead not found or access denied`);

  const sanitized = await sanitizeLeadCompanyFKs(userId, companiesData);
  await db.delete(leadCompanies).where(eq(leadCompanies.leadId, leadId));
  if (sanitized.length === 0) return [];
  return db.insert(leadCompanies).values(sanitized.map(c => ({ ...c, leadId }))).returning();
}

export async function deleteLead(userId: string, id: number): Promise<boolean> {
  const result = await db.delete(leads).where(and(eq(leads.id, id), eq(leads.userId, userId)));
  return result.rowCount ? result.rowCount > 0 : false;
}
