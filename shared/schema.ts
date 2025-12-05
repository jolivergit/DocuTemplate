import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer } from "drizzle-orm/pg-core";
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

// Profiles - reusable company/client information for title pages
export const profiles = pgTable("profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Company/Organization name
  contactName: text("contact_name"), // Contact person name
  contactTitle: text("contact_title"), // Contact person title/role
  addressLine1: text("address_line_1"), // Street address
  addressLine2: text("address_line_2"), // Suite, unit, etc.
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  phone: text("phone"),
  email: text("email"),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProfile = z.infer<typeof insertProfileSchema>;
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

// Template structure types (not stored in DB, parsed from Google Docs)
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

// Profile field names for mapping
export const PROFILE_FIELDS = [
  { key: 'name', label: 'Company/Organization Name' },
  { key: 'contactName', label: 'Contact Name' },
  { key: 'contactTitle', label: 'Contact Title/Role' },
  { key: 'addressLine1', label: 'Address Line 1' },
  { key: 'addressLine2', label: 'Address Line 2' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zip', label: 'ZIP Code' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'fullAddress', label: 'Full Address' },
  { key: 'cityStateZip', label: 'City, State ZIP' },
] as const;

export type ProfileFieldKey = typeof PROFILE_FIELDS[number]['key'];

// Tag mapping for document generation
export interface TagMapping {
  tagName: string;
  tagType: TagType; // 'field' for {{...}}, 'content' for <<...>>
  snippetId: string | null;
  customContent: string | null;
  profileId: string | null;
  profileField: ProfileFieldKey | null;
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
    profileId: z.string().nullable(),
    profileField: z.string().nullable(),
  })),
  sectionOrder: z.array(z.string()),
});

export type GenerateDocumentRequestType = z.infer<typeof generateDocumentRequestSchema>;
