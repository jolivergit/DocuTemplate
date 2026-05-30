import { db } from "../db";
import { eq, and, inArray } from "drizzle-orm";
import {
  companies,
  contacts,
  contactCompanies,
  leads,
  leadCompanies,
  type Company,
  type InsertCompany,
  type CompanyWithContacts,
  type Contact,
  type InsertContact,
  type ContactWithCompanies,
} from "@shared/schema";

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function attachContactsToCompanies(companyRows: Company[]): Promise<CompanyWithContacts[]> {
  if (companyRows.length === 0) return [];
  const companyIds = companyRows.map(c => c.id);
  const junctionRows = await db.select().from(contactCompanies).where(inArray(contactCompanies.companyId, companyIds));
  if (junctionRows.length === 0) return companyRows.map(c => ({ ...c, contacts: [] }));
  const contactIds = junctionRows.map(j => j.contactId);
  const allContacts = await db.select().from(contacts).where(inArray(contacts.id, contactIds));
  return companyRows.map(company => ({
    ...company,
    contacts: junctionRows
      .filter(j => j.companyId === company.id)
      .map(j => allContacts.find(c => c.id === j.contactId)!)
      .filter(Boolean),
  }));
}

async function attachCompaniesToContacts(contactRows: Contact[]): Promise<ContactWithCompanies[]> {
  if (contactRows.length === 0) return [];
  const contactIds = contactRows.map(c => c.id);
  const junctionRows = await db.select().from(contactCompanies).where(inArray(contactCompanies.contactId, contactIds));
  if (junctionRows.length === 0) return contactRows.map(c => ({ ...c, companies: [] }));
  const companyIds = junctionRows.map(j => j.companyId);
  const allCompanies = await db.select().from(companies).where(inArray(companies.id, companyIds));
  return contactRows.map(contact => ({
    ...contact,
    companies: junctionRows
      .filter(j => j.contactId === contact.id)
      .map(j => allCompanies.find(c => c.id === j.companyId)!)
      .filter(Boolean),
  }));
}

async function verifyContactOwnership(userId: string, contactIds: string[]): Promise<string[]> {
  if (contactIds.length === 0) return [];
  const owned = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(inArray(contacts.id, contactIds), eq(contacts.userId, userId)));
  return owned.map(c => c.id);
}

async function verifyCompanyOwnership(userId: string, companyIds: string[]): Promise<string[]> {
  if (companyIds.length === 0) return [];
  const owned = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(inArray(companies.id, companyIds), eq(companies.userId, userId)));
  return owned.map(c => c.id);
}

// ─── Companies ────────────────────────────────────────────────────────────────

export async function getCompanies(userId: string): Promise<CompanyWithContacts[]> {
  const rows = await db.select().from(companies).where(eq(companies.userId, userId)).orderBy(companies.name);
  return attachContactsToCompanies(rows);
}

export async function getCompanyById(userId: string, id: string): Promise<CompanyWithContacts | undefined> {
  const [company] = await db.select().from(companies).where(and(eq(companies.id, id), eq(companies.userId, userId)));
  if (!company) return undefined;
  const [withContacts] = await attachContactsToCompanies([company]);
  return withContacts;
}

export async function createCompany(userId: string, data: InsertCompany, contactIds?: string[]): Promise<CompanyWithContacts> {
  const [company] = await db.insert(companies).values({ ...data, userId }).returning();
  if (contactIds && contactIds.length > 0) {
    const validIds = await verifyContactOwnership(userId, contactIds);
    if (validIds.length > 0) {
      await db.insert(contactCompanies).values(validIds.map(contactId => ({ contactId, companyId: company.id }))).onConflictDoNothing();
    }
  }
  const [withContacts] = await attachContactsToCompanies([company]);
  return withContacts;
}

export async function updateCompany(userId: string, id: string, data: Partial<InsertCompany>, contactIds?: string[]): Promise<CompanyWithContacts | undefined> {
  const [company] = await db
    .update(companies)
    .set(data)
    .where(and(eq(companies.id, id), eq(companies.userId, userId)))
    .returning();
  if (!company) return undefined;
  if (contactIds !== undefined) {
    const validIds = await verifyContactOwnership(userId, contactIds);
    await db.delete(contactCompanies).where(eq(contactCompanies.companyId, id));
    if (validIds.length > 0) {
      await db.insert(contactCompanies).values(validIds.map(contactId => ({ contactId, companyId: id }))).onConflictDoNothing();
    }
  }
  const [withContacts] = await attachContactsToCompanies([company]);
  return withContacts;
}

export async function deleteCompany(userId: string, id: string): Promise<boolean> {
  const result = await db.delete(companies).where(and(eq(companies.id, id), eq(companies.userId, userId)));
  return result.rowCount ? result.rowCount > 0 : false;
}

export async function linkContactToCompany(userId: string, companyId: string, contactId: string): Promise<void> {
  const [co] = await db.select({ id: companies.id }).from(companies).where(and(eq(companies.id, companyId), eq(companies.userId, userId)));
  if (!co) throw new Error('Company not found');
  const [ct] = await db.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.id, contactId), eq(contacts.userId, userId)));
  if (!ct) throw new Error('Contact not found');
  await db.insert(contactCompanies).values({ contactId, companyId }).onConflictDoNothing();
}

export async function unlinkContactFromCompany(userId: string, companyId: string, contactId: string): Promise<void> {
  const [co] = await db.select({ id: companies.id }).from(companies).where(and(eq(companies.id, companyId), eq(companies.userId, userId)));
  if (!co) throw new Error('Company not found');
  await db.delete(contactCompanies).where(and(eq(contactCompanies.companyId, companyId), eq(contactCompanies.contactId, contactId)));
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function getContacts(userId: string): Promise<ContactWithCompanies[]> {
  const rows = await db.select().from(contacts).where(eq(contacts.userId, userId)).orderBy(contacts.fullName);
  return attachCompaniesToContacts(rows);
}

export async function getContactById(userId: string, id: string): Promise<ContactWithCompanies | undefined> {
  const [contact] = await db.select().from(contacts).where(and(eq(contacts.id, id), eq(contacts.userId, userId)));
  if (!contact) return undefined;
  const [withCompanies] = await attachCompaniesToContacts([contact]);
  return withCompanies;
}

export async function createContact(userId: string, data: InsertContact, companyIds?: string[]): Promise<ContactWithCompanies> {
  const [contact] = await db.insert(contacts).values({ ...data, userId }).returning();
  if (companyIds && companyIds.length > 0) {
    const validIds = await verifyCompanyOwnership(userId, companyIds);
    if (validIds.length > 0) {
      await db.insert(contactCompanies).values(validIds.map(companyId => ({ contactId: contact.id, companyId }))).onConflictDoNothing();
    }
  }
  const [withCompanies] = await attachCompaniesToContacts([contact]);
  return withCompanies;
}

export async function updateContact(userId: string, id: string, data: Partial<InsertContact>, companyIds?: string[]): Promise<ContactWithCompanies | undefined> {
  const [contact] = await db
    .update(contacts)
    .set(data)
    .where(and(eq(contacts.id, id), eq(contacts.userId, userId)))
    .returning();
  if (!contact) return undefined;
  if (companyIds !== undefined) {
    const validIds = await verifyCompanyOwnership(userId, companyIds);
    await db.delete(contactCompanies).where(eq(contactCompanies.contactId, id));
    if (validIds.length > 0) {
      await db.insert(contactCompanies).values(validIds.map(companyId => ({ contactId: id, companyId }))).onConflictDoNothing();
    }
  }
  const [withCompanies] = await attachCompaniesToContacts([contact]);
  return withCompanies;
}

export async function deleteContact(userId: string, id: string): Promise<boolean> {
  const result = await db.delete(contacts).where(and(eq(contacts.id, id), eq(contacts.userId, userId)));
  return result.rowCount ? result.rowCount > 0 : false;
}

// ─── Migration ────────────────────────────────────────────────────────────────

export async function migrateLeadCompaniesToAddressBook(userId: string): Promise<{ companiesCreated: number; rowsUpdated: number }> {
  const userLeads = await db.select().from(leads).where(eq(leads.userId, userId));
  if (userLeads.length === 0) return { companiesCreated: 0, rowsUpdated: 0 };

  const leadIds = userLeads.map(l => l.id);
  const rows = await db.select().from(leadCompanies).where(inArray(leadCompanies.leadId, leadIds));
  const unlinked = rows.filter(r => !r.companyId && !!r.companyName);

  let companiesCreated = 0;
  let rowsUpdated = 0;

  const companyCache = new Map<string, string>();
  const existingCompanies = await db.select().from(companies).where(eq(companies.userId, userId));
  for (const c of existingCompanies) companyCache.set(c.name.toLowerCase(), c.id);

  for (const row of unlinked) {
    let companyId: string | null = null;
    const key = row.companyName!.toLowerCase();

    if (companyCache.has(key)) {
      companyId = companyCache.get(key)!;
    } else {
      const [newCompany] = await db.insert(companies).values({
        userId,
        name: row.companyName!,
        addressLine1: row.addressLine1,
        addressLine2: row.addressLine2,
        city: row.city,
        state: row.state,
        zip: row.zip,
      }).returning();
      companyId = newCompany.id;
      companyCache.set(key, companyId);
      companiesCreated++;
    }

    await db.update(leadCompanies).set({ companyId }).where(eq(leadCompanies.id, row.id));
    rowsUpdated++;
  }

  return { companiesCreated, rowsUpdated };
}
