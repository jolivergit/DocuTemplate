import type { Express } from "express";
import { requireAuth } from "../auth";
import { storage } from "../storage";
import { getGoogleClient } from "../google-client";
import { insertPhaseTable } from "../services/google-docs";
import type { PhaseRow } from "../services/google-docs";
import type { User } from "@shared/schema";

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
      const proposal = await storage.createProposal(
        userId,
        { ...proposalRaw, leadId },
        phases || [],
        Array.isArray(additionalLineItems) ? additionalLineItems : undefined
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
      const proposal = await storage.updateProposal(
        userId,
        req.params.id,
        updates as Parameters<typeof storage.updateProposal>[2],
        phases,
        Array.isArray(additionalLineItems) ? additionalLineItems : undefined
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

      const consultantRows: PhaseRow[] = proposal.phases.flatMap(phase =>
        phase.feeLines
          .filter(fl => fl.consultant === consultant && (fl.amount || fl.feeType === 'Hourly'))
          .map(fl => ({
            phase: phase.name,
            consultant: fl.consultant,
            feeType: fl.feeType,
            amount: fl.amount ?? null,
          }))
      );

      const consultantTotal = consultantRows.reduce((sum, row) => {
        if (row.feeType === 'Fixed' && row.amount) {
          const n = parseFloat(row.amount);
          return isNaN(n) ? sum : sum + n;
        }
        return sum;
      }, 0);

      const fieldValueLookup = new Map<string, string>();
      fieldValueLookup.set('consultant_name', consultant);
      fieldValueLookup.set('consultant_total',
        consultantTotal > 0
          ? `$${consultantTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
          : ''
      );
      fieldValueLookup.set('proposal_name', proposal.name);
      fieldValueLookup.set('proposal_date',
        proposal.dateSigned
          ? new Date(proposal.dateSigned as Date).toLocaleDateString()
          : ''
      );

      const profile = await storage.getMyProfile(userId);
      if (profile) {
        fieldValueLookup.set('firm_name', profile.name || '');
        fieldValueLookup.set('firm_phone', profile.phone || '');
        fieldValueLookup.set('firm_email', profile.email || '');
        fieldValueLookup.set('firm_address', [profile.addressLine1, profile.addressLine2].filter(Boolean).join(', '));
        fieldValueLookup.set('firm_city', profile.city || '');
        fieldValueLookup.set('firm_state', profile.state || '');
        fieldValueLookup.set('firm_zip', profile.zip || '');
        fieldValueLookup.set('firm_contact_name', profile.contactName || '');
        fieldValueLookup.set('firm_contact_title', profile.contactTitle || '');
      }

      const { docs, drive } = await getGoogleClient(userId);

      const timestamp = Date.now();
      const copiedFile = await drive.files.copy({
        fileId: templateId,
        requestBody: { name: `${outputName}_${timestamp}` },
      });
      const newDocId = copiedFile.data.id;
      if (!newDocId) return res.status(500).json({ error: "Failed to copy template document" });

      const preDoc = await docs.documents.get({ documentId: newDocId });
      let preDocText = '';
      for (const element of preDoc.data.body?.content || []) {
        if (element.paragraph?.elements) {
          for (const el of element.paragraph.elements) {
            preDocText += el.textRun?.content || '';
          }
        }
      }
      const hasConsultantTableTag = preDocText.includes('{{consultant_phases_table}}');

      const fieldRequests: Array<{ replaceAllText: { containsText: { text: string; matchCase: boolean }; replaceText: string } }> = [];
      for (const [tagName, value] of Array.from(fieldValueLookup.entries())) {
        fieldRequests.push({
          replaceAllText: {
            containsText: { text: `{{${tagName}}}`, matchCase: true },
            replaceText: value,
          },
        });
      }
      if (fieldRequests.length > 0) {
        await docs.documents.batchUpdate({ documentId: newDocId, requestBody: { requests: fieldRequests } });
      }

      if (hasConsultantTableTag && consultantRows.length > 0) {
        await insertPhaseTable(docs, newDocId, '{{consultant_phases_table}}', consultantRows);
      }

      const documentUrl = `https://docs.google.com/document/d/${newDocId}/edit`;
      const contract = await storage.upsertConsultantContract(req.params.id, consultant, documentUrl);
      res.json({ docUrl: documentUrl, contract });
    } catch (error) {
      console.error('Error generating consultant contract:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });
}
