import type { Express } from "express";
import { requireAuth } from "../auth";
import { storage } from "../storage";
import { z } from "zod";
import { AccessError } from "../workspace-context";
import { getProjectTeam, saveProjectTeam, projectSetupOptions } from "../project-team";
import { setupPatch } from "@shared/project-setup";
import { updateLead } from "../repositories/leads";
import {
  insertLeadSchema,
  insertLeadCompanyInputSchema,
  type User,
} from "@shared/schema";

export function registerLeadRoutes(app: Express): void {
  const setupRun = (fn: (req: import("express").Request, res: import("express").Response) => Promise<unknown>) =>
    async (req: import("express").Request, res: import("express").Response) => {
      res.setHeader("Cache-Control", "no-store");
      try { await fn(req, res); }
      catch (error) {
        if (error instanceof AccessError) return res.status(error.status).json({ error: error.message });
        if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues.map(i => i.message).join(". ") });
        console.error("Project setup failed", error instanceof Error ? error.name : "Unknown");
        res.status(500).json({ error: "Project setup could not be saved. Your changes have not been discarded." });
      }
    };
  const projectId = (value: unknown) => z.coerce.number().int().positive().parse(value);
  app.get("/api/leads/:id/team", requireAuth, setupRun(async (req, res) => {
    res.json(await getProjectTeam(projectId(req.params.id)));
  }));
  app.put("/api/leads/:id/team", requireAuth, setupRun(async (req, res) => {
    res.json(await saveProjectTeam(projectId(req.params.id), req.body));
  }));
  app.get("/api/leads/:id/setup-options", requireAuth, setupRun(async (req, res) => {
    res.json(await projectSetupOptions(projectId(req.params.id)));
  }));
  app.patch("/api/leads/:id/setup", requireAuth, setupRun(async (req, res) => {
    const id = projectId(req.params.id);
    const { version, setupComplete, companies, ...data } = setupPatch.parse(req.body);
    await updateLead((req.user as User).id, id, data, companies, { version, setupComplete });
    res.json(await storage.getLeadById((req.user as User).id, id));
  }));
  // Dashboard
  app.get("/api/dashboard", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const stats = await storage.getDashboardStats(userId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Leads
  app.get("/api/leads", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const result = await storage.getLeads(userId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
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
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
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
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.patch("/api/leads/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid lead ID" });
      const { companies: companiesRaw, ...leadRaw } = req.body;
      const validated = insertLeadSchema.partial().parse(leadRaw);
      if (companiesRaw !== undefined && !Array.isArray(companiesRaw)) throw new Error("companies must be an array");
      const validatedCompanies = Array.isArray(companiesRaw)
        ? companiesRaw.map((company: unknown) => insertLeadCompanyInputSchema.parse(company))
        : undefined;
      const lead = await storage.updateLead(userId, id, validated, validatedCompanies);
      if (!lead) return res.status(404).json({ error: "Lead not found" });

      const updated = await storage.getLeadById(userId, id);
      res.json(updated);
    } catch (error) {
      if (error instanceof AccessError && error.status === 404) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: (error as Error).message });
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
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });
}
