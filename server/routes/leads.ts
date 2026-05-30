import type { Express } from "express";
import { requireAuth } from "../auth";
import { storage } from "../storage";
import {
  insertLeadSchema,
  insertLeadCompanyInputSchema,
  type User,
} from "@shared/schema";

export function registerLeadRoutes(app: Express): void {
  // Dashboard
  app.get("/api/dashboard", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const stats = await storage.getDashboardStats(userId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Leads
  app.get("/api/leads", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const result = await storage.getLeads(userId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/leads/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid lead ID" });
      const lead = await storage.getLeadById(userId, id);
      if (!lead) return res.status(404).json({ error: "Lead not found" });
      res.json(lead);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/leads", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { companies: companiesRaw, ...leadRaw } = req.body;
      const validated = insertLeadSchema.parse(leadRaw);
      const companiesInput = Array.isArray(companiesRaw) ? companiesRaw : [];
      const validatedCompanies = companiesInput.map((c: unknown) =>
        insertLeadCompanyInputSchema.parse(c)
      );
      const lead = await storage.createLead(userId, validated, validatedCompanies);
      res.json(lead);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/leads/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid lead ID" });
      const { companies: companiesRaw, ...leadRaw } = req.body;
      const validated = insertLeadSchema.partial().parse(leadRaw);
      const lead = await storage.updateLead(userId, id, validated);
      if (!lead) return res.status(404).json({ error: "Lead not found" });

      if (Array.isArray(companiesRaw)) {
        const validatedCompanies = (companiesRaw as unknown[]).map((c) =>
          insertLeadCompanyInputSchema.parse(c)
        );
        await storage.upsertLeadCompanies(userId, id, validatedCompanies);
      }

      const updated = await storage.getLeadById(userId, id);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/leads/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid lead ID" });
      const success = await storage.deleteLead(userId, id);
      if (!success) return res.status(404).json({ error: "Lead not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
