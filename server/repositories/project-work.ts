import { and, eq, inArray, sql } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { db } from "../db";
import { context, projectPredicate, AccessError } from "../workspace-context";
import {
  leads, users, workspaceMembers, projectAssignments, projectPhases, projectPhaseFees,
  projectTasks, projectTaskNotes, projectWorkSetup, proposals, proposalPhases, proposalFeeLines,
} from "@shared/schema";
import { phaseInput, phasePatch, taskInput, taskPatch, entryInput, entryCreate, entryPatch, type EntryInput, type WorkEntry, type ProjectWork, type WorkPhase } from "@shared/project-work";
import { accessProject } from "../project-team";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function lockProject(tx: Tx, leadId: number) {
  // Same lock order as team/offboarding writes; never trust an older request's role.
  return (await accessProject(tx, leadId)).lead;
}
export async function eligibleAssignees(tx: Tx, leadId: number) {
  return tx.select({ userId: users.id, name: users.name }).from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(and(eq(workspaceMembers.workspaceId, context().workspaceId),
      sql`(${workspaceMembers.role} = 'Owner' OR EXISTS (
        SELECT 1 FROM ${projectAssignments} WHERE ${projectAssignments.memberId} = ${workspaceMembers.id}
        AND ${projectAssignments.leadId} = ${leadId}))`));
}
export async function readPhases(tx: Tx, leadId: number): Promise<WorkPhase[]> {
  const phases = await tx.select().from(projectPhases).where(eq(projectPhases.leadId, leadId)).orderBy(projectPhases.sortOrder, projectPhases.id);
  const fees = phases.length ? await tx.select().from(projectPhaseFees)
    .where(inArray(projectPhaseFees.phaseId, phases.map(p => p.id))).orderBy(projectPhaseFees.sortOrder) : [];
  return phases.map(p => ({ ...p, feeLines: fees.filter(f => f.phaseId === p.id) as WorkPhase["feeLines"] }));
}
export async function legacySources(tx: Tx, leadId: number) {
  const rows = await tx.select().from(proposals).where(and(eq(proposals.leadId, leadId), eq(proposals.proposalType, "Standard"))).orderBy(proposals.createdAt);
  const result: ProjectWork["legacySources"] = [];
  for (const row of rows) {
    const phases = await tx.select({
      name: proposalPhases.name,
      total: sql<string>`coalesce(sum(case when ${proposalFeeLines.feeType}='Fixed' then ${proposalFeeLines.amount} else 0 end),0)::text`,
    }).from(proposalPhases).leftJoin(proposalFeeLines, eq(proposalFeeLines.phaseId, proposalPhases.id))
      .where(eq(proposalPhases.proposalId, row.id)).groupBy(proposalPhases.id).orderBy(proposalPhases.sortOrder);
    if (phases.length) result.push({ id: row.id, name: row.name, status: row.status, phases });
  }
  return result;
}
export async function ensureWorkReady(tx: Tx, leadId: number) {
  if ((await tx.select().from(projectWorkSetup).where(eq(projectWorkSetup.leadId, leadId))).length) return;
  if ((await legacySources(tx, leadId)).length) {
    throw new AccessError("Choose the existing proposal data to use for shared project phases first.", 409);
  }
  await tx.insert(projectWorkSetup).values({ leadId }).onConflictDoNothing();
}
export async function getProjectWork(leadId: number) {
  return db.transaction(async tx => {
    await lockProject(tx, leadId);
    const phases = await readPhases(tx, leadId);
    const assignees = await eligibleAssignees(tx, leadId);
    const tasks = await tx.select({
      task: projectTasks,
      assigneeName: users.name,
      noteCount: sql<number>`(select count(*)::int from ${projectTaskNotes} where ${projectTaskNotes.taskId}=${projectTasks.id})`,
    }).from(projectTasks).leftJoin(users, eq(users.id, projectTasks.assigneeId))
      .where(eq(projectTasks.leadId, leadId)).orderBy(projectTasks.createdAt, projectTasks.id);
    const setup = await tx.select().from(projectWorkSetup).where(eq(projectWorkSetup.leadId, leadId));
    const sources = setup.length ? [] : await legacySources(tx, leadId);
    const entries = tasks.map(({ task, assigneeName, noteCount }) => entryView(task, assigneeName, assignees, noteCount));
    return {
      phases, assignees, needsReconciliation: sources.length > 0, legacySources: sources,
      entries: entries.slice().reverse(),
      tasks: entries.filter(entry => entry.entryType === "Task"),
    };
  });
}
export async function reconcileProject(leadId: number, proposalId: string | null) {
  return db.transaction(async tx => {
    await lockProject(tx, leadId);
    const [setup] = await tx.select().from(projectWorkSetup).where(eq(projectWorkSetup.leadId, leadId));
    if (setup) {
      if (setup.sourceProposalId !== proposalId) throw new AccessError("Project phases were already initialized. Refresh the project.", 409);
      return { success: true };
    }
    if (proposalId) {
      const sources = await legacySources(tx, leadId);
      if (!sources.some(s => s.id === proposalId)) throw new AccessError("Select a proposal from this project.", 400);
      const phases = await tx.select().from(proposalPhases).where(eq(proposalPhases.proposalId, proposalId)).orderBy(proposalPhases.sortOrder);
      for (const source of phases) {
        const [phase] = await tx.insert(projectPhases).values({
          leadId, name: source.name, sortOrder: source.sortOrder, timeline: source.timeline,
        }).returning();
        const fees = await tx.select().from(proposalFeeLines).where(eq(proposalFeeLines.phaseId, source.id));
        if (fees.length) await tx.insert(projectPhaseFees).values(fees.map(f => ({
          phaseId: phase.id, consultant: f.consultant, feeType: f.feeType, amount: f.amount, sortOrder: f.sortOrder,
        })));
        // Only a reference is added to the issued record; financial values stay untouched.
        await tx.update(proposalPhases).set({ projectPhaseId: phase.id }).where(eq(proposalPhases.id, source.id));
      }
    }
    await tx.insert(projectWorkSetup).values({ leadId, sourceProposalId: proposalId });
    return { success: true };
  });
}
export async function savePhase(leadId: number, id: string | undefined, input: unknown) {
  const data = id ? phasePatch.parse(input) : phaseInput.parse(input);
  return db.transaction(async tx => {
    await lockProject(tx, leadId);
    await ensureWorkReady(tx, leadId);
    let phaseId = id;
    const { feeLines, ...values } = data;
    if (id) {
      const patch = values as Omit<ReturnType<typeof phasePatch.parse>, "feeLines">;
      const { version, ...updates } = patch;
      const [row] = await tx.update(projectPhases).set({ ...updates, version: sql`${projectPhases.version}+1` })
        .where(and(eq(projectPhases.id, id), eq(projectPhases.leadId, leadId), eq(projectPhases.version, version))).returning();
      if (!row) throw new AccessError("This phase changed or is unavailable. Reload before saving again.", 409);
    } else {
      const [last] = await tx.select({ count: sql<number>`coalesce(max(${projectPhases.sortOrder}),-1)+1` }).from(projectPhases).where(eq(projectPhases.leadId, leadId));
      const [row] = await tx.insert(projectPhases).values({ ...values, leadId, name: (data as ReturnType<typeof phaseInput.parse>).name, sortOrder: Number(last.count) }).returning();
      phaseId = row.id;
    }
    if (feeLines !== undefined) {
      await tx.delete(projectPhaseFees).where(eq(projectPhaseFees.phaseId, phaseId!));
      if (feeLines.length) await tx.insert(projectPhaseFees).values(feeLines.map((f, sortOrder) => ({ ...f, phaseId: phaseId!, sortOrder })));
    }
    return (await readPhases(tx, leadId)).find(p => p.id === phaseId)!;
  });
}
export async function reorderPhases(leadId: number, ordered: { id: string; version: number }[]) {
  return db.transaction(async tx => {
    await lockProject(tx, leadId);
    const current = await tx.select().from(projectPhases).where(eq(projectPhases.leadId, leadId));
    if (ordered.length !== current.length || new Set(ordered.map(p => p.id)).size !== current.length
      || ordered.some(p => !current.some(c => c.id === p.id && c.version === p.version))) {
      throw new AccessError("The phase list changed. Reload before reordering.", 409);
    }
    for (let sortOrder = 0; sortOrder < ordered.length; sortOrder++) {
      await tx.update(projectPhases).set({ sortOrder, version: sql`${projectPhases.version}+1` })
        .where(and(eq(projectPhases.id, ordered[sortOrder].id), eq(projectPhases.leadId, leadId)));
    }
    return readPhases(tx, leadId);
  });
}
export async function saveTask(leadId: number, id: string | undefined, input: unknown) {
  // Old task clients remain task-only. They cannot mutate or read another kind.
  if (id) return saveEntry(leadId, id, taskPatch.parse(input), true);
  const { requestId, ...data } = taskInput.extend({ requestId: entryCreate.shape.requestId.optional() }).parse(input);
  return saveEntry(leadId, undefined, { requestId: requestId ?? randomUUID(), entry: { entryType: "Task", ...data } }, true);
}

function entryFields(row: typeof projectTasks.$inferSelect): EntryInput {
  return {
    entryType: row.entryType, title: row.title, description: row.description,
    phaseId: row.phaseId, assigneeId: row.assigneeId, priority: row.priority,
    status: row.status, dueDate: row.dueDate, meetingDate: row.meetingDate, meetingTime: row.meetingTime,
  } as EntryInput;
}
function entryView(row: typeof projectTasks.$inferSelect, assigneeName: string | null, assignees: { userId: string }[], noteCount: number): WorkEntry {
  const { leadId: _lead, creationFingerprint: _fingerprint, ...entry } = row;
  return {
    ...entry, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), assigneeName, noteCount,
    assigneeEligible: !row.assigneeId || assignees.some(person => person.userId === row.assigneeId),
  } as WorkEntry;
}
async function savedEntryView(tx: Tx, row: typeof projectTasks.$inferSelect) {
  const assignees = await eligibleAssignees(tx, row.leadId);
  const [person] = row.assigneeId ? await tx.select({ name: users.name }).from(users).where(eq(users.id, row.assigneeId)) : [];
  const [notes] = await tx.select({ count: sql<number>`count(*)::int` }).from(projectTaskNotes).where(eq(projectTaskNotes.taskId, row.id));
  return entryView(row, person?.name ?? null, assignees, notes.count);
}
export async function saveEntry(leadId: number, id: string | undefined, input: unknown, taskOnly = false) {
  const creation = id ? undefined : entryCreate.parse(input);
  const patch = id ? entryPatch.parse(input) : undefined;
  return db.transaction(async tx => {
    await lockProject(tx, leadId);
    let existing: typeof projectTasks.$inferSelect | undefined;
    if (id) {
      [existing] = await tx.select().from(projectTasks).where(and(eq(projectTasks.id, id), eq(projectTasks.leadId, leadId)));
      if (!existing || taskOnly && existing.entryType !== "Task") throw new AccessError("Entry not found.", 404);
      if (existing.version !== patch!.version) throw new AccessError("This entry changed. Your draft is preserved; reload the latest version before saving.", 409);
    }
    const { version: _version, archived: _archived, ...updates } = patch ?? {};
    const data = creation?.entry ?? entryInput.parse({ ...entryFields(existing!), ...updates });
    if (creation) {
      const [previous] = await tx.select().from(projectTasks).where(and(
        eq(projectTasks.leadId, leadId), eq(projectTasks.creationRequestId, creation.requestId),
      ));
      if (previous) {
        const fingerprint = createHash("sha256").update(JSON.stringify(data)).digest("hex");
        if (previous.authorId !== context().userId || previous.creationFingerprint !== fingerprint)
          throw new AccessError("This save request already created an entry. Reload the log and review it before starting another.", 409);
        return savedEntryView(tx, previous);
      }
    }
    if (data.phaseId && data.phaseId !== existing?.phaseId) {
      const [phase] = await tx.select().from(projectPhases).where(and(eq(projectPhases.id, data.phaseId), eq(projectPhases.leadId, leadId), eq(projectPhases.archived, false)));
      if (!phase) throw new AccessError("Choose an active phase from this project.", 400);
    }
    if (data.assigneeId && (data.assigneeId !== existing?.assigneeId)) {
      if (!(await eligibleAssignees(tx, leadId)).some(a => a.userId === data.assigneeId)) {
        throw new AccessError("That person does not currently have access to this project.", 400);
      }
    }
    if (id) {
      const [row] = await tx.update(projectTasks).set({ ...data, ...(patch!.archived !== undefined ? { archived: patch!.archived } : {}), version: sql`${projectTasks.version}+1`, updatedAt: new Date() })
        .where(and(eq(projectTasks.id, id), eq(projectTasks.leadId, leadId), eq(projectTasks.version, patch!.version))).returning();
      if (!row) throw new AccessError("This entry changed. Your draft is preserved; reload the latest version before saving.", 409);
      return savedEntryView(tx, row);
    }
    const [author] = await tx.select({ name: users.name }).from(users).where(eq(users.id, context().userId));
    const [row] = await tx.insert(projectTasks).values({
      ...data, leadId, authorId: context().userId, authorName: author.name,
      creationRequestId: creation!.requestId, creationFingerprint: createHash("sha256").update(JSON.stringify(data)).digest("hex"),
    }).returning();
    return savedEntryView(tx, row);
  });
}
export async function taskNotes(leadId: number, taskId: string, note?: { content: string; requestId: string }) {
  return entryNotes(leadId, taskId, note, true);
}
export async function entryNotes(leadId: number, taskId: string, note?: { content: string; requestId: string }, taskOnly = false) {
  return db.transaction(async tx => {
    await lockProject(tx, leadId);
    const [task] = await tx.select().from(projectTasks).where(and(eq(projectTasks.id, taskId), eq(projectTasks.leadId, leadId)));
    if (!task || taskOnly && task.entryType !== "Task") throw new AccessError("Entry not found.", 404);
    if (note) {
      const [author] = await tx.select({ name: users.name }).from(users).where(eq(users.id, context().userId));
      const [previous] = await tx.select().from(projectTaskNotes)
        .where(and(eq(projectTaskNotes.taskId, taskId), eq(projectTaskNotes.requestId, note.requestId)));
      if (previous && (previous.content !== note.content || previous.authorId !== context().userId)) throw new AccessError("This note request has already been used.", 409);
      if (!previous) await tx.insert(projectTaskNotes).values({ ...note, taskId, authorId: context().userId, authorName: author.name });
    }
    return tx.select({ id: projectTaskNotes.id, content: projectTaskNotes.content, authorName: projectTaskNotes.authorName, createdAt: projectTaskNotes.createdAt })
      .from(projectTaskNotes).where(eq(projectTaskNotes.taskId, taskId)).orderBy(projectTaskNotes.createdAt, projectTaskNotes.id);
  });
}
