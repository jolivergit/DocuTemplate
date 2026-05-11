import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, serial, numeric, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for Google OAuth authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  googleId: text("google_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  picture: text("picture"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;

// Content categories for organizing reusable snippets
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  color: text("color").notNull().default("#3b82f6"),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// Field values - simple key/value pairs for field tags
export const fieldValues = pgTable("field_values", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  value: text("value").notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFieldValueSchema = createInsertSchema(fieldValues).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFieldValue = z.infer<typeof insertFieldValueSchema>;
export type FieldValue = typeof fieldValues.$inferSelect;

// Legacy profiles table - kept for migration, no longer used
export const profiles = pgTable("profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  contactTitle: text("contact_title"),
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  phone: text("phone"),
  email: text("email"),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Profile = typeof profiles.$inferSelect;

// Content snippets - reusable text pieces
export const contentSnippets = pgTable("content_snippets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull(),
  categoryId: varchar("category_id").references(() => categories.id, { onDelete: "set null" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  usageCount: integer("usage_count").notNull().default(0),
  embeddedFields: text("embedded_fields").array().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertContentSnippetSchema = createInsertSchema(contentSnippets).omit({
  id: true,
  userId: true,
  usageCount: true,
  embeddedFields: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContentSnippet = z.infer<typeof insertContentSnippetSchema>;
export type ContentSnippet = typeof contentSnippets.$inferSelect;

// ─── Lead Pipeline ─────────────────────────────────────────────────────────────

export const LEAD_STATUSES = ["Lead", "Proposal", "Active Project", "Completed", "Lost"] as const;
export type LeadStatus = typeof LEAD_STATUSES[number];

export const LEAD_PROBABILITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type LeadProbability = typeof LEAD_PROBABILITIES[number];

export const COMPANY_ROLES = [
  "ContractHolder",
  "Client",
  "MEP",
  "Structural",
  "EquipmentVendor",
  "FurnitureVendor",
] as const;
export type CompanyRole = typeof COMPANY_ROLES[number];

export const COMPANY_ROLE_LABELS: Record<CompanyRole, string> = {
  ContractHolder: "Contract Holder",
  Client: "Client",
  MEP: "MEP Engineering",
  Structural: "Structural Engineering",
  EquipmentVendor: "Equipment Vendor",
  FurnitureVendor: "Furniture Vendor",
};

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  projectName: text("project_name").notNull(),
  description: text("description"),
  squareFootage: numeric("square_footage", { precision: 10, scale: 0 }),
  probability: text("probability").notNull().default("LOW"),
  potentialFee: numeric("potential_fee", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("Lead"),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  probability: z.enum(LEAD_PROBABILITIES),
  status: z.enum(LEAD_STATUSES),
  squareFootage: z.string().optional().nullable(),
  potentialFee: z.string().optional().nullable(),
});

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export const leadCompanies = pgTable("lead_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: integer("lead_id").references(() => leads.id, { onDelete: "cascade" }).notNull(),
  companyRole: text("company_role").notNull(),
  companyName: text("company_name"),
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  contactFullName: text("contact_full_name"),
  contactTitle: text("contact_title"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
}, (t) => [unique("lead_companies_lead_id_role_unique").on(t.leadId, t.companyRole)]);

export const insertLeadCompanySchema = createInsertSchema(leadCompanies).omit({
  id: true,
}).extend({
  companyRole: z.enum(COMPANY_ROLES),
});

export const insertLeadCompanyInputSchema = insertLeadCompanySchema.omit({ leadId: true });

export type InsertLeadCompany = z.infer<typeof insertLeadCompanySchema>;
export type InsertLeadCompanyInput = z.infer<typeof insertLeadCompanyInputSchema>;
export type LeadCompany = typeof leadCompanies.$inferSelect;

export interface LeadWithCompanies extends Lead {
  companies: LeadCompany[];
}

// ─── Proposals ──────────────────────────────────────────────────────────────────

export const PROPOSAL_STATUSES = ["Draft", "Sent", "Revision", "Signed", "Declined"] as const;
export type ProposalStatus = typeof PROPOSAL_STATUSES[number];

export const FEE_TYPES = ["Fixed", "Hourly"] as const;
export type FeeType = typeof FEE_TYPES[number];

export const SERVICE_CATEGORIES = ["Documentation", "Bid & Permit", "Construction Administration"] as const;
export type ServiceCategory = typeof SERVICE_CATEGORIES[number];

export const DISCIPLINES = ["Interior Design", "MEP & FP", "Structural"] as const;
export type Discipline = typeof DISCIPLINES[number];

export const proposals = pgTable("proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: integer("lead_id").references(() => leads.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("Draft"),
  docUrl: text("doc_url"),
  dateSent: timestamp("date_sent"),
  dateSigned: timestamp("date_signed"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProposalSchema = createInsertSchema(proposals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(PROPOSAL_STATUSES).optional(),
  dateSent: z.string().optional().nullable(),
  dateSigned: z.string().optional().nullable(),
});

export type InsertProposal = z.infer<typeof insertProposalSchema>;
export type Proposal = typeof proposals.$inferSelect;

export const proposalPhases = pgTable("proposal_phases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  proposalId: varchar("proposal_id").references(() => proposals.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type ProposalPhase = typeof proposalPhases.$inferSelect;

export const proposalFeeLines = pgTable("proposal_fee_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phaseId: varchar("phase_id").references(() => proposalPhases.id, { onDelete: "cascade" }).notNull(),
  serviceCategory: text("service_category").notNull(),
  discipline: text("discipline").notNull(),
  feeType: text("fee_type").notNull().default("Fixed"),
  amount: numeric("amount", { precision: 12, scale: 2 }),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type ProposalFeeLine = typeof proposalFeeLines.$inferSelect;

export interface ProposalPhaseWithLines extends ProposalPhase {
  feeLines: ProposalFeeLine[];
}

export interface ProposalWithPhases extends Proposal {
  phases: ProposalPhaseWithLines[];
}

// ─── Invoices ───────────────────────────────────────────────────────────────────

export const INVOICE_STATUSES = ["Draft", "Sent", "Paid"] as const;
export type InvoiceStatus = typeof INVOICE_STATUSES[number];

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: integer("lead_id").references(() => leads.id, { onDelete: "cascade" }).notNull(),
  proposalId: varchar("proposal_id").references(() => proposals.id, { onDelete: "set null" }),
  invoiceNumber: integer("invoice_number").notNull(),
  status: text("status").notNull().default("Draft"),
  docUrl: text("doc_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Invoice = typeof invoices.$inferSelect;

export const invoiceFeeLineSnapshots = pgTable("invoice_fee_line_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
  proposalFeeLineId: varchar("proposal_fee_line_id").notNull(),
  serviceCategory: text("service_category").notNull(),
  discipline: text("discipline").notNull(),
  feeType: text("fee_type").notNull(),
  baseFee: numeric("base_fee", { precision: 12, scale: 2 }),
  percentComplete: numeric("percent_complete", { precision: 5, scale: 2 }),
  earned: numeric("earned", { precision: 12, scale: 2 }),
  previousBilling: numeric("previous_billing", { precision: 12, scale: 2 }),
  currentBilling: numeric("current_billing", { precision: 12, scale: 2 }),
  hoursWorked: numeric("hours_worked", { precision: 10, scale: 2 }),
  ratePerHour: numeric("rate_per_hour", { precision: 10, scale: 2 }),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type InvoiceFeeLineSnapshot = typeof invoiceFeeLineSnapshots.$inferSelect;

export const EXPENSE_TYPES = ["Mileage", "Parking", "Shipping", "Printing"] as const;
export type ExpenseType = typeof EXPENSE_TYPES[number];

export const hoursEntries = pgTable("hours_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
  leadId: integer("lead_id").references(() => leads.id, { onDelete: "cascade" }).notNull(),
  date: text("date").notNull(),
  description: text("description").notNull(),
  hours: numeric("hours", { precision: 10, scale: 2 }).notNull(),
  ratePerHour: numeric("rate_per_hour", { precision: 10, scale: 2 }).notNull(),
});

export type HoursEntry = typeof hoursEntries.$inferSelect;

export const expenseEntries = pgTable("expense_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
  leadId: integer("lead_id").references(() => leads.id, { onDelete: "cascade" }).notNull(),
  date: text("date").notNull(),
  expenseType: text("expense_type").notNull(),
  billedDate: text("billed_date"),
  milesTraveled: numeric("miles_traveled", { precision: 10, scale: 2 }),
  ratePerMile: numeric("rate_per_mile", { precision: 10, scale: 4 }),
  amount: numeric("amount", { precision: 12, scale: 2 }),
});

export type ExpenseEntry = typeof expenseEntries.$inferSelect;

export const projectComments = pgTable("project_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: integer("lead_id").references(() => leads.id, { onDelete: "cascade" }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ProjectComment = typeof projectComments.$inferSelect;

export interface InvoiceWithDetails extends Invoice {
  feeLineSnapshots: InvoiceFeeLineSnapshot[];
  hoursEntries: HoursEntry[];
  expenseEntries: ExpenseEntry[];
}

// ─── Contacts ────────────────────────────────────────────────────────────────

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  fullName: text("full_name").notNull(),
  title: text("title"),
  phone: text("phone"),
  email: text("email"),
  companyName: text("company_name"),
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

// ─── Template / Doc Builder types (not stored in DB) ──────────────────────────

export type TagType = 'field' | 'content';

export interface TemplateTag {
  type: string;
  name: string;
  tagType: TagType;
  startIndex: number;
  endIndex: number;
}

export interface TemplateSection {
  id: string;
  title: string;
  tags: TemplateTag[];
  startIndex: number;
  endIndex: number;
  children: TemplateSection[];
}

export interface ParsedTemplate {
  documentId: string;
  documentName: string;
  sections: TemplateSection[];
  allTags: TemplateTag[];
}

export interface TagMapping {
  tagName: string;
  tagType: TagType;
  snippetId: string | null;
  customContent: string | null;
  fieldValueId: string | null;
}

export interface GenerateDocumentRequest {
  templateId: string;
  templateName: string;
  outputName: string;
  tagMappings: TagMapping[];
  sectionOrder: string[];
}

export const generateDocumentRequestSchema = z.object({
  templateId: z.string(),
  templateName: z.string(),
  outputName: z.string(),
  tagMappings: z.array(z.object({
    tagName: z.string(),
    tagType: z.enum(['field', 'content']),
    snippetId: z.string().nullable(),
    customContent: z.string().nullable(),
    fieldValueId: z.string().nullable(),
  })),
  sectionOrder: z.array(z.string()),
});

export type GenerateDocumentRequestType = z.infer<typeof generateDocumentRequestSchema>;
