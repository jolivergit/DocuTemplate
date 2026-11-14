import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../auth";
import { db } from "../db";
import { workspaces, workspaceInvitations, type User } from "@shared/schema";
import { context, ownerOnly, AccessError } from "../workspace-context";
import * as service from "../workspaces";

const run = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  async (req: Request, res: Response, _next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store");
    try { await fn(req, res); } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Check the values you entered." });
      if (error instanceof AccessError) return res.status(error.status).json({ error: error.message });
      console.error("Workspace operation failed:", error instanceof Error ? error.name : "Unknown error");
      res.status(500).json({ error: "The workspace operation failed. Please try again." });
    }
  };

export function registerWorkspaceRoutes(app: Express) {
  app.post("/api/workspaces", requireAuth, run(async (req, res) => {
    const { name, requestId } = z.object({
      name: z.string().trim().min(1).max(100), requestId: z.string().uuid(),
    }).strict().parse(req.body);
    const workspace = await service.createWorkspace((req.user as User).id, name, requestId);
    res.status(201).json({ workspace });
  }));
  app.get("/api/workspaces", requireAuth, run(async (req, res) => {
    const list = await service.memberships((req.user as User).id);
    const active = list.find(w => w.id === context().workspaceId)!;
    res.json({ workspaces: list.map(({ memberId, ...w }) => w), active: { id: active.id, name: active.name, role: active.role, revision: active.revision }, userId: (req.user as User).id });
  }));
  app.get("/api/workspace/team", requireAuth, run(async (_req, res) => { res.json(await service.team()); }));
  app.patch("/api/workspace", requireAuth, run(async (req, res) => {
    ownerOnly();
    const { name } = z.object({ name: z.string().trim().min(1).max(100) }).parse(req.body);
    await db.update(workspaces).set({ name, revision: sql`${workspaces.revision}+1` }).where(eq(workspaces.id, context().workspaceId));
    res.json({ success: true });
  }));
  app.post("/api/workspace/invitations", requireAuth, run(async (req, res) => {
    const { email } = z.object({ email: z.string().trim().email().max(254).transform(e => e.toLowerCase()) }).parse(req.body);
    res.json(await service.invite(email));
  }));
  app.post("/api/workspace/invitations/:id/revoke", requireAuth, run(async (req, res) => {
    ownerOnly();
    await db.update(workspaceInvitations).set({ consumedAt: new Date() }).where(and(eq(workspaceInvitations.id, req.params.id), eq(workspaceInvitations.workspaceId, context().workspaceId)));
    res.json({ success: true });
  }));
  app.post("/api/invitations/accept", requireAuth, run(async (req, res) => {
    const { token } = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).parse(req.body);
    res.json(await service.acceptInvitation(req.user as User, token));
  }));
  app.delete("/api/workspace/members/:userId", requireAuth, run(async (req, res) => { res.json(await service.changeMember(req.params.userId)); }));
  app.patch("/api/workspace/members/:userId", requireAuth, run(async (req, res) => {
    const { role } = z.object({ role: z.enum(["Owner", "Member"]) }).parse(req.body);
    res.json(await service.changeMember(req.params.userId, role));
  }));
  app.get("/api/leads/:id/assignments", requireAuth, run(async (req, res) => {
    res.json(await service.assignments(z.coerce.number().int().positive().parse(req.params.id)));
  }));
  app.put("/api/leads/:id/assignments", requireAuth, run(async (req, res) => {
    const { userIds } = z.object({ userIds: z.array(z.string()).max(500) }).parse(req.body);
    await service.assignments(z.coerce.number().int().positive().parse(req.params.id), Array.from(new Set(userIds)));
    res.json({ success: true });
  }));
}
