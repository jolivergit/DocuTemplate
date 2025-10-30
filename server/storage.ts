import {
  categories,
  contentSnippets,
  type Category,
  type InsertCategory,
  type ContentSnippet,
  type InsertContentSnippet,
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Categories
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<boolean>;
  
  // Content Snippets
  getContentSnippets(): Promise<ContentSnippet[]>;
  getContentSnippetById(id: string): Promise<ContentSnippet | undefined>;
  createContentSnippet(snippet: InsertContentSnippet): Promise<ContentSnippet>;
  updateContentSnippet(id: string, snippet: Partial<InsertContentSnippet>): Promise<ContentSnippet | undefined>;
  deleteContentSnippet(id: string): Promise<boolean>;
  incrementSnippetUsage(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db
      .insert(categories)
      .values(insertCategory)
      .returning();
    return category;
  }

  async updateCategory(id: string, updates: Partial<InsertCategory>): Promise<Category | undefined> {
    const [category] = await db
      .update(categories)
      .set(updates)
      .where(eq(categories.id, id))
      .returning();
    return category || undefined;
  }

  async deleteCategory(id: string): Promise<boolean> {
    const result = await db
      .delete(categories)
      .where(eq(categories.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getContentSnippets(): Promise<ContentSnippet[]> {
    return await db.select().from(contentSnippets);
  }

  async getContentSnippetById(id: string): Promise<ContentSnippet | undefined> {
    const [snippet] = await db
      .select()
      .from(contentSnippets)
      .where(eq(contentSnippets.id, id));
    return snippet || undefined;
  }

  async createContentSnippet(insertSnippet: InsertContentSnippet): Promise<ContentSnippet> {
    const [snippet] = await db
      .insert(contentSnippets)
      .values(insertSnippet)
      .returning();
    return snippet;
  }

  async updateContentSnippet(
    id: string,
    updates: Partial<InsertContentSnippet>
  ): Promise<ContentSnippet | undefined> {
    const [snippet] = await db
      .update(contentSnippets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contentSnippets.id, id))
      .returning();
    return snippet || undefined;
  }

  async deleteContentSnippet(id: string): Promise<boolean> {
    const result = await db
      .delete(contentSnippets)
      .where(eq(contentSnippets.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async incrementSnippetUsage(id: string): Promise<void> {
    await db
      .update(contentSnippets)
      .set({
        usageCount: (contentSnippets.usageCount as any) + 1,
      })
      .where(eq(contentSnippets.id, id));
  }
}

export const storage = new DatabaseStorage();
