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

// Content snippets - reusable text pieces
export const contentSnippets = pgTable("content_snippets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull(),
  categoryId: varchar("category_id").references(() => categories.id, { onDelete: "set null" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertContentSnippetSchema = createInsertSchema(contentSnippets).omit({
  id: true,
  userId: true,
  usageCount: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContentSnippet = z.infer<typeof insertContentSnippetSchema>;
export type ContentSnippet = typeof contentSnippets.$inferSelect;

// Template structure types (not stored in DB, parsed from Google Docs)
export interface TemplateTag {
  type: string;
  name: string;
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
  snippetId: string | null;
  customContent: string | null;
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
    snippetId: z.string().nullable(),
    customContent: z.string().nullable(),
  })),
  sectionOrder: z.array(z.string()),
});

export type GenerateDocumentRequestType = z.infer<typeof generateDocumentRequestSchema>;
