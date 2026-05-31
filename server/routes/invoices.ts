import type { Express } from "express";
import { requireAuth } from "../auth";
import { storage } from "../storage";
import {
  INVOICE_STATUSES,
  EXPENSE_TYPES,
  invoiceFeeLineSnapshotInputSchema,
  invoiceHoursInputSchema,
  invoiceExpenseInputSchema,
  invoiceAdditionalLineItemInputSchema,
  type User,
} from "@shared/schema";
import { z } from "zod";

export function registerInvoiceRoutes(app: Express): void {
  // Invoices
  app.get("/api/leads/:leadId/invoices", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const leadId = parseInt(req.params.leadId, 10);
      if (isNaN(leadId)) return res.status(400).json({ error: "Invalid lead ID" });
      const result = await storage.getInvoices(userId, leadId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/invoices/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const invoice = await storage.getInvoiceById(userId, req.params.id);
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/leads/:leadId/invoices", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const leadId = parseInt(req.params.leadId, 10);
      if (isNaN(leadId)) return res.status(400).json({ error: "Invalid lead ID" });
      const { proposalId, feeLineInputs, hoursInputs, expenseInputs, notes, existingHoursIds, existingExpenseIds, additionalLineItemInputs } = req.body;
      if (!proposalId) return res.status(400).json({ error: "proposalId is required" });
      const parsedFeeLines = z.array(invoiceFeeLineSnapshotInputSchema).parse(feeLineInputs ?? []);
      const parsedHours = z.array(invoiceHoursInputSchema).parse(hoursInputs ?? []);
      const parsedExpenses = z.array(invoiceExpenseInputSchema).parse(expenseInputs ?? []);
      const parsedAdditional = additionalLineItemInputs != null
        ? z.array(invoiceAdditionalLineItemInputSchema).parse(additionalLineItemInputs)
        : undefined;
      const invoice = await storage.createInvoice(
        userId, leadId, proposalId, parsedFeeLines, parsedHours, parsedExpenses, notes,
        Array.isArray(existingHoursIds) ? existingHoursIds : undefined,
        Array.isArray(existingExpenseIds) ? existingExpenseIds : undefined,
        parsedAdditional
      );
      res.json(invoice);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.patch("/api/invoices/:id/status", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { status } = req.body;
      if (!status) return res.status(400).json({ error: "status is required" });
      if (!(INVOICE_STATUSES as readonly string[]).includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${INVOICE_STATUSES.join(", ")}` });
      }
      const current = await storage.getInvoiceById(userId, req.params.id);
      if (!current) return res.status(404).json({ error: "Invoice not found" });
      const ORDER = { Draft: 0, Sent: 1, Paid: 2 } as Record<string, number>;
      if ((ORDER[status] ?? -1) < (ORDER[current.status] ?? 0)) {
        return res.status(400).json({ error: `Cannot revert status from ${current.status} to ${status}` });
      }
      const invoice = await storage.updateInvoiceStatus(userId, req.params.id, status);
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });
      res.json(invoice);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.patch("/api/invoices/:id/doc-url", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { docUrl } = req.body;
      if (!docUrl) return res.status(400).json({ error: "docUrl is required" });
      const invoice = await storage.updateInvoiceDocUrl(userId, req.params.id, docUrl);
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });
      res.json(invoice);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/invoices/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const success = await storage.deleteInvoice(userId, req.params.id);
      if (!success) return res.status(404).json({ error: "Invoice not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Project-level hours
  app.get("/api/leads/:leadId/hours", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const leadId = parseInt(req.params.leadId, 10);
      if (isNaN(leadId)) return res.status(400).json({ error: "Invalid lead ID" });
      const result = await storage.getProjectHours(userId, leadId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/leads/:leadId/hours", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const leadId = parseInt(req.params.leadId, 10);
      if (isNaN(leadId)) return res.status(400).json({ error: "Invalid lead ID" });
      const { date, description, hours, ratePerHour, invoiceId } = req.body;
      if (!date || !description || !hours || !ratePerHour) {
        return res.status(400).json({ error: "date, description, hours, and ratePerHour are required" });
      }
      let resolvedInvoiceId: string | null = null;
      if (invoiceId) {
        const invoice = await storage.getInvoiceById(userId, invoiceId);
        if (!invoice) return res.status(403).json({ error: "Invoice not found or access denied" });
        if (invoice.leadId !== leadId) return res.status(400).json({ error: "Invoice does not belong to this project" });
        resolvedInvoiceId = invoiceId;
      }
      const entry = await storage.createHoursEntry(userId, resolvedInvoiceId, leadId, { date, description, hours, ratePerHour });
      res.json(entry);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Project-level expenses
  app.get("/api/leads/:leadId/expenses", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const leadId = parseInt(req.params.leadId, 10);
      if (isNaN(leadId)) return res.status(400).json({ error: "Invalid lead ID" });
      const result = await storage.getProjectExpenses(userId, leadId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/leads/:leadId/expenses", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const leadId = parseInt(req.params.leadId, 10);
      if (isNaN(leadId)) return res.status(400).json({ error: "Invalid lead ID" });
      const { expenseType, invoiceId, ...rest } = req.body;
      if (expenseType && !(EXPENSE_TYPES as readonly string[]).includes(expenseType)) {
        return res.status(400).json({ error: `Invalid expenseType. Must be one of: ${EXPENSE_TYPES.join(", ")}` });
      }
      let resolvedInvoiceId: string | null = null;
      if (invoiceId) {
        const invoice = await storage.getInvoiceById(userId, invoiceId);
        if (!invoice) return res.status(403).json({ error: "Invoice not found or access denied" });
        if (invoice.leadId !== leadId) return res.status(400).json({ error: "Invoice does not belong to this project" });
        resolvedInvoiceId = invoiceId;
      }
      const entry = await storage.createExpenseEntry(userId, resolvedInvoiceId, leadId, { expenseType, ...rest });
      res.json(entry);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Hours entries (invoice-scoped)
  app.post("/api/invoices/:id/hours", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const invoice = await storage.getInvoiceById(userId, req.params.id);
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });
      const entry = await storage.createHoursEntry(userId, req.params.id, invoice.leadId, req.body);
      res.json(entry);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.patch("/api/hours/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { invoiceId, ...rest } = req.body;
      const updates: Record<string, unknown> = { ...rest };
      if (invoiceId !== undefined) {
        if (invoiceId === null) {
          updates.invoiceId = null;
        } else {
          const invoice = await storage.getInvoiceById(userId, invoiceId);
          if (!invoice) return res.status(403).json({ error: "Invoice not found or access denied" });
          updates.invoiceId = invoiceId;
        }
      }
      const entry = await storage.updateHoursEntry(userId, req.params.id, updates as Parameters<typeof storage.updateHoursEntry>[2]);
      if (!entry) return res.status(404).json({ error: "Hours entry not found" });
      res.json(entry);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/hours/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const success = await storage.deleteHoursEntry(userId, req.params.id);
      if (!success) return res.status(404).json({ error: "Hours entry not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Expense entries (invoice-scoped)
  app.post("/api/invoices/:id/expenses", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { expenseType } = req.body;
      if (expenseType && !(EXPENSE_TYPES as readonly string[]).includes(expenseType)) {
        return res.status(400).json({ error: `Invalid expenseType. Must be one of: ${EXPENSE_TYPES.join(", ")}` });
      }
      const invoice = await storage.getInvoiceById(userId, req.params.id);
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });
      const entry = await storage.createExpenseEntry(userId, req.params.id, invoice.leadId, req.body);
      res.json(entry);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.patch("/api/expenses/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { invoiceId, ...rest } = req.body;
      const updates: Record<string, unknown> = { ...rest };
      if (invoiceId !== undefined) {
        if (invoiceId === null) {
          updates.invoiceId = null;
        } else {
          const invoice = await storage.getInvoiceById(userId, invoiceId);
          if (!invoice) return res.status(403).json({ error: "Invoice not found or access denied" });
          updates.invoiceId = invoiceId;
        }
      }
      const entry = await storage.updateExpenseEntry(userId, req.params.id, updates as Parameters<typeof storage.updateExpenseEntry>[2]);
      if (!entry) return res.status(404).json({ error: "Expense entry not found" });
      res.json(entry);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/expenses/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const success = await storage.deleteExpenseEntry(userId, req.params.id);
      if (!success) return res.status(404).json({ error: "Expense entry not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Project comments
  app.get("/api/leads/:leadId/comments", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const leadId = parseInt(req.params.leadId, 10);
      if (isNaN(leadId)) return res.status(400).json({ error: "Invalid lead ID" });
      const comments = await storage.getProjectComments(userId, leadId);
      res.json(comments);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/leads/:leadId/comments", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const leadId = parseInt(req.params.leadId, 10);
      if (isNaN(leadId)) return res.status(400).json({ error: "Invalid lead ID" });
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ error: "Content is required" });
      const comment = await storage.createProjectComment(userId, leadId, content.trim());
      res.json(comment);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/leads/:leadId/comments/:commentId", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const leadId = parseInt(req.params.leadId, 10);
      if (isNaN(leadId)) return res.status(400).json({ error: "Invalid lead ID" });
      const success = await storage.deleteProjectComment(userId, req.params.commentId, leadId);
      if (!success) return res.status(404).json({ error: "Comment not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });
}
