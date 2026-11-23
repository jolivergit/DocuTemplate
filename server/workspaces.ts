import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { workspaces, workspaceMembers, workspaceInvitations, projectAssignments, users, leads, type User } from "@shared/schema";
import { context, ownerOnly, AccessError, type WorkspaceContext } from "./workspace-context";
import { getProjectTeam, saveProjectTeam } from "./project-team";

export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// Called only for accounts with no personal workspace, never for a lost membership.
export async function ensurePersonalWorkspace(user: Pick<User, "id" | "name">) {
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${user.id}))`);
    const [existing] = await tx.select().from(workspaces).where(eq(workspaces.legacyOwnerId, user.id));
    if (existing) return existing;
    const [workspace] = await tx.insert(workspaces).values({
      name: `${user.name}'s workspace`, legacyOwnerId: user.id,
    }).returning();
    await tx.insert(workspaceMembers).values({ workspaceId: workspace.id, userId: user.id, role: "Owner" });
    return workspace;
  });
}

export async function memberships(userId: string) {
  return db.select({
    id: workspaces.id, name: workspaces.name, role: workspaceMembers.role,
    memberId: workspaceMembers.id, revision: workspaces.revision,
  }).from(workspaceMembers).innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId)).orderBy(workspaces.name);
}

// Creation is independent of the actor's role in whichever firm is currently open.
// Keep the intent key after uncertain responses so retrying cannot create a second firm.
export async function createWorkspace(userId: string, name: string, requestId: string) {
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`create-workspace:${userId}:${requestId}`}))`);
    const [existing] = await tx.select().from(workspaces).where(and(
      eq(workspaces.createdById, userId), eq(workspaces.creationRequestId, requestId),
    ));
    if (existing) {
      if (existing.creationName !== name) throw new AccessError("This creation request was already used for a different firm name.", 409);
      const [membership] = await tx.select().from(workspaceMembers).where(and(
        eq(workspaceMembers.workspaceId, existing.id), eq(workspaceMembers.userId, userId),
      ));
      if (!membership) throw new AccessError("This firm was already created, but you no longer have access to it.");
      return { id: existing.id, name: existing.name, revision: existing.revision, role: membership.role };
    }
    const [workspace] = await tx.insert(workspaces).values({
      name, createdById: userId, creationRequestId: requestId, creationName: name,
    }).returning();
    await tx.insert(workspaceMembers).values({ workspaceId: workspace.id, userId, role: "Owner" });
    return { id: workspace.id, name: workspace.name, revision: workspace.revision, role: "Owner" as const };
  });
}

export async function resolveWorkspace(user: User, requested?: string): Promise<WorkspaceContext> {
  const personal = await ensurePersonalWorkspace(user);
  const list = await memberships(user.id);
  const target = requested || (list.some(m => m.id === personal.id) ? personal.id : list[0]?.id);
  const member = list.find(m => m.id === target);
  if (!member) throw new AccessError("You no longer have access to this workspace.");
  return { userId: user.id, workspaceId: target, memberId: member.memberId, role: member.role };
}

export async function bumpRevision(tx: typeof db, workspaceId: string) {
  await tx.update(workspaces).set({ revision: sql`${workspaces.revision} + 1` }).where(eq(workspaces.id, workspaceId));
}

export async function team() {
  ownerOnly();
  const c = context();
  const [workspace] = await db.select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces).where(eq(workspaces.id, c.workspaceId));
  const members = await db.select({ userId: users.id, name: users.name, email: users.email, role: workspaceMembers.role })
    .from(workspaceMembers).innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, c.workspaceId));
  const invitations = await db.select({ id: workspaceInvitations.id, email: workspaceInvitations.email, expiresAt: workspaceInvitations.expiresAt })
    .from(workspaceInvitations).where(and(eq(workspaceInvitations.workspaceId, c.workspaceId),
      isNull(workspaceInvitations.consumedAt), gt(workspaceInvitations.expiresAt, new Date())));
  return { workspace, members, invitations };
}

export async function invite(email: string) {
  ownerOnly();
  const c = context();
  const token = randomBytes(32).toString("base64url");
  return db.transaction(async tx => {
    await tx.update(workspaceInvitations).set({ consumedAt: new Date() }).where(and(
      eq(workspaceInvitations.workspaceId, c.workspaceId), eq(workspaceInvitations.email, email),
      isNull(workspaceInvitations.consumedAt)));
    const [invitation] = await tx.insert(workspaceInvitations).values({
      workspaceId: c.workspaceId, email, tokenHash: tokenHash(token),
      expiresAt: new Date(Date.now() + 7 * 86400_000),
    }).returning({ id: workspaceInvitations.id, email: workspaceInvitations.email, expiresAt: workspaceInvitations.expiresAt });
    return { invitation, token };
  });
}

export async function acceptInvitation(user: User, token: string) {
  if (!user.emailVerified) throw new AccessError("Sign out and sign in with Google to verify your email before accepting an invitation.");
  return db.transaction(async tx => {
    const [invitation] = await tx.select().from(workspaceInvitations)
      .where(eq(workspaceInvitations.tokenHash, tokenHash(token))).for("update");
    if (!invitation || invitation.consumedAt || invitation.expiresAt <= new Date()) {
      throw new AccessError("This invitation is invalid, expired, or already used.", 400);
    }
    if (invitation.email !== user.email.trim().toLowerCase()) {
      throw new AccessError("Sign in with the Google account this invitation was sent to.");
    }
    // Lock workspace as well as invitation so removal/acceptance serializes.
    await tx.select().from(workspaces).where(eq(workspaces.id, invitation.workspaceId)).for("update");
    await tx.insert(workspaceMembers).values({ workspaceId: invitation.workspaceId, userId: user.id, role: "Member" }).onConflictDoNothing();
    await tx.update(workspaceInvitations).set({ consumedAt: new Date() }).where(eq(workspaceInvitations.id, invitation.id));
    await tx.update(workspaces).set({ revision: sql`${workspaces.revision} + 1` }).where(eq(workspaces.id, invitation.workspaceId));
    return { workspaceId: invitation.workspaceId };
  });
}

export async function changeMember(userId: string, role?: "Owner" | "Member") {
  ownerOnly();
  const c = context();
  return db.transaction(async tx => {
    await tx.select().from(workspaces).where(eq(workspaces.id, c.workspaceId)).for("update");
    const all = await tx.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, c.workspaceId));
    // Recheck actor after lock: an earlier request might have removed their role.
    if (!all.some(m => m.userId === c.userId && m.role === "Owner")) throw new AccessError();
    const target = all.find(m => m.userId === userId);
    if (!target) throw new AccessError("Member not found.", 404);
    if (target.role === "Owner" && role !== "Owner" && all.filter(m => m.role === "Owner").length === 1) {
      throw new AccessError("Keep at least one company owner.");
    }
    if (role) await tx.update(workspaceMembers).set({ role }).where(eq(workspaceMembers.id, target.id));
    else {
      const stranded = await tx.select({ name: leads.projectName }).from(projectAssignments)
        .innerJoin(leads, eq(leads.id, projectAssignments.leadId))
        .where(and(eq(projectAssignments.memberId, target.id), eq(leads.workspaceId, c.workspaceId),
          sql`${projectAssignments.roles} @> '["Project Admin"]'::jsonb`,
          sql`not exists(select 1 from project_assignments other
            inner join workspace_members wm on wm.id=other.member_id
            where other.lead_id=${leads.id} and other.member_id<>${target.id}
            and wm.workspace_id=${c.workspaceId} and other.roles @> '["Project Admin"]'::jsonb)`));
      if (stranded.length) throw new AccessError("Assign another Project Admin on their projects before removing this teammate.", 409);
      await tx.delete(workspaceMembers).where(eq(workspaceMembers.id, target.id));
      // Old unused invitations must not restore removed access.
      const [targetUser] = await tx.select({ email: users.email }).from(users).where(eq(users.id, userId));
      if (targetUser) await tx.update(workspaceInvitations).set({ consumedAt: new Date() }).where(and(
        eq(workspaceInvitations.workspaceId, c.workspaceId),
        eq(workspaceInvitations.email, targetUser.email.trim().toLowerCase()), isNull(workspaceInvitations.consumedAt)));
    }
    await tx.update(workspaces).set({ revision: sql`${workspaces.revision} + 1` }).where(eq(workspaces.id, c.workspaceId));
    return { success: true };
  });
}

export async function assignments(leadId: number, userIds?: string[]) {
  ownerOnly();
  let team = await getProjectTeam(leadId);
  if (team.members.find(m => m.userId === context().userId)?.firmRole !== "Owner") throw new AccessError();
  if (userIds) {
    if (userIds.some(id => !team.members.some(m => m.userId === id))) throw new AccessError("Choose active members of this company.", 400);
    team = await saveProjectTeam(leadId, { version: team.version, members: team.members.filter(m => userIds.includes(m.userId))
      .map(m => ({ userId: m.userId, assigned: true, roles: m.roles })) });
  }
  return { members: team.members.map(({ firmRole, ...member }) => ({ ...member, role: firmRole })) };
}
