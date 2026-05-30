import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import {
  categories,
  contentSnippets,
  fieldValues,
  profiles,
  type Category,
  type InsertCategory,
  type ContentSnippet,
  type InsertContentSnippet,
  type FieldValue,
  type InsertFieldValue,
  type Profile,
} from "@shared/schema";

// ─── Categories ───────────────────────────────────────────────────────────────

export async function getCategories(userId: string): Promise<Category[]> {
  return db.select().from(categories).where(eq(categories.userId, userId));
}

export async function createCategory(userId: string, data: InsertCategory): Promise<Category> {
  const [row] = await db.insert(categories).values({ ...data, userId }).returning();
  return row;
}

export async function updateCategory(userId: string, id: string, data: Partial<InsertCategory>): Promise<Category | undefined> {
  const [row] = await db
    .update(categories)
    .set(data)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .returning();
  return row || undefined;
}

export async function deleteCategory(userId: string, id: string): Promise<boolean> {
  const result = await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
  return result.rowCount ? result.rowCount > 0 : false;
}

// ─── Content Snippets ─────────────────────────────────────────────────────────

export async function getContentSnippets(userId: string): Promise<ContentSnippet[]> {
  return db.select().from(contentSnippets).where(eq(contentSnippets.userId, userId));
}

export async function getContentSnippetById(userId: string, id: string): Promise<ContentSnippet | undefined> {
  const [row] = await db
    .select()
    .from(contentSnippets)
    .where(and(eq(contentSnippets.id, id), eq(contentSnippets.userId, userId)));
  return row || undefined;
}

export async function createContentSnippet(userId: string, data: InsertContentSnippet, embeddedFields?: string[]): Promise<ContentSnippet> {
  const [row] = await db
    .insert(contentSnippets)
    .values({ ...data, userId, embeddedFields: embeddedFields || [] })
    .returning();
  return row;
}

export async function updateContentSnippet(
  userId: string,
  id: string,
  data: Partial<InsertContentSnippet>,
  embeddedFields?: string[]
): Promise<ContentSnippet | undefined> {
  const updateData: Record<string, unknown> = { ...data, updatedAt: sql`CURRENT_TIMESTAMP` };
  if (embeddedFields !== undefined) updateData.embeddedFields = embeddedFields;
  const [row] = await db
    .update(contentSnippets)
    .set(updateData)
    .where(and(eq(contentSnippets.id, id), eq(contentSnippets.userId, userId)))
    .returning();
  return row || undefined;
}

export async function deleteContentSnippet(userId: string, id: string): Promise<boolean> {
  const result = await db
    .delete(contentSnippets)
    .where(and(eq(contentSnippets.id, id), eq(contentSnippets.userId, userId)));
  return result.rowCount ? result.rowCount > 0 : false;
}

export async function incrementSnippetUsage(userId: string, id: string): Promise<void> {
  await db
    .update(contentSnippets)
    .set({ usageCount: sql`${contentSnippets.usageCount} + 1` })
    .where(and(eq(contentSnippets.id, id), eq(contentSnippets.userId, userId)));
}

// ─── Field Values ─────────────────────────────────────────────────────────────

export async function getFieldValues(userId: string): Promise<FieldValue[]> {
  return db.select().from(fieldValues).where(eq(fieldValues.userId, userId));
}

export async function getFieldValueById(userId: string, id: string): Promise<FieldValue | undefined> {
  const [row] = await db
    .select()
    .from(fieldValues)
    .where(and(eq(fieldValues.id, id), eq(fieldValues.userId, userId)));
  return row || undefined;
}

export async function getFieldValueByName(userId: string, name: string): Promise<FieldValue | undefined> {
  const [row] = await db
    .select()
    .from(fieldValues)
    .where(and(eq(fieldValues.name, name), eq(fieldValues.userId, userId)));
  return row || undefined;
}

export async function createFieldValue(userId: string, data: InsertFieldValue): Promise<FieldValue> {
  const [row] = await db.insert(fieldValues).values({ ...data, userId }).returning();
  return row;
}

export async function updateFieldValue(userId: string, id: string, data: Partial<InsertFieldValue>): Promise<FieldValue | undefined> {
  const [row] = await db
    .update(fieldValues)
    .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(and(eq(fieldValues.id, id), eq(fieldValues.userId, userId)))
    .returning();
  return row || undefined;
}

export async function deleteFieldValue(userId: string, id: string): Promise<boolean> {
  const result = await db.delete(fieldValues).where(and(eq(fieldValues.id, id), eq(fieldValues.userId, userId)));
  return result.rowCount ? result.rowCount > 0 : false;
}

export async function deleteFieldValuesByPrefixes(userId: string, prefixes: string[]): Promise<number> {
  if (!prefixes.length) return 0;
  const conditions = prefixes.map((p) => sql`${fieldValues.name} LIKE ${p + "%"}`);
  const result = await db
    .delete(fieldValues)
    .where(and(eq(fieldValues.userId, userId), sql`(${sql.join(conditions, sql` OR `)})`));
  return result.rowCount ?? 0;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function getMyProfile(userId: string): Promise<Profile | undefined> {
  const [row] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return row || undefined;
}

export async function upsertProfile(userId: string, data: Partial<Profile>): Promise<Profile> {
  const existing = await getMyProfile(userId);
  if (existing) {
    const [updated] = await db
      .update(profiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(profiles.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(profiles)
    .values({ name: data.name || "My Profile", ...data, userId, updatedAt: new Date() })
    .returning();
  return created;
}
