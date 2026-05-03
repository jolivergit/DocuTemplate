import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, serial, numeric } from "drizzle-orm/pg-core";
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
  name: text("name").notNull(), // The field name (e.g., "company_name")
  value: text("value").notNull(), // The value (e.g., "Acme Corp")
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
  embeddedFields: text("embedded_fields").array().default([]), // Field tags found in content (e.g., {{customer_name}})
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertContentSnippetSchema = createInsertSchema(contentSnippets).omit({
  id: true,
  userId: true,
  usageCount: true,
  embeddedFields: true, // Auto-computed from content
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

// Leads table — the core pipeline record
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

// Lead companies — 6 typed company associations per lead
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
});

export const insertLeadCompanySchema = createInsertSchema(leadCompanies).omit({
  id: true,
}).extend({
  companyRole: z.enum(COMPANY_ROLES),
});

// Schema for API input — leadId is injected server-side, not sent by clients
export const insertLeadCompanyInputSchema = insertLeadCompanySchema.omit({ leadId: true });

export type InsertLeadCompany = z.infer<typeof insertLeadCompanySchema>;
export type InsertLeadCompanyInput = z.infer<typeof insertLeadCompanyInputSchema>;
export type LeadCompany = typeof leadCompanies.$inferSelect;

// Full lead with nested companies (API response shape)
export interface LeadWithCompanies extends Lead {
  companies: LeadCompany[];
}

// ─── Template / Doc Builder types (not stored in DB) ──────────────────────────

export type TagType = 'field' | 'content';

export interface TemplateTag {
  type: string;
  name: string;
  tagType: TagType; // 'field' for {{...}}, 'content' for <<...>>
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

// Tag mapping for document generation
export interface TagMapping {
  tagName: string;
  tagType: TagType; // 'field' for {{...}}, 'content' for <<...>>
  snippetId: string | null;
  customContent: string | null;
  fieldValueId: string | null; // Simple field value reference
}

export interface GenerateDocumentRequest {
  templateId: string;
  templateName: string;
  outputName: string;
  tagMappings: TagMapping[];
  sectionOrder: string[]; // Array of section IDs in desired order
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
