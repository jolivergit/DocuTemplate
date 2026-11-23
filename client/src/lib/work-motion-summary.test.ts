import { test } from "node:test";
import assert from "node:assert/strict";
import type { WorkEntry } from "../../../shared/project-work";
import { workMotionSummary } from "./work-motion-summary";

const now = new Date(2026, 10, 23, 14, 30);
function entry(id: string, overrides: Record<string, unknown> = {}): WorkEntry {
  return {
    id, entryType: "Task", title: id, description: "", phaseId: null, assigneeId: null,
    priority: "Normal", status: "To do", dueDate: null, meetingDate: null, meetingTime: null,
    archived: false, version: 1, createdAt: "2026-11-01T12:00:00Z", updatedAt: "2026-11-01T12:00:00Z",
    authorId: null, authorName: null, creationRequestId: null, assigneeName: null,
    assigneeEligible: true, noteCount: 0, ...overrides,
  } as WorkEntry;
}
const meeting = (id: string, date: string | null, time: string | null = null, archived = false) =>
  entry(id, { entryType: "Meeting", status: null, priority: null, meetingDate: date, meetingTime: time, archived });

test("active actionable counts exclude archived work, meetings and notes, independently of filters", () => {
  const entries = [
    entry("past", { dueDate: "2026-11-22" }),
    entry("today", { dueDate: "2026-11-23" }),
    entry("blocked", { status: "Blocked" }),
    entry("reminder", { entryType: "Reminder", priority: null }),
    entry("done", { status: "Done", dueDate: "2026-11-01" }),
    entry("archived", { archived: true, dueDate: "2026-11-01" }),
    entry("archived-done", { archived: true, status: "Done" }),
    entry("note", { entryType: "Note", status: null, priority: null, title: "" }),
    meeting("meeting", "2026-11-24"),
  ];
  const { nextMeeting, ...counts } = workMotionSummary(entries, now);
  assert.deepEqual(counts, { open: 4, blocked: 1, overdue: 1, done: 1 });
  assert.equal(nextMeeting?.id, "meeting");
});

test("next meeting skips past dates/times, undated and archived entries without changing log order", () => {
  const entries = [
    meeting("tomorrow", "2026-11-24", "09:00"),
    meeting("undated", null),
    meeting("past-date", "2026-11-22", "23:59"),
    meeting("past-time", "2026-11-23", "14:29"),
    meeting("archived", "2026-11-23", "14:31", true),
    meeting("later-today", "2026-11-23", "16:00"),
    meeting("current-minute", "2026-11-23", "14:30"),
  ];
  const originalOrder = entries.map(item => item.id);
  assert.equal(workMotionSummary(entries, now).nextMeeting?.id, "current-minute");
  assert.deepEqual(entries.map(item => item.id), originalOrder);
  assert.equal(workMotionSummary(entries, new Date(2026, 10, 23, 16, 1)).nextMeeting?.id, "tomorrow");
});

test("date-only meetings today remain upcoming through the local day", () => {
  const entries = [meeting("timed", "2026-11-23", "16:00"), meeting("date-only", "2026-11-23")];
  assert.equal(workMotionSummary(entries, now).nextMeeting?.id, "date-only");
  assert.equal(workMotionSummary(entries, new Date(2026, 10, 24, 0, 0)).nextMeeting, null);
});

test("local late-night and early-morning boundaries do not shift to UTC dates", () => {
  const entries = [meeting("today", "2026-11-23"), meeting("tomorrow", "2026-11-24")];
  assert.equal(workMotionSummary(entries, new Date(2026, 10, 23, 23, 59)).nextMeeting?.id, "today");
  assert.equal(workMotionSummary(entries, new Date(2026, 10, 24, 0, 1)).nextMeeting?.id, "tomorrow");
  assert.equal(workMotionSummary([entry("due", { dueDate: "2026-11-23" })], new Date(2026, 10, 23, 23, 59)).overdue, 0);
  assert.equal(workMotionSummary([entry("due", { dueDate: "2026-11-23" })], new Date(2026, 10, 24, 0, 1)).overdue, 1);
});

test("empty projects and past-only meetings have no invented next appointment", () => {
  assert.deepEqual(workMotionSummary([], now), { open: 0, blocked: 0, overdue: 0, done: 0, nextMeeting: null });
  assert.equal(workMotionSummary([meeting("past", "2026-11-22")], now).nextMeeting, null);
});
