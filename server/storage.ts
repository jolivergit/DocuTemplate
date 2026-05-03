import {
  categories,
  contentSnippets,
  profiles,
  fieldValues,
  leads,
  leadCompanies,
  type Category,
  type InsertCategory,
  type ContentSnippet,
  type InsertContentSnippet,
  type Profile,
  type FieldValue,
  type InsertFieldValue,
  type Lead,
  type InsertLead,
  type LeadCompany,
  type InsertLeadCompany,
  type LeadWithCompanies,
  COMPANY_ROLES,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, inArray } from "drizzle-orm";

export interface IStorage {
  // Categories
  getCategories(userId: string): Promise<Category[]>;
  createCategory(userId: string, category: InsertCategory): Promise<Category>;
  updateCategory(userId: string, id: string, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(userId: string, id: string): Promise<boolean>;

  // Content Snippets
  getContentSnippets(userId: string): Promise<ContentSnippet[]>;
  getContentSnippetById(userId: string, id: string): Promise<ContentSnippet | undefined>;
  createContentSnippet(userId: string, snippet: InsertContentSnippet, embeddedFields?: string[]): Promise<ContentSnippet>;
  updateContentSnippet(userId: string, id: string, snippet: Partial<InsertContentSnippet>, embeddedFields?: string[]): Promise<ContentSnippet | undefined>;
  deleteContentSnippet(userId: string, id: string): Promise<boolean>;
  incrementSnippetUsage(userId: string, id: string): Promise<void>;

  // Field Values - simple key/value pairs
  getFieldValues(userId: string): Promise<FieldValue[]>;
  getFieldValueById(userId: string, id: string): Promise<FieldValue | undefined>;
  getFieldValueByName(userId: string, name: string): Promise<FieldValue | undefined>;
  createFieldValue(userId: string, fieldValue: InsertFieldValue): Promise<FieldValue>;
  updateFieldValue(userId: string, id: string, fieldValue: Partial<InsertFieldValue>): Promise<FieldValue | undefined>;
  deleteFieldValue(userId: string, id: string): Promise<boolean>;

  // Legacy Profiles (kept for migration)
  getProfiles(userId: string): Promise<Profile[]>;
  getProfileById(userId: string, id: string): Promise<Profile | undefined>;

  // Leads
  getLeads(userId: string): Promise<LeadWithCompanies[]>;
  getLeadById(userId: string, id: number): Promise<LeadWithCompanies | undefined>;
  createLead(userId: string, lead: InsertLead, companies: Omit<InsertLeadCompany, 'leadId'>[]): Promise<LeadWithCompanies>;
  updateLead(userId: string, id: number, lead: Partial<InsertLead>): Promise<Lead | undefined>;
  upsertLeadCompanies(userId: string, leadId: number, companies: Omit<InsertLeadCompany, 'leadId'>[]): Promise<LeadCompany[]>;
  deleteLead(userId: string, id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getCategories(userId: string): Promise<Category[]> {
    return await db.select().from(categories).where(eq(categories.userId, userId));
  }

  async createCategory(userId: string, insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db
      .insert(categories)
      .values({ ...insertCategory, userId })
      .returning();
    return category;
  }

  async updateCategory(userId: string, id: string, updates: Partial<InsertCategory>): Promise<Category | undefined> {
    const [category] = await db
      .update(categories)
      .set(updates)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .returning();
    return category || undefined;
  }

  async deleteCategory(userId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getContentSnippets(userId: string): Promise<ContentSnippet[]> {
    return await db.select().from(contentSnippets).where(eq(contentSnippets.userId, userId));
  }

  async getContentSnippetById(userId: string, id: string): Promise<ContentSnippet | undefined> {
    const [snippet] = await db
      .select()
      .from(contentSnippets)
      .where(and(eq(contentSnippets.id, id), eq(contentSnippets.userId, userId)));
    return snippet || undefined;
  }

  async createContentSnippet(userId: string, insertSnippet: InsertContentSnippet, embeddedFields?: string[]): Promise<ContentSnippet> {
    const [snippet] = await db
      .insert(contentSnippets)
      .values({ ...insertSnippet, userId, embeddedFields: embeddedFields || [] })
      .returning();
    return snippet;
  }

  async updateContentSnippet(
    userId: string,
    id: string,
    updates: Partial<InsertContentSnippet>,
    embeddedFields?: string[]
  ): Promise<ContentSnippet | undefined> {
    const updateData: any = { ...updates, updatedAt: sql`CURRENT_TIMESTAMP` };
    if (embeddedFields !== undefined) {
      updateData.embeddedFields = embeddedFields;
    }
    const [snippet] = await db
      .update(contentSnippets)
      .set(updateData)
      .where(and(eq(contentSnippets.id, id), eq(contentSnippets.userId, userId)))
      .returning();
    return snippet || undefined;
  }

  async deleteContentSnippet(userId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(contentSnippets)
      .where(and(eq(contentSnippets.id, id), eq(contentSnippets.userId, userId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async incrementSnippetUsage(userId: string, id: string): Promise<void> {
    await db
      .update(contentSnippets)
      .set({
        usageCount: sql`${contentSnippets.usageCount} + 1`,
      })
      .where(and(eq(contentSnippets.id, id), eq(contentSnippets.userId, userId)));
  }

  async getFieldValues(userId: string): Promise<FieldValue[]> {
    return await db.select().from(fieldValues).where(eq(fieldValues.userId, userId));
  }

  async getFieldValueById(userId: string, id: string): Promise<FieldValue | undefined> {
    const [fieldValue] = await db
      .select()
      .from(fieldValues)
      .where(and(eq(fieldValues.id, id), eq(fieldValues.userId, userId)));
    return fieldValue || undefined;
  }

  async getFieldValueByName(userId: string, name: string): Promise<FieldValue | undefined> {
    const [fieldValue] = await db
      .select()
      .from(fieldValues)
      .where(and(eq(fieldValues.name, name), eq(fieldValues.userId, userId)));
    return fieldValue || undefined;
  }

  async createFieldValue(userId: string, insertFieldValue: InsertFieldValue): Promise<FieldValue> {
    const [fieldValue] = await db
      .insert(fieldValues)
      .values({ ...insertFieldValue, userId })
      .returning();
    return fieldValue;
  }

  async updateFieldValue(
    userId: string,
    id: string,
    updates: Partial<InsertFieldValue>
  ): Promise<FieldValue | undefined> {
    const [fieldValue] = await db
      .update(fieldValues)
      .set({ ...updates, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(fieldValues.id, id), eq(fieldValues.userId, userId)))
      .returning();
    return fieldValue || undefined;
  }

  async deleteFieldValue(userId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(fieldValues)
      .where(and(eq(fieldValues.id, id), eq(fieldValues.userId, userId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Legacy Profiles (kept for migration)
  async getProfiles(userId: string): Promise<Profile[]> {
    return await db.select().from(profiles).where(eq(profiles.userId, userId));
  }

  async getProfileById(userId: string, id: string): Promise<Profile | undefined> {
    const [profile] = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.id, id), eq(profiles.userId, userId)));
    return profile || undefined;
  }

  // ─── Leads ───────────────────────────────────────────────────────────────────

  private async attachCompanies(leadRows: Lead[]): Promise<LeadWithCompanies[]> {
    if (leadRows.length === 0) return [];
    const ids = leadRows.map(l => l.id);
    const allCompanies = await db
      .select()
      .from(leadCompanies)
      .where(inArray(leadCompanies.leadId, ids));
    return leadRows.map(lead => ({
      ...lead,
      companies: allCompanies.filter(c => c.leadId === lead.id),
    }));
  }

  async getLeads(userId: string): Promise<LeadWithCompanies[]> {
    const rows = await db
      .select()
      .from(leads)
      .where(eq(leads.userId, userId))
      .orderBy(leads.id);
    return this.attachCompanies(rows);
  }

  async getLeadById(userId: string, id: number): Promise<LeadWithCompanies | undefined> {
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.userId, userId)));
    if (!lead) return undefined;
    const companies = await db
      .select()
      .from(leadCompanies)
      .where(eq(leadCompanies.leadId, id));
    return { ...lead, companies };
  }

  async createLead(
    userId: string,
    leadData: InsertLead,
    companies: Omit<InsertLeadCompany, 'leadId'>[]
  ): Promise<LeadWithCompanies> {
    // Enforce role uniqueness before touching DB
    const roles = companies.map(c => c.companyRole);
    const duplicates = roles.filter((r, i) => roles.indexOf(r) !== i);
    if (duplicates.length > 0) {
      throw new Error(`Duplicate company roles: ${Array.from(new Set(duplicates)).join(', ')}`);
    }

    const [lead] = await db
      .insert(leads)
      .values({ ...leadData, userId })
      .returning();

    let savedCompanies: LeadCompany[] = [];
    if (companies.length > 0) {
      savedCompanies = await db
        .insert(leadCompanies)
        .values(companies.map(c => ({ ...c, leadId: lead.id })))
        .returning();
    }

    return { ...lead, companies: savedCompanies };
  }

  async updateLead(userId: string, id: number, updates: Partial<InsertLead>): Promise<Lead | undefined> {
    const [lead] = await db
      .update(leads)
      .set({ ...updates, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(leads.id, id), eq(leads.userId, userId)))
      .returning();
    return lead || undefined;
  }

  async upsertLeadCompanies(
    userId: string,
    leadId: number,
    companies: Omit<InsertLeadCompany, 'leadId'>[]
  ): Promise<LeadCompany[]> {
    // Verify the lead belongs to the requesting user before touching companies
    const [existingLead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.userId, userId)));
    if (!existingLead) {
      throw new Error(`Lead not found or access denied`);
    }

    // Enforce role uniqueness before touching DB
    const roles = companies.map(c => c.companyRole);
    const duplicates = roles.filter((r, i) => roles.indexOf(r) !== i);
    if (duplicates.length > 0) {
      throw new Error(`Duplicate company roles: ${Array.from(new Set(duplicates)).join(', ')}`);
    }

    // Delete existing companies for this lead and re-insert
    await db.delete(leadCompanies).where(eq(leadCompanies.leadId, leadId));
    if (companies.length === 0) return [];
    const saved = await db
      .insert(leadCompanies)
      .values(companies.map(c => ({ ...c, leadId })))
      .returning();
    return saved;
  }

  async deleteLead(userId: string, id: number): Promise<boolean> {
    const result = await db
      .delete(leads)
      .where(and(eq(leads.id, id), eq(leads.userId, userId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }
}

export const storage = new DatabaseStorage();
