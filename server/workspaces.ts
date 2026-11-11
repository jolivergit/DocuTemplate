import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { workspaces, workspaceMembers, workspaceInvitations, projectAssignments, users, leads, type User } from "@shared/schema";
import { context, ownerOnly, AccessError, type WorkspaceContext } from "./workspace-context";

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
  const c = context();
  return db.transaction(async tx => {
    await tx.select().from(workspaces).where(eq(workspaces.id, c.workspaceId)).for("update");
    const [lead] = await tx.select().from(leads).where(and(eq(leads.id, leadId), eq(leads.workspaceId, c.workspaceId)));
    if (!lead) throw new AccessError("Project not found.", 404);
    const members = await tx.select({ memberId: workspaceMembers.id, userId: users.id, name: users.name, email: users.email, role: workspaceMembers.role })
      .from(workspaceMembers).innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, c.workspaceId));
    if (!members.some(m => m.userId === c.userId && m.role === "Owner")) throw new AccessError();
    if (userIds) {
      if (userIds.some(id => !members.some(m => m.userId === id))) throw new AccessError("Choose active members of this company.", 400);
      await tx.delete(projectAssignments).where(eq(projectAssignments.leadId, leadId));
      const selected = members.filter(m => userIds.includes(m.userId));
      if (selected.length) await tx.insert(projectAssignments).values(selected.map(m => ({ leadId, memberId: m.memberId })));
      await tx.update(workspaces).set({ revision: sql`${workspaces.revision} + 1` }).where(eq(workspaces.id, c.workspaceId));
    }
    const selected = await tx.select().from(projectAssignments).where(eq(projectAssignments.leadId, leadId));
    return { members: members.map(({ memberId, ...m }) => ({ ...m, assigned: selected.some(a => a.memberId === memberId) })) };
  });
}
