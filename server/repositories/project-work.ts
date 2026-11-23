import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { context, projectPredicate, AccessError } from "../workspace-context";
import {
  leads, users, workspaceMembers, projectAssignments, projectPhases, projectPhaseFees,
  projectTasks, projectTaskNotes, projectWorkSetup, proposals, proposalPhases, proposalFeeLines,
} from "@shared/schema";
import { phaseInput, phasePatch, taskInput, taskPatch, type ProjectWork, type WorkPhase } from "@shared/project-work";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function lockProject(tx: Tx, leadId: number) {
  const c = context();
  const [project] = await tx.select().from(leads).where(and(eq(leads.id, leadId), projectPredicate(c.userId))).for("update");
  if (!project) throw new AccessError("Project not found or access denied.", 404);
  return project;
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
    return {
      phases, assignees, needsReconciliation: sources.length > 0, legacySources: sources,
      tasks: tasks.map(({ task, assigneeName, noteCount }) => ({
        ...task, assigneeName, noteCount,
        assigneeEligible: !task.assigneeId || assignees.some(a => a.userId === task.assigneeId),
      })),
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
  const data = id ? taskPatch.parse(input) : taskInput.parse(input);
  return db.transaction(async tx => {
    await lockProject(tx, leadId);
    let existing: typeof projectTasks.$inferSelect | undefined;
    if (id) {
      [existing] = await tx.select().from(projectTasks).where(and(eq(projectTasks.id, id), eq(projectTasks.leadId, leadId)));
      if (!existing) throw new AccessError("Task not found.", 404);
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
      const { version, ...updates } = data as ReturnType<typeof taskPatch.parse>;
      const [row] = await tx.update(projectTasks).set({ ...updates, version: sql`${projectTasks.version}+1`, updatedAt: new Date() })
        .where(and(eq(projectTasks.id, id), eq(projectTasks.leadId, leadId), eq(projectTasks.version, version))).returning();
      if (!row) throw new AccessError("This task changed. Reload before saving again; your draft has not been saved.", 409);
      return row;
    }
    const [row] = await tx.insert(projectTasks).values({ ...data as ReturnType<typeof taskInput.parse>, leadId }).returning();
    return row;
  });
}
export async function taskNotes(leadId: number, taskId: string, note?: { content: string; requestId: string }) {
  return db.transaction(async tx => {
    await lockProject(tx, leadId);
    const [task] = await tx.select().from(projectTasks).where(and(eq(projectTasks.id, taskId), eq(projectTasks.leadId, leadId)));
    if (!task) throw new AccessError("Task not found.", 404);
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
