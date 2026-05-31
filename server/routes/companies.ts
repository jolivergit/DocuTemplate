import type { Express } from "express";
import { requireAuth } from "../auth";
import { storage } from "../storage";
import {
  insertCompanySchema,
  insertContactSchema,
  insertProfileSchema,
  type User,
} from "@shared/schema";

export function registerCompanyRoutes(app: Express): void {
  // Companies
  app.get("/api/companies", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const result = await storage.getCompanies(userId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/companies", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { contactIds, ...companyRaw } = req.body;
      const validated = insertCompanySchema.parse(companyRaw);
      const company = await storage.createCompany(userId, validated, Array.isArray(contactIds) ? contactIds : undefined);
      res.json(company);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.patch("/api/companies/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { contactIds, ...companyRaw } = req.body;
      const validated = insertCompanySchema.partial().parse(companyRaw);
      const company = await storage.updateCompany(userId, req.params.id, validated, Array.isArray(contactIds) ? contactIds : undefined);
      if (!company) return res.status(404).json({ error: "Company not found" });
      res.json(company);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/companies/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const success = await storage.deleteCompany(userId, req.params.id);
      if (!success) return res.status(404).json({ error: "Company not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/companies/:id/contacts/:contactId", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      await storage.linkContactToCompany(userId, req.params.id, req.params.contactId);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/companies/:id/contacts/:contactId", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      await storage.unlinkContactFromCompany(userId, req.params.id, req.params.contactId);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.post("/api/companies/migrate-from-lead-companies", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const result = await storage.migrateLeadCompaniesToAddressBook(userId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Contacts
  app.get("/api/contacts", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const result = await storage.getContacts(userId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/contacts", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { companyIds, ...contactRaw } = req.body;
      const validated = insertContactSchema.parse(contactRaw);
      const contact = await storage.createContact(userId, validated, Array.isArray(companyIds) ? companyIds : undefined);
      res.json(contact);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.patch("/api/contacts/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { companyIds, ...contactRaw } = req.body;
      const validated = insertContactSchema.partial().parse(contactRaw);
      const contact = await storage.updateContact(userId, req.params.id, validated, Array.isArray(companyIds) ? companyIds : undefined);
      if (!contact) return res.status(404).json({ error: "Contact not found" });
      res.json(contact);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/contacts/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const success = await storage.deleteContact(userId, req.params.id);
      if (!success) return res.status(404).json({ error: "Contact not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // User Profile
  app.get("/api/profile", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const profile = await storage.getMyProfile(userId);
      if (!profile) return res.status(404).json({ error: "No profile yet" });
      res.json(profile);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.patch("/api/profile", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const data = insertProfileSchema.parse(req.body);
      const profile = await storage.upsertProfile(userId, data);
      res.json(profile);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });
}
