import type { Express } from "express";
import { requireAuth } from "../auth";
import { storage } from "../storage";
import { extractEmbeddedFields } from "../services/google-docs";
import {
  insertCategorySchema,
  insertContentSnippetSchema,
  insertFieldValueSchema,
  type User,
} from "@shared/schema";

export function registerFieldValueRoutes(app: Express): void {
  // Categories
  app.get("/api/categories", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const categories = await storage.getCategories(userId);
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/categories", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const validated = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(userId, validated);
      res.json(category);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.patch("/api/categories/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { id } = req.params;
      const validated = insertCategorySchema.partial().parse(req.body);
      const category = await storage.updateCategory(userId, id, validated);
      if (!category) return res.status(404).json({ error: "Category not found" });
      res.json(category);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/categories/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { id } = req.params;
      const success = await storage.deleteCategory(userId, id);
      if (!success) return res.status(404).json({ error: "Category not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Content Snippets
  app.get("/api/content-snippets", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const snippets = await storage.getContentSnippets(userId);
      res.json(snippets);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/content-snippets", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const validated = insertContentSnippetSchema.parse(req.body);
      const embeddedFields = extractEmbeddedFields(validated.content);
      const snippet = await storage.createContentSnippet(userId, validated, embeddedFields);
      res.json(snippet);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.patch("/api/content-snippets/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { id } = req.params;
      const validated = insertContentSnippetSchema.partial().parse(req.body);
      const embeddedFields = validated.content ? extractEmbeddedFields(validated.content) : undefined;
      const snippet = await storage.updateContentSnippet(userId, id, validated, embeddedFields);
      if (!snippet) return res.status(404).json({ error: "Content snippet not found" });
      res.json(snippet);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/content-snippets/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { id } = req.params;
      const success = await storage.deleteContentSnippet(userId, id);
      if (!success) return res.status(404).json({ error: "Content snippet not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Field Values
  app.get("/api/field-values", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const fieldValues = await storage.getFieldValues(userId);
      res.json(fieldValues);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/field-values/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { id } = req.params;
      const fieldValue = await storage.getFieldValueById(userId, id);
      if (!fieldValue) return res.status(404).json({ error: "Field value not found" });
      res.json(fieldValue);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/field-values", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const validated = insertFieldValueSchema.parse(req.body);
      const fieldValue = await storage.createFieldValue(userId, validated);
      res.json(fieldValue);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.patch("/api/field-values/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { id } = req.params;
      const validated = insertFieldValueSchema.partial().parse(req.body);
      const fieldValue = await storage.updateFieldValue(userId, id, validated);
      if (!fieldValue) return res.status(404).json({ error: "Field value not found" });
      res.json(fieldValue);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/field-values/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { id } = req.params;
      const success = await storage.deleteFieldValue(userId, id);
      if (!success) return res.status(404).json({ error: "Field value not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Delete field values by name prefixes (used by Load to Doc Builder to clear stale context)
  app.delete("/api/field-values/by-prefix", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { prefixes } = req.body;
      if (!Array.isArray(prefixes) || prefixes.some((p) => typeof p !== "string")) {
        return res.status(400).json({ error: "prefixes must be an array of strings" });
      }
      const count = await storage.deleteFieldValuesByPrefixes(userId, prefixes);
      res.json({ deleted: count });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Upsert field value by name (used by proposal/invoice Load to Doc Builder and profile save)
  app.post("/api/field-values/upsert-by-name", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { name, value } = req.body;
      if (!name || value === undefined || value === null) {
        return res.status(400).json({ error: "name is required and value must be provided" });
      }
      const existing = await storage.getFieldValueByName(userId, name);
      if (existing) {
        const updated = await storage.updateFieldValue(userId, existing.id, { name, value });
        return res.json(updated);
      }
      const created = await storage.createFieldValue(userId, { name, value });
      res.json(created);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });
}
