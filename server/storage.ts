import {
  categories,
  contentSnippets,
  type Category,
  type InsertCategory,
  type ContentSnippet,
  type InsertContentSnippet,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";

export interface IStorage {
  // Categories
  getCategories(userId: string): Promise<Category[]>;
  createCategory(userId: string, category: InsertCategory): Promise<Category>;
  updateCategory(userId: string, id: string, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(userId: string, id: string): Promise<boolean>;
  
  // Content Snippets
  getContentSnippets(userId: string): Promise<ContentSnippet[]>;
  getContentSnippetById(userId: string, id: string): Promise<ContentSnippet | undefined>;
  createContentSnippet(userId: string, snippet: InsertContentSnippet): Promise<ContentSnippet>;
  updateContentSnippet(userId: string, id: string, snippet: Partial<InsertContentSnippet>): Promise<ContentSnippet | undefined>;
  deleteContentSnippet(userId: string, id: string): Promise<boolean>;
  incrementSnippetUsage(userId: string, id: string): Promise<void>;
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

  async createContentSnippet(userId: string, insertSnippet: InsertContentSnippet): Promise<ContentSnippet> {
    const [snippet] = await db
      .insert(contentSnippets)
      .values({ ...insertSnippet, userId })
      .returning();
    return snippet;
  }

  async updateContentSnippet(
    userId: string,
    id: string,
    updates: Partial<InsertContentSnippet>
  ): Promise<ContentSnippet | undefined> {
    const [snippet] = await db
      .update(contentSnippets)
      .set({ ...updates, updatedAt: sql`CURRENT_TIMESTAMP` })
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
}

export const storage = new DatabaseStorage();
