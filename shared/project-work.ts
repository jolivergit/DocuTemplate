import { z } from "zod";

export const TASK_STATUSES = ["To do", "In progress", "Blocked", "Done"] as const;
export const TASK_PRIORITIES = ["Low", "Normal", "High", "Urgent"] as const;
const id = z.string().uuid();
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T12:00:00Z`);
  return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Enter a valid date");
export const taskInput = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.string().max(20000).default(""),
  phaseId: id.nullable().default(null),
  assigneeId: z.string().min(1).nullable().default(null),
  priority: z.enum(TASK_PRIORITIES).default("Normal"),
  status: z.enum(TASK_STATUSES).default("To do"),
  dueDate: dateOnly.nullable().default(null),
}).strict();
export const taskPatch = taskInput.partial().extend({
  version: z.number().int().positive(),
  archived: z.boolean().optional(),
}).strict();
export const feeInput = z.object({
  consultant: z.string().trim().min(1).max(200),
  feeType: z.enum(["Fixed", "Hourly"]),
  amount: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/).nullable(),
}).strict();
export const phaseInput = z.object({
  name: z.string().trim().min(1).max(200),
  timeline: z.string().trim().max(200).nullable().default(null),
  feeLines: z.array(feeInput).max(100).default([]),
}).strict();
export const phasePatch = phaseInput.partial().extend({
  version: z.number().int().positive(),
  archived: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
}).strict();
export type TaskInput = z.infer<typeof taskInput>;
export type FeeInput = z.infer<typeof feeInput>;
export interface WorkPhase {
  id: string; name: string; timeline: string | null; sortOrder: number;
  archived: boolean; version: number;
  feeLines: (FeeInput & { id: string; sortOrder: number })[];
}
export interface WorkTask extends TaskInput {
  id: string; archived: boolean; version: number; createdAt: string; updatedAt: string;
  assigneeName: string | null; assigneeEligible: boolean; noteCount: number;
}
export interface TaskNote {
  id: string; content: string; authorName: string; createdAt: string;
}
export interface ProjectWork {
  phases: WorkPhase[]; tasks: WorkTask[];
  assignees: { userId: string; name: string }[];
  legacySources: { id: string; name: string; status: string; phases: { name: string; total: string }[] }[];
  needsReconciliation: boolean;
}
export function localCalendarDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function isTaskOverdue(task: Pick<WorkTask, "archived" | "dueDate" | "status">, today = localCalendarDate()) {
  return !task.archived && !!task.dueDate && task.dueDate < today && task.status !== "Done";
}
