import { db } from "../db";
import { eq, and, inArray, isNull, sql } from "drizzle-orm";
import { verifyLeadOwnership, getLeads } from "./leads";
import {
  invoices,
  invoiceFeeLineSnapshots,
  invoiceAdditionalLineItemSnapshots,
  hoursEntries,
  expenseEntries,
  projectComments,
  proposals,
  proposalFeeLines,
  proposalPhases,
  type Invoice,
  type InvoiceWithDetails,
  type InvoiceFeeLineSnapshot,
  type InvoiceAdditionalLineItemSnapshot,
  type HoursEntry,
  type ExpenseEntry,
  type ProjectComment,
} from "@shared/schema";
import type { DashboardStats } from "../storage";

// ─── Invoices ─────────────────────────────────────────────────────────────────

export async function getInvoices(userId: string, leadId: number): Promise<Invoice[]> {
  const owned = await verifyLeadOwnership(userId, leadId);
  if (!owned) return [];
  return db.select().from(invoices).where(eq(invoices.leadId, leadId)).orderBy(invoices.invoiceNumber);
}

export async function getInvoiceById(userId: string, invoiceId: string): Promise<InvoiceWithDetails | undefined> {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
  if (!invoice) return undefined;
  const owned = await verifyLeadOwnership(userId, invoice.leadId);
  if (!owned) return undefined;

  const [snapshots, additionalSnapshots, hours, expenses] = await Promise.all([
    db.select().from(invoiceFeeLineSnapshots).where(eq(invoiceFeeLineSnapshots.invoiceId, invoiceId)).orderBy(invoiceFeeLineSnapshots.sortOrder),
    db.select().from(invoiceAdditionalLineItemSnapshots).where(eq(invoiceAdditionalLineItemSnapshots.invoiceId, invoiceId)).orderBy(invoiceAdditionalLineItemSnapshots.sortOrder),
    db.select().from(hoursEntries).where(eq(hoursEntries.invoiceId, invoiceId)),
    db.select().from(expenseEntries).where(eq(expenseEntries.invoiceId, invoiceId)),
  ]);

  return { ...invoice, feeLineSnapshots: snapshots, additionalLineItemSnapshots: additionalSnapshots, hoursEntries: hours, expenseEntries: expenses };
}

export async function createInvoice(
  userId: string,
  leadId: number,
  proposalId: string,
  feeLineInputs: { proposalFeeLineId: string; percentComplete?: string; hoursWorked?: string; ratePerHour?: string }[],
  hoursInputs: { date: string; description: string; hours: string; ratePerHour: string }[],
  expenseInputs: { date: string; expenseType: string; billedDate?: string; milesTraveled?: string; ratePerMile?: string; amount?: string }[],
  notes?: string,
  existingHoursIds?: string[],
  existingExpenseIds?: string[],
  additionalLineItemInputs?: { additionalLineItemId: string; description: string; amount: string | null; percentComplete: string }[]
): Promise<InvoiceWithDetails> {
  const owned = await verifyLeadOwnership(userId, leadId);
  if (!owned) throw new Error('Lead not found or access denied');

  const [proposalRow] = await db.select({ leadId: proposals.leadId, status: proposals.status }).from(proposals).where(eq(proposals.id, proposalId));
  if (!proposalRow || proposalRow.leadId !== leadId) throw new Error('Proposal not found or does not belong to this lead');
  if (proposalRow.status !== 'Signed') throw new Error('Invoices can only be created against a signed proposal');

  return await db.transaction(async (tx) => {
    const existingInvoices = await tx.select({ num: invoices.invoiceNumber }).from(invoices).where(eq(invoices.leadId, leadId));
    const nextNumber = existingInvoices.length > 0 ? Math.max(...existingInvoices.map(i => i.num)) + 1 : 1;

    const [invoice] = await tx
      .insert(invoices)
      .values({ leadId, proposalId, invoiceNumber: nextNumber, notes: notes || null })
      .returning();

    const proposalFeeLineIds = feeLineInputs.map(f => f.proposalFeeLineId);
    const allProposalFeeLines = proposalFeeLineIds.length > 0
      ? await tx.select().from(proposalFeeLines).where(inArray(proposalFeeLines.id, proposalFeeLineIds))
      : [];

    if (allProposalFeeLines.length > 0) {
      const phaseIds = allProposalFeeLines.map(fl => fl.phaseId);
      const validPhases = await tx.select({ id: proposalPhases.id }).from(proposalPhases).where(and(inArray(proposalPhases.id, phaseIds), eq(proposalPhases.proposalId, proposalId)));
      const validPhaseIds = new Set(validPhases.map(p => p.id));
      const invalidLine = allProposalFeeLines.find(fl => !validPhaseIds.has(fl.phaseId));
      if (invalidLine) throw new Error('One or more fee lines do not belong to this proposal');
    }

    const previousBillingMap = new Map<string, number>();
    const priorInvoices = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.leadId, leadId), eq(invoices.proposalId, proposalId)));
    const priorInvoiceIds = priorInvoices.map(i => i.id).filter(id => id !== invoice.id);

    if (priorInvoiceIds.length > 0) {
      const priorSnapshots = await tx
        .select()
        .from(invoiceFeeLineSnapshots)
        .where(inArray(invoiceFeeLineSnapshots.invoiceId, priorInvoiceIds));
      for (const snap of priorSnapshots) {
        const billed = parseFloat(snap.currentBilling || '0');
        previousBillingMap.set(snap.proposalFeeLineId, (previousBillingMap.get(snap.proposalFeeLineId) || 0) + billed);
      }
    }

    const snapshotValues: (typeof invoiceFeeLineSnapshots.$inferInsert)[] = [];
    let sortIdx = 0;
    for (const input of feeLineInputs) {
      const feeLine = allProposalFeeLines.find(fl => fl.id === input.proposalFeeLineId);
      if (!feeLine) continue;

      const baseFee = feeLine.amount ? parseFloat(feeLine.amount) : null;
      const prevBilling = previousBillingMap.get(feeLine.id) || 0;
      let percentComplete: string | null = null;
      let earned: string | null = null;
      let currentBilling: string | null = null;
      let hoursWorked: string | null = null;
      let ratePerHour: string | null = null;

      if (feeLine.feeType === 'Fixed' && baseFee !== null) {
        const pct = parseFloat(input.percentComplete || '0');
        const earnedVal = baseFee * pct / 100;
        const curBilling = Math.max(0, earnedVal - prevBilling);
        percentComplete = pct.toFixed(2);
        earned = earnedVal.toFixed(2);
        currentBilling = curBilling.toFixed(2);
      } else if (feeLine.feeType === 'Hourly') {
        hoursWorked = input.hoursWorked || '0';
        ratePerHour = input.ratePerHour || '0';
        const earnedVal = parseFloat(hoursWorked) * parseFloat(ratePerHour);
        earned = earnedVal.toFixed(2);
        currentBilling = earnedVal.toFixed(2);
      }

      snapshotValues.push({
        invoiceId: invoice.id,
        proposalFeeLineId: feeLine.id,
        consultant: feeLine.consultant,
        feeType: feeLine.feeType,
        baseFee: baseFee !== null ? baseFee.toFixed(2) : null,
        percentComplete,
        earned,
        previousBilling: prevBilling.toFixed(2),
        currentBilling,
        hoursWorked,
        ratePerHour,
        sortOrder: sortIdx++,
      });
    }

    let savedSnapshots: InvoiceFeeLineSnapshot[] = [];
    if (snapshotValues.length > 0) {
      savedSnapshots = await tx.insert(invoiceFeeLineSnapshots).values(snapshotValues).returning();
    }

    let savedHours: HoursEntry[] = [];
    if (hoursInputs.length > 0) {
      savedHours = await tx.insert(hoursEntries).values(hoursInputs.map(h => ({ invoiceId: invoice.id, leadId, ...h }))).returning();
    }

    if (existingHoursIds && existingHoursIds.length > 0) {
      await tx.update(hoursEntries)
        .set({ invoiceId: invoice.id })
        .where(and(inArray(hoursEntries.id, existingHoursIds), eq(hoursEntries.leadId, leadId), isNull(hoursEntries.invoiceId)));
      const attachedHours = await tx.select().from(hoursEntries)
        .where(and(inArray(hoursEntries.id, existingHoursIds), eq(hoursEntries.invoiceId, invoice.id)));
      savedHours = [...savedHours, ...attachedHours];
    }

    let savedExpenses: ExpenseEntry[] = [];
    if (expenseInputs.length > 0) {
      savedExpenses = await tx.insert(expenseEntries).values(
        expenseInputs.map(e => ({
          invoiceId: invoice.id,
          leadId,
          date: e.date,
          expenseType: e.expenseType,
          billedDate: e.billedDate || null,
          milesTraveled: e.milesTraveled || null,
          ratePerMile: e.ratePerMile || null,
          amount: e.amount || null,
        }))
      ).returning();
    }

    if (existingExpenseIds && existingExpenseIds.length > 0) {
      await tx.update(expenseEntries)
        .set({ invoiceId: invoice.id })
        .where(and(inArray(expenseEntries.id, existingExpenseIds), eq(expenseEntries.leadId, leadId), isNull(expenseEntries.invoiceId)));
      const attachedExpenses = await tx.select().from(expenseEntries)
        .where(and(inArray(expenseEntries.id, existingExpenseIds), eq(expenseEntries.invoiceId, invoice.id)));
      savedExpenses = [...savedExpenses, ...attachedExpenses];
    }

    let savedAdditionalSnapshots: InvoiceAdditionalLineItemSnapshot[] = [];
    if (additionalLineItemInputs && additionalLineItemInputs.length > 0) {
      const priorAdditionalSnapshots = priorInvoiceIds.length > 0
        ? await tx.select().from(invoiceAdditionalLineItemSnapshots).where(inArray(invoiceAdditionalLineItemSnapshots.invoiceId, priorInvoiceIds))
        : [];
      const prevAdditionalBillingMap = new Map<string, number>();
      for (const snap of priorAdditionalSnapshots) {
        const billed = parseFloat(snap.currentBilling || '0');
        prevAdditionalBillingMap.set(snap.additionalLineItemId, (prevAdditionalBillingMap.get(snap.additionalLineItemId) || 0) + billed);
      }

      const additionalSnapshotValues: (typeof invoiceAdditionalLineItemSnapshots.$inferInsert)[] = [];
      let addSortIdx = 0;
      for (const input of additionalLineItemInputs) {
        const baseFee = input.amount ? parseFloat(input.amount) : null;
        const prevBilling = prevAdditionalBillingMap.get(input.additionalLineItemId) || 0;
        let currentBilling = '0.00';
        if (baseFee !== null) {
          const pct = parseFloat(input.percentComplete || '0');
          const earned = baseFee * pct / 100;
          currentBilling = Math.max(0, earned - prevBilling).toFixed(2);
        }
        additionalSnapshotValues.push({
          invoiceId: invoice.id,
          additionalLineItemId: input.additionalLineItemId,
          description: input.description,
          amount: input.amount || null,
          percentComplete: input.percentComplete || '0',
          previousBilling: prevBilling.toFixed(2),
          currentBilling,
          sortOrder: addSortIdx++,
        });
      }
      savedAdditionalSnapshots = await tx.insert(invoiceAdditionalLineItemSnapshots).values(additionalSnapshotValues).returning();
    }

    return {
      ...invoice,
      feeLineSnapshots: savedSnapshots,
      additionalLineItemSnapshots: savedAdditionalSnapshots,
      hoursEntries: savedHours,
      expenseEntries: savedExpenses,
    };
  });
}

export async function updateInvoiceStatus(userId: string, invoiceId: string, status: string): Promise<Invoice | undefined> {
  const existing = await getInvoiceById(userId, invoiceId);
  if (!existing) return undefined;
  const [updated] = await db
    .update(invoices)
    .set({ status, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(invoices.id, invoiceId))
    .returning();
  return updated || undefined;
}

export async function updateInvoiceDocUrl(userId: string, invoiceId: string, docUrl: string): Promise<Invoice | undefined> {
  const existing = await getInvoiceById(userId, invoiceId);
  if (!existing) return undefined;
  const [updated] = await db
    .update(invoices)
    .set({ docUrl, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(invoices.id, invoiceId))
    .returning();
  return updated || undefined;
}

export async function deleteInvoice(userId: string, invoiceId: string): Promise<boolean> {
  const existing = await getInvoiceById(userId, invoiceId);
  if (!existing) return false;
  const result = await db.delete(invoices).where(eq(invoices.id, invoiceId));
  return result.rowCount ? result.rowCount > 0 : false;
}

// ─── Hours Entries ────────────────────────────────────────────────────────────

export async function getProjectHours(userId: string, leadId: number): Promise<HoursEntry[]> {
  const owned = await verifyLeadOwnership(userId, leadId);
  if (!owned) return [];
  return db.select().from(hoursEntries).where(eq(hoursEntries.leadId, leadId)).orderBy(hoursEntries.date);
}

export async function createHoursEntry(
  userId: string,
  invoiceId: string | null,
  leadId: number,
  entry: { date: string; description: string; hours: string; ratePerHour: string }
): Promise<HoursEntry> {
  const owned = await verifyLeadOwnership(userId, leadId);
  if (!owned) throw new Error('Access denied');
  const [row] = await db.insert(hoursEntries).values({ invoiceId: invoiceId ?? null, leadId, ...entry }).returning();
  return row;
}

export async function updateHoursEntry(
  userId: string,
  id: string,
  updates: Partial<{ date: string; description: string; hours: string; ratePerHour: string; invoiceId: string | null }>
): Promise<HoursEntry | undefined> {
  const [existing] = await db.select().from(hoursEntries).where(eq(hoursEntries.id, id));
  if (!existing) return undefined;
  const owned = await verifyLeadOwnership(userId, existing.leadId);
  if (!owned) return undefined;
  if (updates.invoiceId !== undefined && updates.invoiceId !== null) {
    const [invoice] = await db.select({ leadId: invoices.leadId }).from(invoices).where(eq(invoices.id, updates.invoiceId));
    if (!invoice || invoice.leadId !== existing.leadId) return undefined;
  }
  const [updated] = await db.update(hoursEntries).set(updates).where(eq(hoursEntries.id, id)).returning();
  return updated || undefined;
}

export async function deleteHoursEntry(userId: string, id: string): Promise<boolean> {
  const [existing] = await db.select().from(hoursEntries).where(eq(hoursEntries.id, id));
  if (!existing) return false;
  const owned = await verifyLeadOwnership(userId, existing.leadId);
  if (!owned) return false;
  const result = await db.delete(hoursEntries).where(eq(hoursEntries.id, id));
  return result.rowCount ? result.rowCount > 0 : false;
}

// ─── Expense Entries ──────────────────────────────────────────────────────────

export async function getProjectExpenses(userId: string, leadId: number): Promise<ExpenseEntry[]> {
  const owned = await verifyLeadOwnership(userId, leadId);
  if (!owned) return [];
  return db.select().from(expenseEntries).where(eq(expenseEntries.leadId, leadId)).orderBy(expenseEntries.date);
}

export async function createExpenseEntry(
  userId: string,
  invoiceId: string | null,
  leadId: number,
  entry: { date: string; expenseType: string; billedDate?: string; milesTraveled?: string; ratePerMile?: string; amount?: string }
): Promise<ExpenseEntry> {
  const owned = await verifyLeadOwnership(userId, leadId);
  if (!owned) throw new Error('Access denied');
  const [row] = await db.insert(expenseEntries).values({
    invoiceId: invoiceId ?? null,
    leadId,
    date: entry.date,
    expenseType: entry.expenseType,
    billedDate: entry.billedDate || null,
    milesTraveled: entry.milesTraveled || null,
    ratePerMile: entry.ratePerMile || null,
    amount: entry.amount || null,
  }).returning();
  return row;
}

export async function updateExpenseEntry(
  userId: string,
  id: string,
  updates: Partial<{ date: string; expenseType: string; billedDate?: string; milesTraveled?: string; ratePerMile?: string; amount?: string; invoiceId: string | null }>
): Promise<ExpenseEntry | undefined> {
  const [existing] = await db.select().from(expenseEntries).where(eq(expenseEntries.id, id));
  if (!existing) return undefined;
  const owned = await verifyLeadOwnership(userId, existing.leadId);
  if (!owned) return undefined;
  if (updates.invoiceId !== undefined && updates.invoiceId !== null) {
    const [invoice] = await db.select({ leadId: invoices.leadId }).from(invoices).where(eq(invoices.id, updates.invoiceId));
    if (!invoice || invoice.leadId !== existing.leadId) return undefined;
  }
  const [updated] = await db.update(expenseEntries).set(updates).where(eq(expenseEntries.id, id)).returning();
  return updated || undefined;
}

export async function deleteExpenseEntry(userId: string, id: string): Promise<boolean> {
  const [existing] = await db.select().from(expenseEntries).where(eq(expenseEntries.id, id));
  if (!existing) return false;
  const owned = await verifyLeadOwnership(userId, existing.leadId);
  if (!owned) return false;
  const result = await db.delete(expenseEntries).where(eq(expenseEntries.id, id));
  return result.rowCount ? result.rowCount > 0 : false;
}

// ─── Project Comments ─────────────────────────────────────────────────────────

export async function getProjectComments(userId: string, leadId: number): Promise<ProjectComment[]> {
  const owned = await verifyLeadOwnership(userId, leadId);
  if (!owned) return [];
  return db.select().from(projectComments).where(eq(projectComments.leadId, leadId)).orderBy(projectComments.createdAt);
}

export async function createProjectComment(userId: string, leadId: number, content: string): Promise<ProjectComment> {
  const owned = await verifyLeadOwnership(userId, leadId);
  if (!owned) throw new Error('Access denied');
  const [row] = await db.insert(projectComments).values({ leadId, content }).returning();
  return row;
}

export async function deleteProjectComment(userId: string, commentId: string, leadId: number): Promise<boolean> {
  const owned = await verifyLeadOwnership(userId, leadId);
  if (!owned) return false;
  const result = await db.delete(projectComments).where(and(eq(projectComments.id, commentId), eq(projectComments.leadId, leadId)));
  return result.rowCount ? result.rowCount > 0 : false;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const allLeads = await getLeads(userId);
  const leadsByStatus: Record<string, number> = {};
  for (const lead of allLeads) {
    leadsByStatus[lead.status] = (leadsByStatus[lead.status] || 0) + 1;
  }

  const allUserLeadIds = allLeads.map(l => l.id);
  let sentInvoicesTotal = 0;
  let paidInvoicesTotal = 0;

  if (allUserLeadIds.length > 0) {
    const allInvoices = await db.select().from(invoices).where(inArray(invoices.leadId, allUserLeadIds));
    const sentAndPaid = allInvoices.filter(i => i.status === 'Sent' || i.status === 'Paid');

    if (sentAndPaid.length > 0) {
      const invoiceIds = sentAndPaid.map(i => i.id);
      const [allSnapshots, allHours, allExpenses] = await Promise.all([
        db.select().from(invoiceFeeLineSnapshots).where(inArray(invoiceFeeLineSnapshots.invoiceId, invoiceIds)),
        db.select().from(hoursEntries).where(inArray(hoursEntries.invoiceId, invoiceIds)),
        db.select().from(expenseEntries).where(inArray(expenseEntries.invoiceId, invoiceIds)),
      ]);

      for (const invoice of sentAndPaid) {
        const snaps = allSnapshots.filter(s => s.invoiceId === invoice.id);
        const feeTotal = snaps.reduce((sum, s) => sum + parseFloat(s.currentBilling || '0'), 0);
        const hoursTotal = allHours
          .filter(h => h.invoiceId === invoice.id)
          .reduce((sum, h) => sum + parseFloat(h.hours || '0') * parseFloat(h.ratePerHour || '0'), 0);
        const expenseTotal = allExpenses
          .filter(e => e.invoiceId === invoice.id)
          .reduce((sum, e) => {
            if (e.milesTraveled) return sum + parseFloat(e.milesTraveled) * parseFloat(e.ratePerMile || '0.67');
            return sum + parseFloat(e.amount || '0');
          }, 0);
        const total = feeTotal + hoursTotal + expenseTotal;
        if (invoice.status === 'Sent') sentInvoicesTotal += total;
        if (invoice.status === 'Paid') paidInvoicesTotal += total;
      }
    }
  }

  const recentLeads = allLeads.slice(-6).reverse();
  return { leadsByStatus, sentInvoicesTotal, paidInvoicesTotal, recentLeads };
}
