import type { Express, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../auth";
import { AccessError } from "../workspace-context";
import * as work from "../repositories/project-work";

const run = (handler: (req: Request, res: Response, leadId: number) => Promise<unknown>) =>
  async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    try {
      const leadId = z.coerce.number().int().positive().parse(req.params.leadId);
      if (req.params.id) z.string().uuid().parse(req.params.id);
      await handler(req, res, leadId);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues[0]?.message || "Check your input." });
      if (error instanceof AccessError) return res.status(error.status).json({ error: error.message });
      console.error("Project work operation failed:", error instanceof Error ? error.name : "Unknown error");
      res.status(500).json({ error: "Could not save or load project work. Please retry." });
    }
  };
export function registerProjectWorkRoutes(app: Express) {
  const base = "/api/leads/:leadId/work";
  app.get(base, requireAuth, run(async (_req, res, leadId) => res.json(await work.getProjectWork(leadId))));
  app.post(`${base}/reconcile`, requireAuth, run(async (req, res, leadId) => {
    const { proposalId } = z.object({ proposalId: z.string().uuid().nullable() }).strict().parse(req.body);
    res.json(await work.reconcileProject(leadId, proposalId));
  }));
  app.post(`${base}/phases`, requireAuth, run(async (req, res, leadId) => res.status(201).json(await work.savePhase(leadId, undefined, req.body))));
  app.post(`${base}/phases/reorder`, requireAuth, run(async (req, res, leadId) => {
    const { phases } = z.object({ phases: z.array(z.object({ id: z.string().uuid(), version: z.number().int().positive() }).strict()).max(500) }).strict().parse(req.body);
    res.json(await work.reorderPhases(leadId, phases));
  }));
  app.patch(`${base}/phases/:id`, requireAuth, run(async (req, res, leadId) => res.json(await work.savePhase(leadId, req.params.id, req.body))));
  app.post(`${base}/tasks`, requireAuth, run(async (req, res, leadId) => res.status(201).json(await work.saveTask(leadId, undefined, req.body))));
  app.patch(`${base}/tasks/:id`, requireAuth, run(async (req, res, leadId) => res.json(await work.saveTask(leadId, req.params.id, req.body))));
  app.get(`${base}/tasks/:id/notes`, requireAuth, run(async (req, res, leadId) => res.json(await work.taskNotes(leadId, req.params.id))));
  app.post(`${base}/tasks/:id/notes`, requireAuth, run(async (req, res, leadId) => {
    const note = z.object({ content: z.string().trim().min(1).max(20000), requestId: z.string().uuid() }).strict().parse(req.body);
    res.status(201).json(await work.taskNotes(leadId, req.params.id, note));
  }));
}
