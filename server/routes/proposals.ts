import type { Express } from "express";
import { requireAuth } from "../auth";
import { storage } from "../storage";
import { getGoogleClient } from "../google-client";
import { generateConsultantDocument } from "../services/doc-generation";
import {
  proposalPhaseInputSchema,
  additionalLineItemInputSchema,
  type User,
} from "@shared/schema";
import { z } from "zod";

export function registerProposalRoutes(app: Express): void {
  // Proposals
  app.get("/api/leads/:leadId/proposals", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const leadId = parseInt(req.params.leadId, 10);
      if (isNaN(leadId)) return res.status(400).json({ error: "Invalid lead ID" });
      const result = await storage.getProposals(userId, leadId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/proposals/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const proposal = await storage.getProposalById(userId, req.params.id);
      if (!proposal) return res.status(404).json({ error: "Proposal not found" });
      res.json(proposal);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/proposals/:id/billing-summary", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const summary = await storage.getProposalBillingSummary(userId, req.params.id);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/leads/:leadId/proposals", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const leadId = parseInt(req.params.leadId, 10);
      if (isNaN(leadId)) return res.status(400).json({ error: "Invalid lead ID" });
      const { phases, additionalLineItems, ...proposalRaw } = req.body;
      const parsedPhases = z.array(proposalPhaseInputSchema).parse(phases ?? []);
      const parsedAdditional = additionalLineItems != null
        ? z.array(additionalLineItemInputSchema).parse(additionalLineItems)
        : undefined;
      const proposal = await storage.createProposal(
        userId,
        { ...proposalRaw, leadId },
        parsedPhases,
        parsedAdditional
      );
      res.json(proposal);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.patch("/api/proposals/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { phases, additionalLineItems } = req.body;
      const ALLOWED_FIELDS = ["name", "description", "status", "proposalType", "docUrl", "dateSent", "dateSigned"] as const;
      const updates: Partial<Record<typeof ALLOWED_FIELDS[number], unknown>> = {};
      for (const field of ALLOWED_FIELDS) {
        if (field in req.body) updates[field] = req.body[field];
      }
      const parsedPhases = phases != null
        ? z.array(proposalPhaseInputSchema).parse(phases)
        : undefined;
      const parsedAdditional = additionalLineItems != null
        ? z.array(additionalLineItemInputSchema).parse(additionalLineItems)
        : undefined;
      const proposal = await storage.updateProposal(
        userId,
        req.params.id,
        updates as Parameters<typeof storage.updateProposal>[2],
        parsedPhases,
        parsedAdditional
      );
      if (!proposal) return res.status(404).json({ error: "Proposal not found" });
      res.json(proposal);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.post("/api/proposals/:id/sign", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const proposal = await storage.signProposal(userId, req.params.id);
      if (!proposal) return res.status(404).json({ error: "Proposal not found" });
      res.json(proposal);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.post("/api/proposals/:id/decline", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const proposal = await storage.updateProposal(userId, req.params.id, { status: "Declined" });
      if (!proposal) return res.status(404).json({ error: "Proposal not found" });
      res.json(proposal);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/proposals/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const success = await storage.deleteProposal(userId, req.params.id);
      if (!success) return res.status(404).json({ error: "Proposal not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Consultant Contracts
  app.get("/api/proposals/:id/consultant-contracts", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const proposal = await storage.getProposalById(userId, req.params.id);
      if (!proposal) return res.status(404).json({ error: "Proposal not found" });
      const contracts = await storage.getConsultantContracts(req.params.id);
      res.json(contracts);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/proposals/:id/consultant-contracts/generate", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { consultant, templateId, outputName } = req.body;
      if (!consultant || !templateId || !outputName) {
        return res.status(400).json({ error: "consultant, templateId, and outputName are required" });
      }
      const proposal = await storage.getProposalById(userId, req.params.id);
      if (!proposal) return res.status(404).json({ error: "Proposal not found" });
      if (proposal.status !== "Signed") {
        return res.status(400).json({ error: "Proposal must be signed to generate consultant contracts" });
      }
      const profile = await storage.getMyProfile(userId);
      const { docs, drive } = await getGoogleClient(userId);
      const { documentUrl } = await generateConsultantDocument(
        proposal, consultant, templateId, outputName, profile, docs, drive
      );
      const contract = await storage.upsertConsultantContract(req.params.id, consultant, documentUrl);
      res.json({ docUrl: documentUrl, contract });
    } catch (error) {
      console.error("Error generating consultant contract:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });
}
