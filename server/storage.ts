import {
  categories,
  contentSnippets,
  profiles,
  fieldValues,
  leads,
  leadCompanies,
  companies,
  contactCompanies,
  proposals,
  proposalPhases,
  proposalFeeLines,
  invoices,
  invoiceFeeLineSnapshots,
  hoursEntries,
  expenseEntries,
  projectComments,
  contacts,
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
  type LeadCompanyWithLinked,
  type InsertLeadCompany,
  type LeadWithCompanies,
  type Company,
  type InsertCompany,
  type CompanyWithContacts,
  type Contact,
  type InsertContact,
  type ContactWithCompanies,
  type Proposal,
  type InsertProposal,
  type ProposalPhase,
  type ProposalFeeLine,
  type ProposalPhaseWithLines,
  type ProposalWithPhases,
  type Invoice,
  type InvoiceFeeLineSnapshot,
  type HoursEntry,
  type ExpenseEntry,
  type ProjectComment,
  type InvoiceWithDetails,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, inArray } from "drizzle-orm";

export interface DashboardStats {
  leadsByStatus: Record<string, number>;
  sentInvoicesTotal: number;
  paidInvoicesTotal: number;
  recentLeads: LeadWithCompanies[];
}

export interface IStorage {
  // Dashboard
  getDashboardStats(userId: string): Promise<DashboardStats>;
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

  // Field Values
  getFieldValues(userId: string): Promise<FieldValue[]>;
  getFieldValueById(userId: string, id: string): Promise<FieldValue | undefined>;
  getFieldValueByName(userId: string, name: string): Promise<FieldValue | undefined>;
  createFieldValue(userId: string, fieldValue: InsertFieldValue): Promise<FieldValue>;
  updateFieldValue(userId: string, id: string, fieldValue: Partial<InsertFieldValue>): Promise<FieldValue | undefined>;
  deleteFieldValue(userId: string, id: string): Promise<boolean>;

  // Legacy Profiles
  getProfiles(userId: string): Promise<Profile[]>;
  getProfileById(userId: string, id: string): Promise<Profile | undefined>;

  // Companies
  getCompanies(userId: string): Promise<CompanyWithContacts[]>;
  getCompanyById(userId: string, id: string): Promise<CompanyWithContacts | undefined>;
  createCompany(userId: string, company: InsertCompany): Promise<CompanyWithContacts>;
  updateCompany(userId: string, id: string, company: Partial<InsertCompany>): Promise<CompanyWithContacts | undefined>;
  deleteCompany(userId: string, id: string): Promise<boolean>;
  linkContactToCompany(userId: string, companyId: string, contactId: string): Promise<void>;
  unlinkContactFromCompany(userId: string, companyId: string, contactId: string): Promise<void>;

  // Leads
  getLeads(userId: string): Promise<LeadWithCompanies[]>;
  getLeadById(userId: string, id: number): Promise<LeadWithCompanies | undefined>;
  createLead(userId: string, lead: InsertLead, companies: Omit<InsertLeadCompany, 'leadId'>[]): Promise<LeadWithCompanies>;
  updateLead(userId: string, id: number, lead: Partial<InsertLead>): Promise<Lead | undefined>;
  upsertLeadCompanies(userId: string, leadId: number, companies: Omit<InsertLeadCompany, 'leadId'>[]): Promise<LeadCompany[]>;
  deleteLead(userId: string, id: number): Promise<boolean>;

  // Proposals
  getProposals(userId: string, leadId: number): Promise<ProposalWithPhases[]>;
  getProposalById(userId: string, proposalId: string): Promise<ProposalWithPhases | undefined>;
  createProposal(userId: string, proposal: InsertProposal, phases: { name: string; sortOrder: number; feeLines: { serviceCategory: string; discipline: string; feeType: string; amount: string | null; sortOrder: number }[] }[]): Promise<ProposalWithPhases>;
  updateProposal(userId: string, proposalId: string, updates: Partial<InsertProposal>, phases?: { name: string; sortOrder: number; feeLines: { serviceCategory: string; discipline: string; feeType: string; amount: string | null; sortOrder: number }[] }[]): Promise<ProposalWithPhases | undefined>;
  deleteProposal(userId: string, proposalId: string): Promise<boolean>;
  signProposal(userId: string, proposalId: string): Promise<ProposalWithPhases | undefined>;

  // Invoices
  getInvoices(userId: string, leadId: number): Promise<Invoice[]>;
  getInvoiceById(userId: string, invoiceId: string): Promise<InvoiceWithDetails | undefined>;
  createInvoice(userId: string, leadId: number, proposalId: string, feeLineInputs: { proposalFeeLineId: string; percentComplete?: string; hoursWorked?: string; ratePerHour?: string }[], hoursInputs: { date: string; description: string; hours: string; ratePerHour: string }[], expenseInputs: { date: string; expenseType: string; billedDate?: string; milesTraveled?: string; ratePerMile?: string; amount?: string }[], notes?: string): Promise<InvoiceWithDetails>;
  updateInvoiceStatus(userId: string, invoiceId: string, status: string): Promise<Invoice | undefined>;
  updateInvoiceDocUrl(userId: string, invoiceId: string, docUrl: string): Promise<Invoice | undefined>;
  deleteInvoice(userId: string, invoiceId: string): Promise<boolean>;

  // Hours entries
  createHoursEntry(userId: string, invoiceId: string, leadId: number, entry: { date: string; description: string; hours: string; ratePerHour: string }): Promise<HoursEntry>;
  updateHoursEntry(userId: string, id: string, updates: Partial<{ date: string; description: string; hours: string; ratePerHour: string }>): Promise<HoursEntry | undefined>;
  deleteHoursEntry(userId: string, id: string): Promise<boolean>;

  // Expense entries
  createExpenseEntry(userId: string, invoiceId: string, leadId: number, entry: { date: string; expenseType: string; billedDate?: string; milesTraveled?: string; ratePerMile?: string; amount?: string }): Promise<ExpenseEntry>;
  updateExpenseEntry(userId: string, id: string, updates: Partial<{ date: string; expenseType: string; billedDate?: string; milesTraveled?: string; ratePerMile?: string; amount?: string }>): Promise<ExpenseEntry | undefined>;
  deleteExpenseEntry(userId: string, id: string): Promise<boolean>;

  // Project comments
  getProjectComments(userId: string, leadId: number): Promise<ProjectComment[]>;
  createProjectComment(userId: string, leadId: number, content: string): Promise<ProjectComment>;
  deleteProjectComment(userId: string, commentId: string, leadId: number): Promise<boolean>;

  // Contacts
  getContacts(userId: string): Promise<ContactWithCompanies[]>;
  getContactById(userId: string, id: string): Promise<ContactWithCompanies | undefined>;
  createContact(userId: string, contact: InsertContact, companyIds?: string[]): Promise<ContactWithCompanies>;
  updateContact(userId: string, id: string, contact: Partial<InsertContact>, companyIds?: string[]): Promise<ContactWithCompanies | undefined>;
  deleteContact(userId: string, id: string): Promise<boolean>;
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
    const updateData: Record<string, unknown> = { ...updates, updatedAt: sql`CURRENT_TIMESTAMP` };
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
      .set({ usageCount: sql`${contentSnippets.usageCount} + 1` })
      .where(and(eq(contentSnippets.id, id), eq(contentSnippets.userId, userId)));
  }

  async getFieldValues(userId: string): Promise<FieldValue[]> {
    return await db.select().from(fieldValues).where(eq(fieldValues.userId, userId));
  }

  async getFieldValueById(userId: string, id: string): Promise<FieldValue | undefined> {
    const [fv] = await db
      .select()
      .from(fieldValues)
      .where(and(eq(fieldValues.id, id), eq(fieldValues.userId, userId)));
    return fv || undefined;
  }

  async getFieldValueByName(userId: string, name: string): Promise<FieldValue | undefined> {
    const [fv] = await db
      .select()
      .from(fieldValues)
      .where(and(eq(fieldValues.name, name), eq(fieldValues.userId, userId)));
    return fv || undefined;
  }

  async createFieldValue(userId: string, insertFieldValue: InsertFieldValue): Promise<FieldValue> {
    const [fv] = await db
      .insert(fieldValues)
      .values({ ...insertFieldValue, userId })
      .returning();
    return fv;
  }

  async updateFieldValue(userId: string, id: string, updates: Partial<InsertFieldValue>): Promise<FieldValue | undefined> {
    const [fv] = await db
      .update(fieldValues)
      .set({ ...updates, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(fieldValues.id, id), eq(fieldValues.userId, userId)))
      .returning();
    return fv || undefined;
  }

  async deleteFieldValue(userId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(fieldValues)
      .where(and(eq(fieldValues.id, id), eq(fieldValues.userId, userId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

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

  // ─── Companies ────────────────────────────────────────────────────────────────

  private async attachContactsToCompanies(companyRows: Company[]): Promise<CompanyWithContacts[]> {
    if (companyRows.length === 0) return [];
    const companyIds = companyRows.map(c => c.id);
    const junctionRows = await db
      .select()
      .from(contactCompanies)
      .where(inArray(contactCompanies.companyId, companyIds));
    if (junctionRows.length === 0) return companyRows.map(c => ({ ...c, contacts: [] }));
    const contactIds = junctionRows.map(j => j.contactId);
    const allContacts = await db
      .select()
      .from(contacts)
      .where(inArray(contacts.id, contactIds));
    return companyRows.map(company => ({
      ...company,
      contacts: junctionRows
        .filter(j => j.companyId === company.id)
        .map(j => allContacts.find(c => c.id === j.contactId)!)
        .filter(Boolean),
    }));
  }

  async getCompanies(userId: string): Promise<CompanyWithContacts[]> {
    const rows = await db
      .select()
      .from(companies)
      .where(eq(companies.userId, userId))
      .orderBy(companies.name);
    return this.attachContactsToCompanies(rows);
  }

  async getCompanyById(userId: string, id: string): Promise<CompanyWithContacts | undefined> {
    const [company] = await db
      .select()
      .from(companies)
      .where(and(eq(companies.id, id), eq(companies.userId, userId)));
    if (!company) return undefined;
    const [withContacts] = await this.attachContactsToCompanies([company]);
    return withContacts;
  }

  async createCompany(userId: string, data: InsertCompany): Promise<CompanyWithContacts> {
    const [company] = await db
      .insert(companies)
      .values({ ...data, userId })
      .returning();
    return { ...company, contacts: [] };
  }

  async updateCompany(userId: string, id: string, updates: Partial<InsertCompany>): Promise<CompanyWithContacts | undefined> {
    const [company] = await db
      .update(companies)
      .set(updates)
      .where(and(eq(companies.id, id), eq(companies.userId, userId)))
      .returning();
    if (!company) return undefined;
    const [withContacts] = await this.attachContactsToCompanies([company]);
    return withContacts;
  }

  async deleteCompany(userId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(companies)
      .where(and(eq(companies.id, id), eq(companies.userId, userId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async linkContactToCompany(userId: string, companyId: string, contactId: string): Promise<void> {
    // Verify ownership
    const [co] = await db.select({ id: companies.id }).from(companies).where(and(eq(companies.id, companyId), eq(companies.userId, userId)));
    if (!co) throw new Error('Company not found');
    const [ct] = await db.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.id, contactId), eq(contacts.userId, userId)));
    if (!ct) throw new Error('Contact not found');
    await db
      .insert(contactCompanies)
      .values({ contactId, companyId })
      .onConflictDoNothing();
  }

  async unlinkContactFromCompany(userId: string, companyId: string, contactId: string): Promise<void> {
    const [co] = await db.select({ id: companies.id }).from(companies).where(and(eq(companies.id, companyId), eq(companies.userId, userId)));
    if (!co) throw new Error('Company not found');
    await db
      .delete(contactCompanies)
      .where(and(eq(contactCompanies.companyId, companyId), eq(contactCompanies.contactId, contactId)));
  }

  // ─── Leads ───────────────────────────────────────────────────────────────────

  private async attachCompanies(leadRows: Lead[]): Promise<LeadWithCompanies[]> {
    if (leadRows.length === 0) return [];
    const ids = leadRows.map(l => l.id);
    const allLeadCompanies = await db
      .select()
      .from(leadCompanies)
      .where(inArray(leadCompanies.leadId, ids));

    // Collect unique FK IDs to join address-book records
    const linkedCompanyIds = Array.from(new Set(allLeadCompanies.map(c => c.companyId).filter(Boolean) as string[]));
    const linkedContactIds = Array.from(new Set(allLeadCompanies.map(c => c.contactId).filter(Boolean) as string[]));

    const [linkedCompanyRows, linkedContactRows] = await Promise.all([
      linkedCompanyIds.length > 0
        ? db.select().from(companies).where(inArray(companies.id, linkedCompanyIds))
        : Promise.resolve([] as Company[]),
      linkedContactIds.length > 0
        ? db.select().from(contacts).where(inArray(contacts.id, linkedContactIds))
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
    const [enriched] = await this.attachCompanies([lead]);
    return enriched;
  }

  async createLead(userId: string, leadData: InsertLead, companiesData: Omit<InsertLeadCompany, 'leadId'>[]): Promise<LeadWithCompanies> {
    const [lead] = await db.insert(leads).values({ ...leadData, userId }).returning();
    if (companiesData.length > 0) {
      await db
        .insert(leadCompanies)
        .values(companiesData.map(c => ({ ...c, leadId: lead.id })));
    }
    const [enriched] = await this.attachCompanies([lead]);
    return enriched;
  }

  async updateLead(userId: string, id: number, updates: Partial<InsertLead>): Promise<Lead | undefined> {
    const [lead] = await db
      .update(leads)
      .set({ ...updates, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(leads.id, id), eq(leads.userId, userId)))
      .returning();
    return lead || undefined;
  }

  async upsertLeadCompanies(userId: string, leadId: number, companiesData: Omit<InsertLeadCompany, 'leadId'>[]): Promise<LeadCompany[]> {
    const [existingLead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.userId, userId)));
    if (!existingLead) throw new Error(`Lead not found or access denied`);

    await db.delete(leadCompanies).where(eq(leadCompanies.leadId, leadId));
    if (companiesData.length === 0) return [];
    return await db
      .insert(leadCompanies)
      .values(companiesData.map(c => ({ ...c, leadId })))
      .returning();
  }

  async deleteLead(userId: string, id: number): Promise<boolean> {
    const result = await db
      .delete(leads)
      .where(and(eq(leads.id, id), eq(leads.userId, userId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ─── Proposals ───────────────────────────────────────────────────────────────

  private async verifyLeadOwnership(userId: string, leadId: number): Promise<boolean> {
    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.userId, userId)));
    return !!lead;
  }

  private async buildProposalWithPhases(proposal: Proposal): Promise<ProposalWithPhases> {
    const phases = await db
      .select()
      .from(proposalPhases)
      .where(eq(proposalPhases.proposalId, proposal.id))
      .orderBy(proposalPhases.sortOrder);

    if (phases.length === 0) return { ...proposal, phases: [] };

    const phaseIds = phases.map(p => p.id);
    const allFeeLines = await db
      .select()
      .from(proposalFeeLines)
      .where(inArray(proposalFeeLines.phaseId, phaseIds))
      .orderBy(proposalFeeLines.sortOrder);

    const phasesWithLines: ProposalPhaseWithLines[] = phases.map(phase => ({
      ...phase,
      feeLines: allFeeLines.filter(fl => fl.phaseId === phase.id),
    }));

    return { ...proposal, phases: phasesWithLines };
  }

  async getProposals(userId: string, leadId: number): Promise<ProposalWithPhases[]> {
    const owned = await this.verifyLeadOwnership(userId, leadId);
    if (!owned) return [];

    const proposalRows = await db
      .select()
      .from(proposals)
      .where(eq(proposals.leadId, leadId))
      .orderBy(proposals.createdAt);

    return Promise.all(proposalRows.map(p => this.buildProposalWithPhases(p)));
  }

  async getProposalById(userId: string, proposalId: string): Promise<ProposalWithPhases | undefined> {
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, proposalId));
    if (!proposal) return undefined;
    const owned = await this.verifyLeadOwnership(userId, proposal.leadId);
    if (!owned) return undefined;
    return this.buildProposalWithPhases(proposal);
  }

  private toProposalDbValues(data: Partial<InsertProposal>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...data };
    if ('dateSent' in data) result.dateSent = data.dateSent ? new Date(data.dateSent as string) : null;
    if ('dateSigned' in data) result.dateSigned = data.dateSigned ? new Date(data.dateSigned as string) : null;
    return result;
  }

  async createProposal(
    userId: string,
    proposalData: InsertProposal,
    phases: { name: string; sortOrder: number; feeLines: { serviceCategory: string; discipline: string; feeType: string; amount: string | null; sortOrder: number }[] }[]
  ): Promise<ProposalWithPhases> {
    const owned = await this.verifyLeadOwnership(userId, proposalData.leadId);
    if (!owned) throw new Error('Lead not found or access denied');

    const [proposal] = await db.insert(proposals).values(this.toProposalDbValues(proposalData) as typeof proposals.$inferInsert).returning();

    const phasesWithLines: ProposalPhaseWithLines[] = [];
    for (const phaseData of phases) {
      const [phase] = await db
        .insert(proposalPhases)
        .values({ proposalId: proposal.id, name: phaseData.name, sortOrder: phaseData.sortOrder })
        .returning();

      const feeLineRows = phaseData.feeLines.filter(fl => fl.amount || fl.feeType === 'Hourly');
      let savedLines: ProposalFeeLine[] = [];
      if (feeLineRows.length > 0) {
        savedLines = await db
          .insert(proposalFeeLines)
          .values(feeLineRows.map(fl => ({
            phaseId: phase.id,
            serviceCategory: fl.serviceCategory,
            discipline: fl.discipline,
            feeType: fl.feeType,
            amount: fl.amount || null,
            sortOrder: fl.sortOrder,
          })))
          .returning();
      }
      phasesWithLines.push({ ...phase, feeLines: savedLines });
    }

    return { ...proposal, phases: phasesWithLines };
  }

  async updateProposal(
    userId: string,
    proposalId: string,
    updates: Partial<InsertProposal>,
    phases?: { name: string; sortOrder: number; feeLines: { serviceCategory: string; discipline: string; feeType: string; amount: string | null; sortOrder: number }[] }[]
  ): Promise<ProposalWithPhases | undefined> {
    const existing = await this.getProposalById(userId, proposalId);
    if (!existing) return undefined;

    const { leadId: _leadId, id: _id, userId: _userId, ...safeUpdates } = updates as Record<string, unknown>;
    void _leadId; void _id; void _userId;
    const [updated] = await db
      .update(proposals)
      .set({ ...this.toProposalDbValues(safeUpdates as Partial<InsertProposal>), updatedAt: sql`CURRENT_TIMESTAMP` } as Parameters<ReturnType<typeof db.update>["set"]>[0])
      .where(eq(proposals.id, proposalId))
      .returning();

    if (phases !== undefined) {
      const existingPhaseIds = existing.phases.map(p => p.id);
      if (existingPhaseIds.length > 0) {
        await db.delete(proposalFeeLines).where(inArray(proposalFeeLines.phaseId, existingPhaseIds));
      }
      await db.delete(proposalPhases).where(eq(proposalPhases.proposalId, proposalId));

      for (const phaseData of phases) {
        const [phase] = await db
          .insert(proposalPhases)
          .values({ proposalId, name: phaseData.name, sortOrder: phaseData.sortOrder })
          .returning();
        const feeLineRows = phaseData.feeLines.filter(fl => fl.amount || fl.feeType === 'Hourly');
        if (feeLineRows.length > 0) {
          await db.insert(proposalFeeLines).values(
            feeLineRows.map(fl => ({
              phaseId: phase.id,
              serviceCategory: fl.serviceCategory,
              discipline: fl.discipline,
              feeType: fl.feeType,
              amount: fl.amount || null,
              sortOrder: fl.sortOrder,
            }))
          );
        }
      }
    }

    return this.buildProposalWithPhases(updated);
  }

  async deleteProposal(userId: string, proposalId: string): Promise<boolean> {
    const existing = await this.getProposalById(userId, proposalId);
    if (!existing) return false;
    const result = await db.delete(proposals).where(eq(proposals.id, proposalId));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async signProposal(userId: string, proposalId: string): Promise<ProposalWithPhases | undefined> {
    const existing = await this.getProposalById(userId, proposalId);
    if (!existing) return undefined;

    const [updated] = await db
      .update(proposals)
      .set({ status: 'Signed', dateSigned: sql`NOW()`, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(proposals.id, proposalId))
      .returning();

    await db
      .update(leads)
      .set({ status: 'Active Project', updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(leads.id, existing.leadId), eq(leads.userId, userId)));

    return this.buildProposalWithPhases(updated);
  }

  // ─── Invoices ─────────────────────────────────────────────────────────────────

  async getInvoices(userId: string, leadId: number): Promise<Invoice[]> {
    const owned = await this.verifyLeadOwnership(userId, leadId);
    if (!owned) return [];
    return db.select().from(invoices).where(eq(invoices.leadId, leadId)).orderBy(invoices.invoiceNumber);
  }

  async getInvoiceById(userId: string, invoiceId: string): Promise<InvoiceWithDetails | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
    if (!invoice) return undefined;
    const owned = await this.verifyLeadOwnership(userId, invoice.leadId);
    if (!owned) return undefined;

    const [snapshots, hours, expenses] = await Promise.all([
      db.select().from(invoiceFeeLineSnapshots).where(eq(invoiceFeeLineSnapshots.invoiceId, invoiceId)).orderBy(invoiceFeeLineSnapshots.sortOrder),
      db.select().from(hoursEntries).where(eq(hoursEntries.invoiceId, invoiceId)),
      db.select().from(expenseEntries).where(eq(expenseEntries.invoiceId, invoiceId)),
    ]);

    return { ...invoice, feeLineSnapshots: snapshots, hoursEntries: hours, expenseEntries: expenses };
  }

  async createInvoice(
    userId: string,
    leadId: number,
    proposalId: string,
    feeLineInputs: { proposalFeeLineId: string; percentComplete?: string; hoursWorked?: string; ratePerHour?: string }[],
    hoursInputs: { date: string; description: string; hours: string; ratePerHour: string }[],
    expenseInputs: { date: string; expenseType: string; billedDate?: string; milesTraveled?: string; ratePerMile?: string; amount?: string }[],
    notes?: string
  ): Promise<InvoiceWithDetails> {
    const owned = await this.verifyLeadOwnership(userId, leadId);
    if (!owned) throw new Error('Lead not found or access denied');

    const [proposalRow] = await db.select({ leadId: proposals.leadId, status: proposals.status }).from(proposals).where(eq(proposals.id, proposalId));
    if (!proposalRow || proposalRow.leadId !== leadId) throw new Error('Proposal not found or does not belong to this lead');
    if (proposalRow.status !== 'Signed') throw new Error('Invoices can only be created against a signed proposal');

    const existingInvoices = await db.select({ num: invoices.invoiceNumber }).from(invoices).where(eq(invoices.leadId, leadId));
    const nextNumber = existingInvoices.length > 0 ? Math.max(...existingInvoices.map(i => i.num)) + 1 : 1;

    const [invoice] = await db
      .insert(invoices)
      .values({ leadId, proposalId, invoiceNumber: nextNumber, notes: notes || null })
      .returning();

    const proposalFeeLineIds = feeLineInputs.map(f => f.proposalFeeLineId);
    const allProposalFeeLines = proposalFeeLineIds.length > 0
      ? await db.select().from(proposalFeeLines).where(inArray(proposalFeeLines.id, proposalFeeLineIds))
      : [];

    if (allProposalFeeLines.length > 0) {
      const phaseIds = allProposalFeeLines.map(fl => fl.phaseId);
      const validPhases = await db.select({ id: proposalPhases.id }).from(proposalPhases).where(and(inArray(proposalPhases.id, phaseIds), eq(proposalPhases.proposalId, proposalId)));
      const validPhaseIds = new Set(validPhases.map(p => p.id));
      const invalidLine = allProposalFeeLines.find(fl => !validPhaseIds.has(fl.phaseId));
      if (invalidLine) throw new Error('One or more fee lines do not belong to this proposal');
    }

    const feeLineRows = allProposalFeeLines;
    const previousBillingMap = new Map<string, number>();
    const priorInvoices = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.leadId, leadId), eq(invoices.proposalId, proposalId)));
    const priorInvoiceIds = priorInvoices.map(i => i.id).filter(id => id !== invoice.id);

    if (priorInvoiceIds.length > 0) {
      const priorSnapshots = await db
        .select()
        .from(invoiceFeeLineSnapshots)
        .where(inArray(invoiceFeeLineSnapshots.invoiceId, priorInvoiceIds));
      for (const snap of priorSnapshots) {
        const billed = parseFloat(snap.currentBilling || '0');
        previousBillingMap.set(snap.proposalFeeLineId, (previousBillingMap.get(snap.proposalFeeLineId) || 0) + billed);
      }
    }

    const snapshotValues: (typeof invoiceFeeLineSnapshots.$inferInsert)[] = [];
    let sortIdx = 0;
    for (const input of feeLineInputs) {
      const feeLine = feeLineRows.find(fl => fl.id === input.proposalFeeLineId);
      if (!feeLine) continue;

      const baseFee = feeLine.amount ? parseFloat(feeLine.amount) : null;
      const prevBilling = previousBillingMap.get(feeLine.id) || 0;

      let percentComplete: string | null = null;
      let earned: string | null = null;
      let currentBilling: string | null = null;
      let hoursWorked: string | null = null;
      let ratePerHour: string | null = null;

      if (feeLine.feeType === 'Fixed' && baseFee !== null) {
        const pct = parseFloat(input.percentComplete || '0');
        const earnedVal = baseFee * pct / 100;
        const curBilling = Math.max(0, earnedVal - prevBilling);
        percentComplete = pct.toFixed(2);
        earned = earnedVal.toFixed(2);
        currentBilling = curBilling.toFixed(2);
      } else if (feeLine.feeType === 'Hourly') {
        hoursWorked = input.hoursWorked || '0';
        ratePerHour = input.ratePerHour || '0';
        const earnedVal = parseFloat(hoursWorked) * parseFloat(ratePerHour);
        earned = earnedVal.toFixed(2);
        currentBilling = earnedVal.toFixed(2);
      }

      snapshotValues.push({
        invoiceId: invoice.id,
        proposalFeeLineId: feeLine.id,
        serviceCategory: feeLine.serviceCategory,
        discipline: feeLine.discipline,
        feeType: feeLine.feeType,
        baseFee: baseFee !== null ? baseFee.toFixed(2) : null,
        percentComplete,
        earned,
        previousBilling: prevBilling.toFixed(2),
        currentBilling,
        hoursWorked,
        ratePerHour,
        sortOrder: sortIdx++,
      });
    }

    let savedSnapshots: InvoiceFeeLineSnapshot[] = [];
    if (snapshotValues.length > 0) {
      savedSnapshots = await db.insert(invoiceFeeLineSnapshots).values(snapshotValues).returning();
    }

    let savedHours: HoursEntry[] = [];
    if (hoursInputs.length > 0) {
      savedHours = await db.insert(hoursEntries).values(
        hoursInputs.map(h => ({ invoiceId: invoice.id, leadId, ...h }))
      ).returning();
    }

    let savedExpenses: ExpenseEntry[] = [];
    if (expenseInputs.length > 0) {
      savedExpenses = await db.insert(expenseEntries).values(
        expenseInputs.map(e => ({
          invoiceId: invoice.id,
          leadId,
          date: e.date,
          expenseType: e.expenseType,
          billedDate: e.billedDate || null,
          milesTraveled: e.milesTraveled || null,
          ratePerMile: e.ratePerMile || null,
          amount: e.amount || null,
        }))
      ).returning();
    }

    return {
      ...invoice,
      feeLineSnapshots: savedSnapshots,
      hoursEntries: savedHours,
      expenseEntries: savedExpenses,
    };
  }

  async updateInvoiceStatus(userId: string, invoiceId: string, status: string): Promise<Invoice | undefined> {
    const existing = await this.getInvoiceById(userId, invoiceId);
    if (!existing) return undefined;
    const [updated] = await db
      .update(invoices)
      .set({ status, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(invoices.id, invoiceId))
      .returning();
    return updated || undefined;
  }

  async updateInvoiceDocUrl(userId: string, invoiceId: string, docUrl: string): Promise<Invoice | undefined> {
    const existing = await this.getInvoiceById(userId, invoiceId);
    if (!existing) return undefined;
    const [updated] = await db
      .update(invoices)
      .set({ docUrl, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(invoices.id, invoiceId))
      .returning();
    return updated || undefined;
  }

  async deleteInvoice(userId: string, invoiceId: string): Promise<boolean> {
    const existing = await this.getInvoiceById(userId, invoiceId);
    if (!existing) return false;
    const result = await db.delete(invoices).where(eq(invoices.id, invoiceId));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ─── Hours Entries ────────────────────────────────────────────────────────────

  async createHoursEntry(userId: string, invoiceId: string, leadId: number, entry: { date: string; description: string; hours: string; ratePerHour: string }): Promise<HoursEntry> {
    const owned = await this.verifyLeadOwnership(userId, leadId);
    if (!owned) throw new Error('Access denied');
    const [row] = await db.insert(hoursEntries).values({ invoiceId, leadId, ...entry }).returning();
    return row;
  }

  async updateHoursEntry(userId: string, id: string, updates: Partial<{ date: string; description: string; hours: string; ratePerHour: string }>): Promise<HoursEntry | undefined> {
    const [existing] = await db.select().from(hoursEntries).where(eq(hoursEntries.id, id));
    if (!existing) return undefined;
    const owned = await this.verifyLeadOwnership(userId, existing.leadId);
    if (!owned) return undefined;
    const [updated] = await db.update(hoursEntries).set(updates).where(eq(hoursEntries.id, id)).returning();
    return updated || undefined;
  }

  async deleteHoursEntry(userId: string, id: string): Promise<boolean> {
    const [existing] = await db.select().from(hoursEntries).where(eq(hoursEntries.id, id));
    if (!existing) return false;
    const owned = await this.verifyLeadOwnership(userId, existing.leadId);
    if (!owned) return false;
    const result = await db.delete(hoursEntries).where(eq(hoursEntries.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ─── Expense Entries ──────────────────────────────────────────────────────────

  async createExpenseEntry(userId: string, invoiceId: string, leadId: number, entry: { date: string; expenseType: string; billedDate?: string; milesTraveled?: string; ratePerMile?: string; amount?: string }): Promise<ExpenseEntry> {
    const owned = await this.verifyLeadOwnership(userId, leadId);
    if (!owned) throw new Error('Access denied');
    const [row] = await db.insert(expenseEntries).values({
      invoiceId,
      leadId,
      date: entry.date,
      expenseType: entry.expenseType,
      billedDate: entry.billedDate || null,
      milesTraveled: entry.milesTraveled || null,
      ratePerMile: entry.ratePerMile || null,
      amount: entry.amount || null,
    }).returning();
    return row;
  }

  async updateExpenseEntry(userId: string, id: string, updates: Partial<{ date: string; expenseType: string; billedDate?: string; milesTraveled?: string; ratePerMile?: string; amount?: string }>): Promise<ExpenseEntry | undefined> {
    const [existing] = await db.select().from(expenseEntries).where(eq(expenseEntries.id, id));
    if (!existing) return undefined;
    const owned = await this.verifyLeadOwnership(userId, existing.leadId);
    if (!owned) return undefined;
    const [updated] = await db.update(expenseEntries).set(updates).where(eq(expenseEntries.id, id)).returning();
    return updated || undefined;
  }

  async deleteExpenseEntry(userId: string, id: string): Promise<boolean> {
    const [existing] = await db.select().from(expenseEntries).where(eq(expenseEntries.id, id));
    if (!existing) return false;
    const owned = await this.verifyLeadOwnership(userId, existing.leadId);
    if (!owned) return false;
    const result = await db.delete(expenseEntries).where(eq(expenseEntries.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ─── Project Comments ─────────────────────────────────────────────────────────

  async getProjectComments(userId: string, leadId: number): Promise<ProjectComment[]> {
    const owned = await this.verifyLeadOwnership(userId, leadId);
    if (!owned) return [];
    return db.select().from(projectComments).where(eq(projectComments.leadId, leadId)).orderBy(projectComments.createdAt);
  }

  async getProposalBillingSummary(userId: string, proposalId: string): Promise<Record<string, number>> {
    const [proposal] = await db.select({ leadId: proposals.leadId }).from(proposals).where(eq(proposals.id, proposalId));
    if (!proposal) return {};
    const owned = await this.verifyLeadOwnership(userId, proposal.leadId);
    if (!owned) return {};

    const allInvoices = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.proposalId, proposalId));
    if (allInvoices.length === 0) return {};

    const allInvoiceIds = allInvoices.map(i => i.id);
    const snapshots = await db
      .select({ proposalFeeLineId: invoiceFeeLineSnapshots.proposalFeeLineId, currentBilling: invoiceFeeLineSnapshots.currentBilling })
      .from(invoiceFeeLineSnapshots)
      .where(inArray(invoiceFeeLineSnapshots.invoiceId, allInvoiceIds));

    const summary: Record<string, number> = {};
    for (const snap of snapshots) {
      const billed = parseFloat(snap.currentBilling || '0');
      summary[snap.proposalFeeLineId] = (summary[snap.proposalFeeLineId] || 0) + billed;
    }
    return summary;
  }

  async createProjectComment(userId: string, leadId: number, content: string): Promise<ProjectComment> {
    const owned = await this.verifyLeadOwnership(userId, leadId);
    if (!owned) throw new Error('Access denied');
    const [row] = await db.insert(projectComments).values({ leadId, content }).returning();
    return row;
  }

  async deleteProjectComment(userId: string, commentId: string, leadId: number): Promise<boolean> {
    const owned = await this.verifyLeadOwnership(userId, leadId);
    if (!owned) return false;
    const result = await db.delete(projectComments).where(and(eq(projectComments.id, commentId), eq(projectComments.leadId, leadId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getDashboardStats(userId: string): Promise<DashboardStats> {
    const allLeads = await this.getLeads(userId);
    const leadsByStatus: Record<string, number> = {};
    for (const lead of allLeads) {
      leadsByStatus[lead.status] = (leadsByStatus[lead.status] || 0) + 1;
    }

    const allUserLeadIds = allLeads.map(l => l.id);
    let sentInvoicesTotal = 0;
    let paidInvoicesTotal = 0;

    if (allUserLeadIds.length > 0) {
      const allInvoices = await db
        .select()
        .from(invoices)
        .where(inArray(invoices.leadId, allUserLeadIds));

      const sentAndPaid = allInvoices.filter(i => i.status === 'Sent' || i.status === 'Paid');
      if (sentAndPaid.length > 0) {
        const invoiceIds = sentAndPaid.map(i => i.id);
        const [allSnapshots, allHours, allExpenses] = await Promise.all([
          db.select().from(invoiceFeeLineSnapshots).where(inArray(invoiceFeeLineSnapshots.invoiceId, invoiceIds)),
          db.select().from(hoursEntries).where(inArray(hoursEntries.invoiceId, invoiceIds)),
          db.select().from(expenseEntries).where(inArray(expenseEntries.invoiceId, invoiceIds)),
        ]);

        for (const invoice of sentAndPaid) {
          const snaps = allSnapshots.filter(s => s.invoiceId === invoice.id);
          const feeTotal = snaps.reduce((sum, s) => sum + parseFloat(s.currentBilling || '0'), 0);

          const hoursTotal = allHours
            .filter(h => h.invoiceId === invoice.id)
            .reduce((sum, h) => sum + parseFloat(h.hours || '0') * parseFloat(h.ratePerHour || '0'), 0);

          const expenseTotal = allExpenses
            .filter(e => e.invoiceId === invoice.id)
            .reduce((sum, e) => {
              if (e.milesTraveled) return sum + parseFloat(e.milesTraveled) * parseFloat(e.ratePerMile || '0.67');
              return sum + parseFloat(e.amount || '0');
            }, 0);

          const total = feeTotal + hoursTotal + expenseTotal;
          if (invoice.status === 'Sent') sentInvoicesTotal += total;
          if (invoice.status === 'Paid') paidInvoicesTotal += total;
        }
      }
    }

    const recentLeads = allLeads.slice(-6).reverse();

    return { leadsByStatus, sentInvoicesTotal, paidInvoicesTotal, recentLeads };
  }

  // ─── Contacts ─────────────────────────────────────────────────────────────────

  private async attachCompaniesToContacts(contactRows: Contact[]): Promise<ContactWithCompanies[]> {
    if (contactRows.length === 0) return [];
    const contactIds = contactRows.map(c => c.id);
    const junctionRows = await db
      .select()
      .from(contactCompanies)
      .where(inArray(contactCompanies.contactId, contactIds));
    if (junctionRows.length === 0) return contactRows.map(c => ({ ...c, companies: [] }));
    const companyIds = junctionRows.map(j => j.companyId);
    const allCompanies = await db
      .select()
      .from(companies)
      .where(inArray(companies.id, companyIds));
    return contactRows.map(contact => ({
      ...contact,
      companies: junctionRows
        .filter(j => j.contactId === contact.id)
        .map(j => allCompanies.find(c => c.id === j.companyId)!)
        .filter(Boolean),
    }));
  }

  async getContacts(userId: string): Promise<ContactWithCompanies[]> {
    const rows = await db
      .select()
      .from(contacts)
      .where(eq(contacts.userId, userId))
      .orderBy(contacts.fullName);
    return this.attachCompaniesToContacts(rows);
  }

  async getContactById(userId: string, id: string): Promise<ContactWithCompanies | undefined> {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.userId, userId)));
    if (!contact) return undefined;
    const [withCompanies] = await this.attachCompaniesToContacts([contact]);
    return withCompanies;
  }

  private async verifyCompanyOwnership(userId: string, companyIds: string[]): Promise<string[]> {
    if (companyIds.length === 0) return [];
    const owned = await db
      .select({ id: companies.id })
      .from(companies)
      .where(and(inArray(companies.id, companyIds), eq(companies.userId, userId)));
    return owned.map(c => c.id);
  }

  async createContact(userId: string, data: InsertContact, companyIds?: string[]): Promise<ContactWithCompanies> {
    const [contact] = await db
      .insert(contacts)
      .values({ ...data, userId })
      .returning();
    if (companyIds && companyIds.length > 0) {
      const validIds = await this.verifyCompanyOwnership(userId, companyIds);
      if (validIds.length > 0) {
        await db.insert(contactCompanies).values(
          validIds.map(companyId => ({ contactId: contact.id, companyId }))
        ).onConflictDoNothing();
      }
    }
    const [withCompanies] = await this.attachCompaniesToContacts([contact]);
    return withCompanies;
  }

  async updateContact(userId: string, id: string, updates: Partial<InsertContact>, companyIds?: string[]): Promise<ContactWithCompanies | undefined> {
    const [contact] = await db
      .update(contacts)
      .set(updates)
      .where(and(eq(contacts.id, id), eq(contacts.userId, userId)))
      .returning();
    if (!contact) return undefined;
    if (companyIds !== undefined) {
      const validIds = await this.verifyCompanyOwnership(userId, companyIds);
      await db.delete(contactCompanies).where(eq(contactCompanies.contactId, id));
      if (validIds.length > 0) {
        await db.insert(contactCompanies).values(
          validIds.map(companyId => ({ contactId: id, companyId }))
        ).onConflictDoNothing();
      }
    }
    const [withCompanies] = await this.attachCompaniesToContacts([contact]);
    return withCompanies;
  }

  async deleteContact(userId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.userId, userId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ─── Migration: backfill lead_companies text data into address book ────────────
  // Idempotent: skip rows that already have companyId/contactId set.

  async migrateLeadCompaniesToAddressBook(userId: string): Promise<{ companiesCreated: number; contactsCreated: number; rowsUpdated: number }> {
    const userLeads = await db.select().from(leads).where(eq(leads.userId, userId));
    if (userLeads.length === 0) return { companiesCreated: 0, contactsCreated: 0, rowsUpdated: 0 };

    const leadIds = userLeads.map(l => l.id);
    // Only process rows that don't already have a companyId set
    const rows = await db.select().from(leadCompanies).where(inArray(leadCompanies.leadId, leadIds));
    const unlinked = rows.filter(r => !r.companyId);

    let companiesCreated = 0;
    let contactsCreated = 0;
    let rowsUpdated = 0;

    // Cache to avoid creating duplicates within this run
    const companyCache = new Map<string, string>(); // lowerName -> id
    const contactEmailCache = new Map<string, string>(); // lowerEmail -> id
    const contactNameCache = new Map<string, string>(); // lowerFullName -> id

    // Pre-load existing companies and contacts for this user
    const existingCompanies = await db.select().from(companies).where(eq(companies.userId, userId));
    const existingContacts = await db.select().from(contacts).where(eq(contacts.userId, userId));
    for (const c of existingCompanies) companyCache.set(c.name.toLowerCase(), c.id);
    for (const c of existingContacts) {
      if (c.email) contactEmailCache.set(c.email.toLowerCase(), c.id);
      contactNameCache.set(c.fullName.toLowerCase(), c.id);
    }

    for (const row of unlinked) {
      let companyId: string | null = null;
      let contactId: string | null = null;

      // Find or create company by name (case-insensitive)
      if (row.companyName) {
        const key = row.companyName.toLowerCase();
        if (companyCache.has(key)) {
          companyId = companyCache.get(key)!;
        } else {
          const [newCompany] = await db.insert(companies).values({
            userId,
            name: row.companyName,
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
      }

      // Find or create contact: prefer email match, fallback to name match
      if (row.contactFullName) {
        // 1) Try email match first (most reliable dedup key)
        if (row.contactEmail) {
          const emailKey = row.contactEmail.toLowerCase();
          if (contactEmailCache.has(emailKey)) {
            contactId = contactEmailCache.get(emailKey)!;
          }
        }
        // 2) Try name match
        if (!contactId) {
          const nameKey = row.contactFullName.toLowerCase();
          if (contactNameCache.has(nameKey)) {
            contactId = contactNameCache.get(nameKey)!;
          }
        }
        // 3) Create new contact
        if (!contactId) {
          const [newContact] = await db.insert(contacts).values({
            userId,
            fullName: row.contactFullName,
            title: row.contactTitle,
            phone: row.contactPhone,
            email: row.contactEmail,
            companyName: row.companyName,
          }).returning();
          contactId = newContact.id;
          if (newContact.email) contactEmailCache.set(newContact.email.toLowerCase(), contactId);
          contactNameCache.set(row.contactFullName.toLowerCase(), contactId);
          contactsCreated++;
        }

        // Link contact to company if both exist
        if (companyId && contactId) {
          await db.insert(contactCompanies).values({ contactId, companyId }).onConflictDoNothing();
        }
      }

      if (companyId || contactId) {
        await db.update(leadCompanies)
          .set({ companyId: companyId || undefined, contactId: contactId || undefined })
          .where(eq(leadCompanies.id, row.id));
        rowsUpdated++;
      }
    }

    return { companiesCreated, contactsCreated, rowsUpdated };
  }
}

export const storage = new DatabaseStorage();
