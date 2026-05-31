import * as docBuilder from "./repositories/doc-builder";
import * as companiesRepo from "./repositories/companies";
import * as leadsRepo from "./repositories/leads";
import * as proposalsRepo from "./repositories/proposals";
import * as invoicesRepo from "./repositories/invoices";
import type {
  Category,
  InsertCategory,
  ContentSnippet,
  InsertContentSnippet,
  Profile,
  FieldValue,
  InsertFieldValue,
  Lead,
  InsertLead,
  LeadCompany,
  InsertLeadCompany,
  LeadWithCompanies,
  Company,
  InsertCompany,
  CompanyWithContacts,
  Contact,
  InsertContact,
  ContactWithCompanies,
  Proposal,
  InsertProposal,
  ProposalWithPhases,
  ProposalPhaseInput,
  AdditionalLineItemInput,
  Invoice,
  InvoiceWithDetails,
  InvoiceFeeLineSnapshotInput,
  InvoiceHoursInput,
  InvoiceExpenseInput,
  InvoiceAdditionalLineItemInput,
  HoursEntry,
  ExpenseEntry,
  ProjectComment,
  ConsultantContract,
} from "@shared/schema";

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
  deleteFieldValuesByPrefixes(userId: string, prefixes: string[]): Promise<number>;

  // User Profile
  getMyProfile(userId: string): Promise<Profile | undefined>;
  upsertProfile(userId: string, data: Partial<Profile>): Promise<Profile>;

  // Companies
  getCompanies(userId: string): Promise<CompanyWithContacts[]>;
  getCompanyById(userId: string, id: string): Promise<CompanyWithContacts | undefined>;
  createCompany(userId: string, company: InsertCompany, contactIds?: string[]): Promise<CompanyWithContacts>;
  updateCompany(userId: string, id: string, company: Partial<InsertCompany>, contactIds?: string[]): Promise<CompanyWithContacts | undefined>;
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
  createProposal(userId: string, proposal: InsertProposal, phases: ProposalPhaseInput[], additionalLineItems?: AdditionalLineItemInput[]): Promise<ProposalWithPhases>;
  updateProposal(userId: string, proposalId: string, updates: Partial<InsertProposal>, phases?: ProposalPhaseInput[], additionalLineItems?: AdditionalLineItemInput[]): Promise<ProposalWithPhases | undefined>;
  deleteProposal(userId: string, proposalId: string): Promise<boolean>;
  signProposal(userId: string, proposalId: string): Promise<ProposalWithPhases | undefined>;

  // Invoices
  getInvoices(userId: string, leadId: number): Promise<Invoice[]>;
  getInvoiceById(userId: string, invoiceId: string): Promise<InvoiceWithDetails | undefined>;
  createInvoice(userId: string, leadId: number, proposalId: string, feeLineInputs: InvoiceFeeLineSnapshotInput[], hoursInputs: InvoiceHoursInput[], expenseInputs: InvoiceExpenseInput[], notes?: string, existingHoursIds?: string[], existingExpenseIds?: string[], additionalLineItemInputs?: InvoiceAdditionalLineItemInput[]): Promise<InvoiceWithDetails>;
  updateInvoiceStatus(userId: string, invoiceId: string, status: string): Promise<Invoice | undefined>;
  updateInvoiceDocUrl(userId: string, invoiceId: string, docUrl: string): Promise<Invoice | undefined>;
  deleteInvoice(userId: string, invoiceId: string): Promise<boolean>;

  // Project-level time & expense
  getProjectHours(userId: string, leadId: number): Promise<HoursEntry[]>;
  getProjectExpenses(userId: string, leadId: number): Promise<ExpenseEntry[]>;

  // Hours entries
  createHoursEntry(userId: string, invoiceId: string | null, leadId: number, entry: { date: string; description: string; hours: string; ratePerHour: string }): Promise<HoursEntry>;
  updateHoursEntry(userId: string, id: string, updates: Partial<{ date: string; description: string; hours: string; ratePerHour: string; invoiceId: string | null }>): Promise<HoursEntry | undefined>;
  deleteHoursEntry(userId: string, id: string): Promise<boolean>;

  // Expense entries
  createExpenseEntry(userId: string, invoiceId: string | null, leadId: number, entry: { date: string; expenseType: string; billedDate?: string; milesTraveled?: string; ratePerMile?: string; amount?: string }): Promise<ExpenseEntry>;
  updateExpenseEntry(userId: string, id: string, updates: Partial<{ date: string; expenseType: string; billedDate?: string; milesTraveled?: string; ratePerMile?: string; amount?: string; invoiceId: string | null }>): Promise<ExpenseEntry | undefined>;
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

  // Consultant Contracts
  getConsultantContracts(proposalId: string): Promise<ConsultantContract[]>;
  upsertConsultantContract(proposalId: string, consultant: string, docUrl: string): Promise<ConsultantContract>;
}

export class DatabaseStorage implements IStorage {
  // Dashboard
  getDashboardStats(userId: string) { return invoicesRepo.getDashboardStats(userId); }

  // Categories
  getCategories(userId: string) { return docBuilder.getCategories(userId); }
  createCategory(userId: string, data: InsertCategory) { return docBuilder.createCategory(userId, data); }
  updateCategory(userId: string, id: string, data: Partial<InsertCategory>) { return docBuilder.updateCategory(userId, id, data); }
  deleteCategory(userId: string, id: string) { return docBuilder.deleteCategory(userId, id); }

  // Content Snippets
  getContentSnippets(userId: string) { return docBuilder.getContentSnippets(userId); }
  getContentSnippetById(userId: string, id: string) { return docBuilder.getContentSnippetById(userId, id); }
  createContentSnippet(userId: string, data: InsertContentSnippet, embeddedFields?: string[]) { return docBuilder.createContentSnippet(userId, data, embeddedFields); }
  updateContentSnippet(userId: string, id: string, data: Partial<InsertContentSnippet>, embeddedFields?: string[]) { return docBuilder.updateContentSnippet(userId, id, data, embeddedFields); }
  deleteContentSnippet(userId: string, id: string) { return docBuilder.deleteContentSnippet(userId, id); }
  incrementSnippetUsage(userId: string, id: string) { return docBuilder.incrementSnippetUsage(userId, id); }

  // Field Values
  getFieldValues(userId: string) { return docBuilder.getFieldValues(userId); }
  getFieldValueById(userId: string, id: string) { return docBuilder.getFieldValueById(userId, id); }
  getFieldValueByName(userId: string, name: string) { return docBuilder.getFieldValueByName(userId, name); }
  createFieldValue(userId: string, data: InsertFieldValue) { return docBuilder.createFieldValue(userId, data); }
  updateFieldValue(userId: string, id: string, data: Partial<InsertFieldValue>) { return docBuilder.updateFieldValue(userId, id, data); }
  deleteFieldValue(userId: string, id: string) { return docBuilder.deleteFieldValue(userId, id); }
  deleteFieldValuesByPrefixes(userId: string, prefixes: string[]) { return docBuilder.deleteFieldValuesByPrefixes(userId, prefixes); }

  // Profile
  getMyProfile(userId: string) { return docBuilder.getMyProfile(userId); }
  upsertProfile(userId: string, data: Partial<Profile>) { return docBuilder.upsertProfile(userId, data); }

  // Companies
  getCompanies(userId: string) { return companiesRepo.getCompanies(userId); }
  getCompanyById(userId: string, id: string) { return companiesRepo.getCompanyById(userId, id); }
  createCompany(userId: string, data: InsertCompany, contactIds?: string[]) { return companiesRepo.createCompany(userId, data, contactIds); }
  updateCompany(userId: string, id: string, data: Partial<InsertCompany>, contactIds?: string[]) { return companiesRepo.updateCompany(userId, id, data, contactIds); }
  deleteCompany(userId: string, id: string) { return companiesRepo.deleteCompany(userId, id); }
  linkContactToCompany(userId: string, companyId: string, contactId: string) { return companiesRepo.linkContactToCompany(userId, companyId, contactId); }
  unlinkContactFromCompany(userId: string, companyId: string, contactId: string) { return companiesRepo.unlinkContactFromCompany(userId, companyId, contactId); }

  // Leads
  getLeads(userId: string) { return leadsRepo.getLeads(userId); }
  getLeadById(userId: string, id: number) { return leadsRepo.getLeadById(userId, id); }
  createLead(userId: string, lead: InsertLead, companies: Omit<InsertLeadCompany, 'leadId'>[]) { return leadsRepo.createLead(userId, lead, companies); }
  updateLead(userId: string, id: number, data: Partial<InsertLead>) { return leadsRepo.updateLead(userId, id, data); }
  upsertLeadCompanies(userId: string, leadId: number, companies: Omit<InsertLeadCompany, 'leadId'>[]) { return leadsRepo.upsertLeadCompanies(userId, leadId, companies); }
  deleteLead(userId: string, id: number) { return leadsRepo.deleteLead(userId, id); }

  // Proposals
  getProposals(userId: string, leadId: number) { return proposalsRepo.getProposals(userId, leadId); }
  getProposalById(userId: string, proposalId: string) { return proposalsRepo.getProposalById(userId, proposalId); }
  createProposal(userId: string, data: InsertProposal, phases: { name: string; sortOrder: number; feeLines: { consultant: string; feeType: string; amount: string | null; sortOrder: number }[] }[], additionalLineItems?: { description: string; amount: string | null; sortOrder: number }[]) { return proposalsRepo.createProposal(userId, data, phases, additionalLineItems); }
  updateProposal(userId: string, proposalId: string, updates: Partial<InsertProposal>, phases?: { name: string; sortOrder: number; feeLines: { consultant: string; feeType: string; amount: string | null; sortOrder: number }[] }[], additionalLineItems?: { description: string; amount: string | null; sortOrder: number }[]) { return proposalsRepo.updateProposal(userId, proposalId, updates, phases, additionalLineItems); }
  deleteProposal(userId: string, proposalId: string) { return proposalsRepo.deleteProposal(userId, proposalId); }
  signProposal(userId: string, proposalId: string) { return proposalsRepo.signProposal(userId, proposalId); }

  // Invoices
  getInvoices(userId: string, leadId: number) { return invoicesRepo.getInvoices(userId, leadId); }
  getInvoiceById(userId: string, invoiceId: string) { return invoicesRepo.getInvoiceById(userId, invoiceId); }
  createInvoice(userId: string, leadId: number, proposalId: string, feeLineInputs: { proposalFeeLineId: string; percentComplete?: string; hoursWorked?: string; ratePerHour?: string }[], hoursInputs: { date: string; description: string; hours: string; ratePerHour: string }[], expenseInputs: { date: string; expenseType: string; billedDate?: string; milesTraveled?: string; ratePerMile?: string; amount?: string }[], notes?: string, existingHoursIds?: string[], existingExpenseIds?: string[], additionalLineItemInputs?: { additionalLineItemId: string; description: string; amount: string | null; percentComplete: string }[]) { return invoicesRepo.createInvoice(userId, leadId, proposalId, feeLineInputs, hoursInputs, expenseInputs, notes, existingHoursIds, existingExpenseIds, additionalLineItemInputs); }
  updateInvoiceStatus(userId: string, invoiceId: string, status: string) { return invoicesRepo.updateInvoiceStatus(userId, invoiceId, status); }
  updateInvoiceDocUrl(userId: string, invoiceId: string, docUrl: string) { return invoicesRepo.updateInvoiceDocUrl(userId, invoiceId, docUrl); }
  deleteInvoice(userId: string, invoiceId: string) { return invoicesRepo.deleteInvoice(userId, invoiceId); }

  // Project-level time & expense
  getProjectHours(userId: string, leadId: number) { return invoicesRepo.getProjectHours(userId, leadId); }
  getProjectExpenses(userId: string, leadId: number) { return invoicesRepo.getProjectExpenses(userId, leadId); }

  // Hours entries
  createHoursEntry(userId: string, invoiceId: string | null, leadId: number, entry: { date: string; description: string; hours: string; ratePerHour: string }) { return invoicesRepo.createHoursEntry(userId, invoiceId, leadId, entry); }
  updateHoursEntry(userId: string, id: string, updates: Partial<{ date: string; description: string; hours: string; ratePerHour: string; invoiceId: string | null }>) { return invoicesRepo.updateHoursEntry(userId, id, updates); }
  deleteHoursEntry(userId: string, id: string) { return invoicesRepo.deleteHoursEntry(userId, id); }

  // Expense entries
  createExpenseEntry(userId: string, invoiceId: string | null, leadId: number, entry: { date: string; expenseType: string; billedDate?: string; milesTraveled?: string; ratePerMile?: string; amount?: string }) { return invoicesRepo.createExpenseEntry(userId, invoiceId, leadId, entry); }
  updateExpenseEntry(userId: string, id: string, updates: Partial<{ date: string; expenseType: string; billedDate?: string; milesTraveled?: string; ratePerMile?: string; amount?: string; invoiceId: string | null }>) { return invoicesRepo.updateExpenseEntry(userId, id, updates); }
  deleteExpenseEntry(userId: string, id: string) { return invoicesRepo.deleteExpenseEntry(userId, id); }

  // Project comments
  getProjectComments(userId: string, leadId: number) { return invoicesRepo.getProjectComments(userId, leadId); }
  createProjectComment(userId: string, leadId: number, content: string) { return invoicesRepo.createProjectComment(userId, leadId, content); }
  deleteProjectComment(userId: string, commentId: string, leadId: number) { return invoicesRepo.deleteProjectComment(userId, commentId, leadId); }

  // Contacts
  getContacts(userId: string) { return companiesRepo.getContacts(userId); }
  getContactById(userId: string, id: string) { return companiesRepo.getContactById(userId, id); }
  createContact(userId: string, data: InsertContact, companyIds?: string[]) { return companiesRepo.createContact(userId, data, companyIds); }
  updateContact(userId: string, id: string, data: Partial<InsertContact>, companyIds?: string[]) { return companiesRepo.updateContact(userId, id, data, companyIds); }
  deleteContact(userId: string, id: string) { return companiesRepo.deleteContact(userId, id); }

  // Consultant Contracts
  getConsultantContracts(proposalId: string) { return proposalsRepo.getConsultantContracts(proposalId); }
  upsertConsultantContract(proposalId: string, consultant: string, docUrl: string) { return proposalsRepo.upsertConsultantContract(proposalId, consultant, docUrl); }
}

export const storage = new DatabaseStorage();
