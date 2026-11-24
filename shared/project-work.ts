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
export type DiscussionPreview = Pick<TaskNote, "id" | "content" | "authorName">;
export interface ProjectWork {
  phases: WorkPhase[]; tasks: WorkTask[];
  entries: WorkEntry[];
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

export const ENTRY_TYPES = ["Task", "Reminder", "Meeting", "Note"] as const;
const commonEntry = {
  description: z.string().max(20000).default(""),
  phaseId: id.nullable().default(null),
  assigneeId: z.string().min(1).nullable().default(null),
};
const noDate = z.null().default(null);
const meetingTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time");
export const entryInput = z.discriminatedUnion("entryType", [
  z.object({
    ...commonEntry, entryType: z.literal("Task"), title: taskInput.shape.title,
    priority: taskInput.shape.priority, status: taskInput.shape.status,
    dueDate: dateOnly.nullable().default(null), meetingDate: noDate, meetingTime: noDate,
  }).strict(),
  z.object({
    ...commonEntry, entryType: z.literal("Reminder"), title: taskInput.shape.title,
    priority: noDate, status: z.enum(["To do", "Done"]).default("To do"),
    dueDate: dateOnly.nullable().default(null), meetingDate: noDate, meetingTime: noDate,
  }).strict(),
  z.object({
    ...commonEntry, entryType: z.literal("Meeting"), title: z.string().trim().max(240).default(""),
    priority: noDate, status: noDate, dueDate: noDate,
    meetingDate: dateOnly.nullable().default(null), meetingTime: meetingTime.nullable().default(null),
  }).strict(),
  z.object({
    ...commonEntry, entryType: z.literal("Note"), title: z.literal("").default(""),
    description: z.string().max(20000).refine(s => !!s.trim(), "Write a note"),
    priority: noDate, status: noDate, dueDate: noDate, meetingDate: noDate, meetingTime: noDate,
  }).strict(),
]).superRefine((entry, ctx) => {
  if (entry.entryType === "Meeting") {
    if (!entry.title && !entry.description.trim()) ctx.addIssue({ code: "custom", path: ["description"], message: "Enter a meeting title or notes" });
    if (entry.meetingTime && !entry.meetingDate) ctx.addIssue({ code: "custom", path: ["meetingDate"], message: "Choose a meeting date before entering its time" });
  }
});
export const entryCreate = z.object({ requestId: id, entry: entryInput }).strict();
export const entryPatch = z.object({
  version: z.number().int().positive(),
  title: z.string().trim().max(240).optional(),
  description: z.string().max(20000).optional(),
  phaseId: id.nullable().optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).nullable().optional(),
  status: z.enum(TASK_STATUSES).nullable().optional(),
  dueDate: dateOnly.nullable().optional(),
  meetingDate: dateOnly.nullable().optional(),
  meetingTime: meetingTime.nullable().optional(),
  archived: z.boolean().optional(),
}).strict();
export type EntryInput = z.infer<typeof entryInput>;
export type EntryType = EntryInput["entryType"];
export type WorkEntry = EntryInput & {
  id: string; archived: boolean; version: number; createdAt: string; updatedAt: string;
  authorId: string | null; authorName: string | null;
  creationRequestId: string | null;
  assigneeName: string | null; assigneeEligible: boolean; noteCount: number;
  discussionPreview?: DiscussionPreview | null;
};
export function isActionable(entry: Pick<WorkEntry, "entryType">) {
  return entry.entryType === "Task" || entry.entryType === "Reminder";
}
export function isEntryOverdue(entry: Pick<WorkEntry, "entryType" | "archived" | "dueDate" | "status">, today = localCalendarDate()) {
  return isActionable(entry) && !entry.archived && !!entry.dueDate && entry.dueDate < today && entry.status !== "Done";
}
export function entrySummary(entries: WorkEntry[], today = localCalendarDate()) {
  const actions = entries.filter(e => isActionable(e) && !e.archived);
  return {
    open: actions.filter(e => e.status !== "Done").length,
    blocked: actions.filter(e => e.status === "Blocked").length,
    overdue: actions.filter(e => isEntryOverdue(e, today)).length,
    done: actions.filter(e => e.status === "Done").length,
  };
}
