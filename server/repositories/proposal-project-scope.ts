import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { proposals, proposalPhases, proposalFeeLines, invoices, consultantContracts, type Proposal } from "@shared/schema";
import { AccessError } from "../workspace-context";
import { ensureWorkReady, lockProject, readPhases } from "./project-work";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function proposalScopeLocked(tx: Tx, proposal: Proposal) {
  if (!["Draft", "Revision"].includes(proposal.status)) return true;
  // Legacy versions allowed status reversals. Existing billing/contracts are
  // stronger evidence of issued scope than the current status label.
  const [row] = await tx.select({ locked: sql<boolean>`(
    exists(select 1 from ${invoices} where ${invoices.proposalId}=${proposal.id})
    or exists(select 1 from ${consultantContracts} where ${consultantContracts.proposalId}=${proposal.id})
  )` }).from(proposals).where(eq(proposals.id, proposal.id));
  return row?.locked === true;
}

// Proposal-owned rows are financial snapshots, never the project work identities.
// Issued records are immutable here: make a new draft instead.
export async function refreshProposalScope(tx: Tx, proposalId: string, selectedIds?: string[]) {
  const [proposal] = await tx.select().from(proposals).where(eq(proposals.id, proposalId)).for("update");
  if (!proposal) throw new AccessError("Proposal not found.", 404);
  await lockProject(tx, proposal.leadId);
  if (proposal.proposalType !== "Standard") return;
  if (await proposalScopeLocked(tx, proposal)) throw new AccessError("Issued or previously billed proposal scope is preserved. Create a new draft to use current project fees.", 409);
  await ensureWorkReady(tx, proposal.leadId);
  const phases = await readPhases(tx, proposal.leadId);
  const old = await tx.select().from(proposalPhases).where(eq(proposalPhases.proposalId, proposalId));
  if (selectedIds === undefined && old.some(p => !p.projectPhaseId)) {
    throw new AccessError("Choose this document's shared project phases explicitly before refreshing or issuing it.", 409);
  }
  // Empty is a real recorded selection. Never infer newly priced phases.
  const selected = selectedIds ?? old.map(p => p.projectPhaseId).filter((id): id is string => !!id);
  const unique = Array.from(new Set(selected));
  const current = unique.map(id => {
    const phase = phases.find(p => p.id === id);
    if (!phase || (phase.archived && !old.some(p => p.projectPhaseId === id))) throw new AccessError("Choose active phases from this project.", 400);
    return phase;
  });
  const keep = new Set(current.map(p => p.id));
  const removed = old.filter(p => !p.projectPhaseId || !keep.has(p.projectPhaseId));
  if (removed.length) await tx.delete(proposalPhases).where(inArray(proposalPhases.id, removed.map(p => p.id)));
  for (let sortOrder = 0; sortOrder < current.length; sortOrder++) {
    const source = current[sortOrder];
    const existing = old.find(p => p.projectPhaseId === source.id);
    let phaseId: string;
    if (existing) {
      phaseId = existing.id;
      await tx.update(proposalPhases).set({ name: source.name, timeline: source.timeline, sortOrder }).where(eq(proposalPhases.id, phaseId));
    } else {
      const [row] = await tx.insert(proposalPhases).values({
        proposalId, projectPhaseId: source.id, name: source.name, timeline: source.timeline, sortOrder,
      }).returning();
      phaseId = row.id;
    }
    const oldFees = await tx.select().from(proposalFeeLines).where(eq(proposalFeeLines.phaseId, phaseId));
    const retained: string[] = [];
    for (const fee of source.feeLines) {
      const match = oldFees.find(f => !retained.includes(f.id) && f.consultant === fee.consultant && f.feeType === fee.feeType);
      const values = { consultant: fee.consultant, feeType: fee.feeType, amount: fee.amount, sortOrder: fee.sortOrder };
      if (match) {
        await tx.update(proposalFeeLines).set(values).where(eq(proposalFeeLines.id, match.id));
        retained.push(match.id);
      } else {
        const [row] = await tx.insert(proposalFeeLines).values({ ...values, phaseId }).returning();
        retained.push(row.id);
      }
    }
    const stale = oldFees.filter(f => !retained.includes(f.id));
    if (stale.length) await tx.delete(proposalFeeLines).where(inArray(proposalFeeLines.id, stale.map(f => f.id)));
  }
}

export async function explicitlyRefreshProposal(proposalId: string, selectedIds?: string[]) {
  await db.transaction(async tx => {
    // Lock project first consistently with phase/task writes.
    const [row] = await tx.select({ leadId: proposals.leadId }).from(proposals).where(eq(proposals.id, proposalId));
    if (!row) throw new AccessError("Proposal not found.", 404);
    await lockProject(tx, row.leadId);
    await refreshProposalScope(tx, proposalId, selectedIds);
  });
}
