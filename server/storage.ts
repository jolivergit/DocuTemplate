import {
  categories,
  contentSnippets,
  profiles,
  type Category,
  type InsertCategory,
  type ContentSnippet,
  type InsertContentSnippet,
  type Profile,
  type InsertProfile,
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
  createContentSnippet(userId: string, snippet: InsertContentSnippet, embeddedFields?: string[]): Promise<ContentSnippet>;
  updateContentSnippet(userId: string, id: string, snippet: Partial<InsertContentSnippet>, embeddedFields?: string[]): Promise<ContentSnippet | undefined>;
  deleteContentSnippet(userId: string, id: string): Promise<boolean>;
  incrementSnippetUsage(userId: string, id: string): Promise<void>;
  
  // Profiles
  getProfiles(userId: string): Promise<Profile[]>;
  getProfileById(userId: string, id: string): Promise<Profile | undefined>;
  createProfile(userId: string, profile: InsertProfile): Promise<Profile>;
  updateProfile(userId: string, id: string, profile: Partial<InsertProfile>): Promise<Profile | undefined>;
  deleteProfile(userId: string, id: string): Promise<boolean>;
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

  async createProfile(userId: string, insertProfile: InsertProfile): Promise<Profile> {
    const [profile] = await db
      .insert(profiles)
      .values({ ...insertProfile, userId })
      .returning();
    return profile;
  }

  async updateProfile(
    userId: string,
    id: string,
    updates: Partial<InsertProfile>
  ): Promise<Profile | undefined> {
    const [profile] = await db
      .update(profiles)
      .set({ ...updates, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(profiles.id, id), eq(profiles.userId, userId)))
      .returning();
    return profile || undefined;
  }

  async deleteProfile(userId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(profiles)
      .where(and(eq(profiles.id, id), eq(profiles.userId, userId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }
}

export const storage = new DatabaseStorage();
