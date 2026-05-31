import { db } from "../db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { verifyLeadOwnership } from "./leads";
import {
  proposals,
  proposalPhases,
  proposalFeeLines,
  proposalAdditionalLineItems,
  consultantContracts,
  invoices,
  invoiceFeeLineSnapshots,
  leads,
  type Proposal,
  type InsertProposal,
  type ProposalPhaseWithLines,
  type ProposalWithPhases,
  type ProposalAdditionalLineItem,
  type ProposalFeeLine,
  type ConsultantContract,
  type ProposalPhaseInput,
  type AdditionalLineItemInput,
} from "@shared/schema";

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function buildProposalWithPhases(proposal: Proposal): Promise<ProposalWithPhases> {
  const phases = await db
    .select()
    .from(proposalPhases)
    .where(eq(proposalPhases.proposalId, proposal.id))
    .orderBy(proposalPhases.sortOrder);

  if (phases.length === 0) {
    const additionalLineItemsEmpty = await db
      .select()
      .from(proposalAdditionalLineItems)
      .where(eq(proposalAdditionalLineItems.proposalId, proposal.id))
      .orderBy(proposalAdditionalLineItems.sortOrder);
    return { ...proposal, phases: [], additionalLineItems: additionalLineItemsEmpty };
  }

  const phaseIds = phases.map(p => p.id);
  const allFeeLines = await db
    .select()
    .from(proposalFeeLines)
    .where(inArray(proposalFeeLines.phaseId, phaseIds))
    .orderBy(proposalFeeLines.sortOrder);

  const phasesWithLines: ProposalPhaseWithLines[] = phases.map(phase => ({
    ...phase,
    feeLines: allFeeLines.filter(fl => fl.phaseId === phase.id),
  }));

  const additionalLineItems: ProposalAdditionalLineItem[] = await db
    .select()
    .from(proposalAdditionalLineItems)
    .where(eq(proposalAdditionalLineItems.proposalId, proposal.id))
    .orderBy(proposalAdditionalLineItems.sortOrder);

  return { ...proposal, phases: phasesWithLines, additionalLineItems };
}

function toProposalDbValues(data: Partial<InsertProposal>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...data };
  if ('dateSent' in data) result.dateSent = data.dateSent ? new Date(data.dateSent as string) : null;
  if ('dateSigned' in data) result.dateSigned = data.dateSigned ? new Date(data.dateSigned as string) : null;
  return result;
}

// ─── Proposals ────────────────────────────────────────────────────────────────

export async function getProposals(userId: string, leadId: number): Promise<ProposalWithPhases[]> {
  const owned = await verifyLeadOwnership(userId, leadId);
  if (!owned) return [];
  const rows = await db
    .select()
    .from(proposals)
    .where(eq(proposals.leadId, leadId))
    .orderBy(proposals.createdAt);
  if (rows.length === 0) return [];

  const proposalIds = rows.map(p => p.id);

  // Batch: one query for all phases across all proposals
  const allPhases = await db
    .select()
    .from(proposalPhases)
    .where(inArray(proposalPhases.proposalId, proposalIds))
    .orderBy(proposalPhases.sortOrder);

  // Batch: one query for all fee lines across all phases
  const phaseIds = allPhases.map(p => p.id);
  const allFeeLines = phaseIds.length > 0
    ? await db
        .select()
        .from(proposalFeeLines)
        .where(inArray(proposalFeeLines.phaseId, phaseIds))
        .orderBy(proposalFeeLines.sortOrder)
    : [];

  // Batch: one query for all additional line items across all proposals
  const allAdditionalLineItems = await db
    .select()
    .from(proposalAdditionalLineItems)
    .where(inArray(proposalAdditionalLineItems.proposalId, proposalIds))
    .orderBy(proposalAdditionalLineItems.sortOrder);

  // Assemble in memory — no further DB round-trips
  return rows.map(proposal => {
    const proposalPhasesList = allPhases.filter(ph => ph.proposalId === proposal.id);
    const phasesWithLines: ProposalPhaseWithLines[] = proposalPhasesList.map(phase => ({
      ...phase,
      feeLines: allFeeLines.filter(fl => fl.phaseId === phase.id),
    }));
    const additionalLineItems = allAdditionalLineItems.filter(ali => ali.proposalId === proposal.id);
    return { ...proposal, phases: phasesWithLines, additionalLineItems };
  });
}

export async function getProposalById(userId: string, proposalId: string): Promise<ProposalWithPhases | undefined> {
  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId));
  if (!proposal) return undefined;
  const owned = await verifyLeadOwnership(userId, proposal.leadId);
  if (!owned) return undefined;
  return buildProposalWithPhases(proposal);
}

export async function createProposal(
  userId: string,
  proposalData: InsertProposal,
  phases: ProposalPhaseInput[],
  additionalLineItemsInput?: AdditionalLineItemInput[]
): Promise<ProposalWithPhases> {
  const owned = await verifyLeadOwnership(userId, proposalData.leadId);
  if (!owned) throw new Error('Lead not found or access denied');

  return await db.transaction(async (tx) => {
    const [proposal] = await tx
      .insert(proposals)
      .values(toProposalDbValues(proposalData) as typeof proposals.$inferInsert)
      .returning();

    const phasesWithLines: ProposalPhaseWithLines[] = [];
    for (const phaseData of phases) {
      const [phase] = await tx
        .insert(proposalPhases)
        .values({ proposalId: proposal.id, name: phaseData.name, sortOrder: phaseData.sortOrder })
        .returning();
      const feeLineRows = phaseData.feeLines.filter(fl => fl.amount || fl.feeType === 'Hourly');
      let savedLines: ProposalFeeLine[] = [];
      if (feeLineRows.length > 0) {
        savedLines = await tx
          .insert(proposalFeeLines)
          .values(feeLineRows.map(fl => ({
            phaseId: phase.id,
            consultant: fl.consultant,
            feeType: fl.feeType,
            amount: fl.amount || null,
            sortOrder: fl.sortOrder,
          })))
          .returning();
      }
      phasesWithLines.push({ ...phase, feeLines: savedLines });
    }

    let savedAdditionalItems: ProposalAdditionalLineItem[] = [];
    if (additionalLineItemsInput && additionalLineItemsInput.length > 0) {
      savedAdditionalItems = await tx
        .insert(proposalAdditionalLineItems)
        .values(additionalLineItemsInput.map(item => ({
          proposalId: proposal.id,
          description: item.description,
          amount: item.amount || null,
          sortOrder: item.sortOrder,
        })))
        .returning();
    }

    return { ...proposal, phases: phasesWithLines, additionalLineItems: savedAdditionalItems };
  });
}

export async function updateProposal(
  userId: string,
  proposalId: string,
  updates: Partial<InsertProposal>,
  phases?: ProposalPhaseInput[],
  additionalLineItemsInput?: AdditionalLineItemInput[]
): Promise<ProposalWithPhases | undefined> {
  const existing = await getProposalById(userId, proposalId);
  if (!existing) return undefined;

  const { leadId: _leadId, id: _id, userId: _userId, ...safeUpdates } = updates as Record<string, unknown>;
  void _leadId; void _id; void _userId;

  const updated = await db.transaction(async (tx) => {
    const [updatedProposal] = await tx
      .update(proposals)
      .set({ ...toProposalDbValues(safeUpdates as Partial<InsertProposal>), updatedAt: sql`CURRENT_TIMESTAMP` } as Parameters<ReturnType<typeof tx.update>["set"]>[0])
      .where(eq(proposals.id, proposalId))
      .returning();

    if (phases !== undefined) {
      const existingPhaseIds = existing.phases.map(p => p.id);
      if (existingPhaseIds.length > 0) {
        await tx.delete(proposalFeeLines).where(inArray(proposalFeeLines.phaseId, existingPhaseIds));
      }
      await tx.delete(proposalPhases).where(eq(proposalPhases.proposalId, proposalId));
      for (const phaseData of phases) {
        const [phase] = await tx
          .insert(proposalPhases)
          .values({ proposalId, name: phaseData.name, sortOrder: phaseData.sortOrder })
          .returning();
        const feeLineRows = phaseData.feeLines.filter(fl => fl.amount || fl.feeType === 'Hourly');
        if (feeLineRows.length > 0) {
          await tx.insert(proposalFeeLines).values(
            feeLineRows.map(fl => ({
              phaseId: phase.id,
              consultant: fl.consultant,
              feeType: fl.feeType,
              amount: fl.amount || null,
              sortOrder: fl.sortOrder,
            }))
          );
        }
      }
    }

    if (additionalLineItemsInput !== undefined) {
      await tx.delete(proposalAdditionalLineItems).where(eq(proposalAdditionalLineItems.proposalId, proposalId));
      if (additionalLineItemsInput.length > 0) {
        await tx.insert(proposalAdditionalLineItems).values(
          additionalLineItemsInput.map(item => ({
            proposalId,
            description: item.description,
            amount: item.amount || null,
            sortOrder: item.sortOrder,
          }))
        );
      }
    }

    return updatedProposal;
  });

  return buildProposalWithPhases(updated);
}

export async function deleteProposal(userId: string, proposalId: string): Promise<boolean> {
  const existing = await getProposalById(userId, proposalId);
  if (!existing) return false;
  const result = await db.delete(proposals).where(eq(proposals.id, proposalId));
  return result.rowCount ? result.rowCount > 0 : false;
}

export async function signProposal(userId: string, proposalId: string): Promise<ProposalWithPhases | undefined> {
  const existing = await getProposalById(userId, proposalId);
  if (!existing) return undefined;

  const updated = await db.transaction(async (tx) => {
    const [updatedProposal] = await tx
      .update(proposals)
      .set({ status: 'Signed', dateSigned: sql`NOW()`, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(proposals.id, proposalId))
      .returning();

    if (existing.proposalType !== 'Additional Services') {
      await tx
        .update(leads)
        .set({ status: 'Active Project', updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(and(eq(leads.id, existing.leadId), eq(leads.userId, userId)));
    }

    return updatedProposal;
  });

  return buildProposalWithPhases(updated);
}

// ─── Billing summary ──────────────────────────────────────────────────────────

export async function getProposalBillingSummary(userId: string, proposalId: string): Promise<Record<string, number>> {
  const [proposal] = await db.select({ leadId: proposals.leadId }).from(proposals).where(eq(proposals.id, proposalId));
  if (!proposal) return {};
  const owned = await verifyLeadOwnership(userId, proposal.leadId);
  if (!owned) return {};

  const allInvoices = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.proposalId, proposalId));
  if (allInvoices.length === 0) return {};

  const allInvoiceIds = allInvoices.map(i => i.id);
  const snapshots = await db
    .select({ proposalFeeLineId: invoiceFeeLineSnapshots.proposalFeeLineId, currentBilling: invoiceFeeLineSnapshots.currentBilling })
    .from(invoiceFeeLineSnapshots)
    .where(inArray(invoiceFeeLineSnapshots.invoiceId, allInvoiceIds));

  const summary: Record<string, number> = {};
  for (const snap of snapshots) {
    const billed = parseFloat(snap.currentBilling || '0');
    summary[snap.proposalFeeLineId] = (summary[snap.proposalFeeLineId] || 0) + billed;
  }
  return summary;
}

// ─── Consultant Contracts ─────────────────────────────────────────────────────

export async function getConsultantContracts(proposalId: string): Promise<ConsultantContract[]> {
  return db.select().from(consultantContracts).where(eq(consultantContracts.proposalId, proposalId));
}

export async function upsertConsultantContract(proposalId: string, consultant: string, docUrl: string): Promise<ConsultantContract> {
  const existing = await db
    .select()
    .from(consultantContracts)
    .where(and(eq(consultantContracts.proposalId, proposalId), eq(consultantContracts.consultant, consultant)));

  if (existing.length > 0) {
    const [updated] = await db
      .update(consultantContracts)
      .set({ docUrl, generatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(consultantContracts.id, existing[0].id))
      .returning();
    return updated;
  }
  const [created] = await db.insert(consultantContracts).values({ proposalId, consultant, docUrl }).returning();
  return created;
}
