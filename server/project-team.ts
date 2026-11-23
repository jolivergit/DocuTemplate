import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { context, AccessError, addressPredicate } from "./workspace-context";
import { leads, workspaces, workspaceMembers, projectAssignments, users, companies, contacts, contactCompanies } from "@shared/schema";
import { teamInput, type ProjectTeam, type ProjectSetupOptions } from "@shared/project-setup";

export type ProjectTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// All team/membership writes take the workspace lock before any project lock.
// Re-read the actor: request context is not proof a role survived a concurrent change.
export async function accessProject(tx: ProjectTx, leadId: number, manage = false) {
  const c = context();
  await tx.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, c.workspaceId)).for("update");
  const [actor] = await tx.select().from(workspaceMembers).where(and(
    eq(workspaceMembers.workspaceId, c.workspaceId), eq(workspaceMembers.userId, c.userId),
  ));
  if (!actor) throw new AccessError("Your firm access changed.");
  const [lead] = await tx.select().from(leads).where(and(eq(leads.id, leadId), eq(leads.workspaceId, c.workspaceId))).for("update");
  if (!lead) throw new AccessError("Project not found.", 404);
  const assignments = await tx.select().from(projectAssignments).where(eq(projectAssignments.leadId, leadId));
  const own = assignments.find(a => a.memberId === actor.id);
  if (actor.role !== "Owner" && !own) throw new AccessError("Project not found.", 404);
  const canManage = actor.role === "Owner" || !!own?.roles.includes("Project Admin");
  if (manage && !canManage) throw new AccessError("A Project Admin or firm Owner must manage the project team.");
  return { lead, actor, assignments, canManage };
}

async function teamView(tx: ProjectTx, access: Awaited<ReturnType<typeof accessProject>>): Promise<ProjectTeam> {
  const rows = await tx.select({
    memberId: workspaceMembers.id, userId: users.id, name: users.name, email: users.email, firmRole: workspaceMembers.role,
  }).from(workspaceMembers).innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, context().workspaceId)).orderBy(users.name, users.id);
  return {
    version: access.lead.teamVersion, canManage: access.canManage,
    hasAdmin: access.assignments.some(a => a.roles.includes("Project Admin") && rows.some(m => m.memberId === a.memberId)),
    members: rows.filter(m => access.canManage || access.assignments.some(a => a.memberId === m.memberId)).map(m => {
      const assignment = access.assignments.find(a => a.memberId === m.memberId);
      return {
        userId: m.userId, name: m.name, ...(access.canManage ? { email: m.email } : {}),
        firmRole: m.firmRole, assigned: !!assignment, roles: assignment?.roles ?? [],
      };
    }),
  };
}

export async function getProjectTeam(leadId: number) {
  return db.transaction(async tx => teamView(tx, await accessProject(tx, leadId)));
}

export async function saveProjectTeam(leadId: number, input: unknown) {
  const data = teamInput.parse(input);
  return db.transaction(async tx => {
    const access = await accessProject(tx, leadId, true);
    const current = await teamView(tx, access);
    if (data.members.some(m => !current.members.some(c => c.userId === m.userId))) {
      throw new AccessError("Choose active teammates from this firm.", 400);
    }
    const selected = data.members.filter(m => m.assigned);
    const fingerprint = (members: typeof selected) => JSON.stringify(members.filter(m => m.assigned)
      .map(m => ({ userId: m.userId, roles: [...m.roles].sort() })).sort((a, b) => a.userId.localeCompare(b.userId)));
    // Safe retry of a successful whole-roster save, even if its response was lost.
    if (fingerprint(selected) === fingerprint(current.members)) return current;
    if (data.version !== current.version) throw new AccessError("The team changed elsewhere. Your draft is preserved; reload the latest team before saving.", 409);
    const hasAdmin = selected.some(m => m.roles.includes("Project Admin"));
    if (!hasAdmin && (current.hasAdmin || access.lead.setupComplete)) {
      throw new AccessError("Keep at least one Project Admin. Assign a replacement before removing the last one.", 409);
    }
    const members = await tx.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, context().workspaceId));
    const selectedIds = selected.map(m => members.find(row => row.userId === m.userId)!.id);
    const removed = access.assignments.filter(a => !selectedIds.includes(a.memberId));
    if (removed.length) await tx.delete(projectAssignments).where(inArray(projectAssignments.id, removed.map(a => a.id)));
    for (const member of selected) {
      const memberId = members.find(m => m.userId === member.userId)!.id;
      await tx.insert(projectAssignments).values({ leadId, memberId, roles: member.roles })
        .onConflictDoUpdate({ target: [projectAssignments.leadId, projectAssignments.memberId], set: { roles: member.roles } });
    }
    const [lead] = await tx.update(leads).set({ teamVersion: sql`${leads.teamVersion}+1` }).where(eq(leads.id, leadId)).returning();
    await tx.update(workspaces).set({ revision: sql`${workspaces.revision}+1` }).where(eq(workspaces.id, context().workspaceId));
    const assignments = await tx.select().from(projectAssignments).where(eq(projectAssignments.leadId, leadId));
    const own = assignments.find(a => a.memberId === access.actor.id);
    if (access.actor.role !== "Owner" && !own) return { version: lead.teamVersion, canManage: false, hasAdmin, members: [] };
    return teamView(tx, { ...access, lead, assignments, canManage: access.actor.role === "Owner" || !!own?.roles.includes("Project Admin") });
  });
}

export async function projectSetupOptions(leadId: number): Promise<ProjectSetupOptions> {
  return db.transaction(async tx => {
    const access = await accessProject(tx, leadId);
    const c = context();
    const companyRows = await tx.select().from(companies).where(access.canManage
      ? eq(companies.workspaceId, c.workspaceId) : addressPredicate(c.userId, "company", access.actor));
    const contactRows = await tx.select().from(contacts).where(access.canManage
      ? eq(contacts.workspaceId, c.workspaceId) : addressPredicate(c.userId, "contact", access.actor));
    const links = companyRows.length && contactRows.length ? await tx.select().from(contactCompanies).where(and(
      inArray(contactCompanies.companyId, companyRows.map(r => r.id)), inArray(contactCompanies.contactId, contactRows.map(r => r.id)),
    )) : [];
    return {
      companies: companyRows.map(co => ({ ...co, contacts: contactRows.filter(ct => links.some(l => l.companyId === co.id && l.contactId === ct.id)) })),
      contacts: contactRows.map(ct => ({ ...ct, companies: companyRows.filter(co => links.some(l => l.companyId === co.id && l.contactId === ct.id)) })),
    };
  });
}
