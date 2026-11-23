import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import express from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "./db";
import { users, workspaces, workspaceMembers, leads, projectTasks, projectTaskNotes } from "@shared/schema";
import { entryInput, entryPatch, entrySummary, isEntryOverdue, type WorkEntry } from "@shared/project-work";
import { ensurePersonalWorkspace } from "./workspaces";
import { registerRoutes } from "./routes/index";

test("typed entry validation rejects hidden task fields and invalid calendar data", () => {
  const note = entryInput.parse({ entryType: "Note", description: "A real note" });
  assert.equal(note.title, ""); assert.equal(note.priority, null); assert.equal(note.status, null);
  assert.equal(note.assigneeId, null); assert.equal(note.dueDate, null);
  assert.equal(entryInput.parse({ entryType: "Reminder", title: "Remember" }).status, "To do");
  assert.equal(entryInput.parse({ entryType: "Meeting", description: "Discuss plans" }).meetingDate, null);
  for (const bad of [
    { entryType: "Note", description: " " }, { entryType: "Note", description: "Text", status: "Done" },
    { entryType: "Note", description: "Text", title: "Fake task title" },
    { entryType: "Note", description: "Text", dueDate: "2026-12-01" },
    { entryType: "Reminder", title: "Remember", priority: "High" },
    { entryType: "Reminder", title: "Remember", status: "In progress" },
    { entryType: "Meeting", title: "Meeting", dueDate: "2026-12-01" },
    { entryType: "Meeting", title: "Meeting", meetingDate: "2026-02-30" },
    { entryType: "Meeting", title: "Meeting", meetingTime: "25:00", meetingDate: "2026-12-01" },
    { entryType: "Meeting", title: "Meeting", meetingTime: "15:00" },
    { entryType: "Task", title: "" }, { entryType: "Task", title: "Task", status: null },
    { entryType: "Note", description: "Text", authorId: "spoof" },
  ]) assert.equal(entryInput.safeParse(bad).success, false, JSON.stringify(bad));
  assert.equal(entryPatch.safeParse({ version: 1, entryType: "Task" }).success, false);
});

test("only active tasks/reminders count as actionable; due today is not overdue", () => {
  const entries = [
    { entryType: "Task", status: "Blocked", dueDate: "2026-11-21", archived: false },
    { entryType: "Reminder", status: "To do", dueDate: "2026-11-22", archived: false },
    { entryType: "Reminder", status: "Done", dueDate: "2026-11-21", archived: false },
    { entryType: "Task", status: "Done", dueDate: null, archived: true },
    { entryType: "Meeting", status: null, dueDate: null, meetingDate: "2026-11-20", archived: false },
    { entryType: "Note", status: null, dueDate: null, archived: false },
  ] as WorkEntry[];
  assert.deepEqual(entrySummary(entries, "2026-11-22"), { open: 2, blocked: 1, overdue: 1, done: 1 });
  for (const entry of entries.slice(1)) assert.equal(isEntryOverdue(entry, "2026-11-22"), false);
});

test("additive migration preserves task-era data and discussion IDs on repeat", async () => {
  const client = await pool.connect(), schema = `log_test_${randomUUID().replaceAll("-", "")}`;
  try {
    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema},public;
      CREATE TABLE users(id varchar PRIMARY KEY); INSERT INTO users VALUES('author');
      CREATE TABLE project_tasks(id varchar PRIMARY KEY,lead_id integer,phase_id varchar,assignee_id varchar,title text NOT NULL,
        description text NOT NULL DEFAULT '',priority text NOT NULL DEFAULT 'Normal',status text NOT NULL DEFAULT 'To do',
        due_date text,archived boolean NOT NULL DEFAULT false,version integer DEFAULT 1,created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now());
      CREATE TABLE project_task_notes(id varchar PRIMARY KEY,task_id varchar,content text,author_id varchar,author_name text,created_at timestamp,request_id varchar);
      CREATE TABLE project_comments(id varchar PRIMARY KEY,content text);
      INSERT INTO project_tasks VALUES('task',1,'same-phase','author','Keep task','Keep details','High','Blocked','2026-12-01',true,7,'2026-11-20','2026-11-21');
      INSERT INTO project_task_notes VALUES('discussion','task','Keep conversation','author','Original author','2026-11-19','original-request');
      INSERT INTO project_comments VALUES('retired','Not a source for the new log');`);
    const migration = await readFile(new URL("../scripts/migrate-project-log.sql", import.meta.url), "utf8");
    const before = (await client.query("SELECT * FROM project_tasks")).rows[0];
    const discussionBefore = (await client.query("SELECT * FROM project_task_notes")).rows;
    await client.query(migration); await client.query(migration);
    const after = (await client.query("SELECT * FROM project_tasks")).rows[0];
    for (const key of Object.keys(before)) assert.deepEqual(after[key], before[key], key);
    assert.equal(after.entry_type, "Task"); assert.equal(after.author_id, null); assert.equal(after.author_name, null);
    assert.deepEqual((await client.query("SELECT * FROM project_task_notes")).rows, discussionBefore);
    assert.equal((await client.query("SELECT count(*) FROM project_tasks")).rows[0].count, "1");
    assert.equal((await client.query("SELECT count(*) FROM project_comments")).rows[0].count, "1");
    await client.query("INSERT INTO project_tasks(id,lead_id,title,description,entry_type,priority,status) VALUES('note',1,'','Body','Note',null,null)");
    await client.query(migration);
    assert.equal((await client.query("SELECT description FROM project_tasks WHERE id='note'")).rows[0].description, "Body");
  } finally { await client.query("ROLLBACK"); client.release(); }
});

test("typed log APIs preserve tasks and enforce validation, access, conflicts and retry safety", async t => {
  const tag = randomUUID(), actorMap = new Map<string, typeof users.$inferSelect>();
  const ids: string[] = [], firms: string[] = [];
  for (const key of ["owner", "member", "outsider", "unassigned"]) {
    const [user] = await db.insert(users).values({ googleId: `log-${tag}-${key}`, name: `Log ${key}`, email: `${key}-${tag}@example.invalid`, accessToken: "", emailVerified: true }).returning();
    actorMap.set(key, user); ids.push(user.id); firms.push((await ensurePersonalWorkspace(user)).id);
  }
  const firm = firms[0];
  for (const key of ["member", "unassigned"]) await db.insert(workspaceMembers).values({ workspaceId: firm, userId: actorMap.get(key)!.id, role: "Member" });
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => {
    req.user = actorMap.get(req.get("X-Test-Actor") || "");
    req.isAuthenticated = (() => !!req.user) as typeof req.isAuthenticated; next();
  });
  const server = await registerRoutes(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const api = async (actor: string, method: string, path: string, body?: unknown, workspace = firm) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers: { "X-Test-Actor": actor, "X-Workspace-Id": workspace, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() as any };
  };
  const owner = (method: string, path: string, body?: unknown) => api("owner", method, path, body);
  const member = (method: string, path: string, body?: unknown) => api("member", method, path, body);
  try {
    const project = (await owner("POST", "/api/leads", { projectName: "Log fixture", generalTimeline: "8–10 weeks" })).body;
    const hidden = (await owner("POST", "/api/leads", { projectName: "Unassigned" })).body;
    await owner("PUT", `/api/leads/${project.id}/assignments`, { userIds: [ids[0], ids[1]] });
    const base = `/api/leads/${project.id}/work`, otherBase = `/api/leads/${hidden.id}/work`;
    const phase = (await owner("POST", `${base}/phases`, { name: "Ad hoc", timeline: "5 weeks" })).body;
    const oldTask = (await owner("POST", `${base}/tasks`, { title: "Existing task", phaseId: phase.id, assigneeId: ids[1], priority: "High", dueDate: "2026-12-01" })).body;
    const priorDiscussion = { content: "Task-era discussion", requestId: randomUUID() };
    await owner("POST", `${base}/tasks/${oldTask.id}/notes`, priorDiscussion);
    let task: any, reminder: any, meeting: any, note: any;
    await t.test("new feed retains original task IDs, fields and attached discussions without duplicates", async () => {
      const work = (await member("GET", base)).body;
      assert.equal(work.entries.length, 1); assert.equal(work.tasks.length, 1);
      const entry = work.entries[0];
      assert.equal(entry.id, oldTask.id); assert.equal(entry.phaseId, phase.id); assert.equal(entry.priority, "High");
      assert.equal(entry.assigneeId, ids[1]); assert.equal(entry.dueDate, "2026-12-01"); assert.equal(entry.noteCount, 1);
      assert.equal((await member("GET", `${base}/entries/${oldTask.id}/notes`)).body[0].content, priorDiscussion.content);
    });
    await t.test("create every kind with type-appropriate optional fields and real author attribution", async () => {
      const inputs = [
        { entryType: "Task", title: "Task", phaseId: phase.id, assigneeId: ids[1] },
        { entryType: "Reminder", title: "Remember this" },
        { entryType: "Meeting", description: "Site review", meetingDate: "2026-12-02", meetingTime: "10:30" },
        { entryType: "Note", description: "General note without a task" },
      ];
      const created: any[] = [];
      for (const entry of inputs) {
        const saved = await member("POST", `${base}/entries`, { requestId: randomUUID(), entry });
        assert.equal(saved.status, 201); assert.equal(saved.body.authorId, ids[1]); assert.equal(saved.body.authorName, "Log member");
        assert.equal(saved.body.creationFingerprint, undefined);
        created.push(saved.body);
      }
      [task, reminder, meeting, note] = created;
      assert.equal(reminder.assigneeId, null); assert.equal(reminder.dueDate, null);
      assert.equal(meeting.status, null); assert.equal(meeting.priority, null); assert.equal(meeting.title, "");
      assert.equal(note.title, ""); assert.equal(note.status, null);
      const work = (await member("GET", base)).body;
      assert.equal(work.entries.length, 5); assert.equal(work.tasks.length, 2);
      assert.equal(work.entries[0].id, note.id);
    });
    await t.test("create retries serialize and cannot overwrite edited records or impersonate another author", async () => {
      const payload = { requestId: randomUUID(), entry: { entryType: "Note", description: "Safe retry" } };
      const pair = await Promise.all([member("POST", `${base}/entries`, payload), member("POST", `${base}/entries`, payload)]);
      assert.equal(pair[0].status, 201); assert.equal(pair[1].status, 201); assert.equal(pair[0].body.id, pair[1].body.id);
      const changed = await member("PATCH", `${base}/entries/${pair[0].body.id}`, { version: 1, description: "Edited since create" });
      assert.equal(changed.status, 200);
      assert.equal((await member("POST", `${base}/entries`, payload)).body.description, "Edited since create");
      assert.equal((await owner("POST", `${base}/entries`, payload)).status, 409);
      assert.equal((await member("POST", `${base}/entries`, { ...payload, entry: { entryType: "Note", description: "Different" } })).status, 409);
      const legacy = { requestId: randomUUID(), title: "Legacy retry" };
      const first = await owner("POST", `${base}/tasks`, legacy);
      assert.equal((await owner("POST", `${base}/tasks`, legacy)).body.id, first.body.id);
    });
    await t.test("patch validates the final type, keeps immutable kinds and rejects stale or foreign parents", async () => {
      assert.equal((await member("PATCH", `${base}/entries/${note.id}`, { version: note.version, priority: "High" })).status, 400);
      assert.equal((await member("PATCH", `${base}/entries/${meeting.id}`, { version: meeting.version, status: "Done" })).status, 400);
      assert.equal((await member("PATCH", `${base}/entries/${reminder.id}`, { version: reminder.version, status: "Blocked" })).status, 400);
      assert.equal((await member("PATCH", `${base}/entries/${note.id}`, { version: note.version, entryType: "Task" })).status, 400);
      const patched = await member("PATCH", `${base}/entries/${note.id}`, { version: note.version, description: "Edited note" });
      assert.equal(patched.status, 200); note = patched.body;
      assert.equal((await member("PATCH", `${base}/entries/${note.id}`, { version: 1, description: "Stale" })).status, 409);
      assert.equal((await owner("PATCH", `${otherBase}/entries/${note.id}`, { version: note.version, archived: true })).status, 404);
      assert.equal((await owner("GET", `${otherBase}/entries/${note.id}/notes`)).status, 404);
    });
    await t.test("legacy task routes cannot expose non-task discussions or mutate hidden typed fields", async () => {
      for (const row of [reminder, meeting, note]) {
        assert.equal((await member("PATCH", `${base}/tasks/${row.id}`, { version: row.version, archived: true })).status, 404);
        assert.equal((await member("GET", `${base}/tasks/${row.id}/notes`)).status, 404);
        assert.equal((await member("POST", `${base}/tasks/${row.id}/notes`, { content: "Bypass", requestId: randomUUID() })).status, 404);
      }
      assert.equal((await member("POST", `${base}/tasks`, { title: "Spoof", entryType: "Note" })).status, 400);
    });
    await t.test("completion and archive/restore work without deleting data", async () => {
      for (const row of [task, reminder]) {
        const saved = await member("PATCH", `${base}/entries/${row.id}`, { version: row.version, status: "Done" });
        assert.equal(saved.status, 200);
        const archived = await member("PATCH", `${base}/entries/${row.id}`, { version: saved.body.version, archived: true });
        assert.equal(archived.status, 200);
        const restored = await member("PATCH", `${base}/entries/${row.id}`, { version: archived.body.version, archived: false });
        assert.equal(restored.body.status, "Done"); assert.equal(restored.body.phaseId, row.phaseId);
      }
      assert.equal((await db.select().from(projectTasks).where(eq(projectTasks.id, oldTask.id))).length, 1);
      assert.equal((await db.select().from(projectTaskNotes).where(eq(projectTaskNotes.taskId, oldTask.id))).length, 1);
    });
    await t.test("discussions are attributed, literal, retry-safe and never copied to top-level feed", async () => {
      const countBefore = (await member("GET", base)).body.entries.length;
      const payload = { content: "<script>Literal discussion</script>", requestId: randomUUID() };
      const first = await member("POST", `${base}/entries/${note.id}/notes`, payload);
      assert.equal(first.status, 201); assert.equal(first.body[0].authorName, "Log member");
      const again = await member("POST", `${base}/entries/${note.id}/notes`, payload);
      assert.equal(again.body.length, 1); assert.equal(again.body[0].content, payload.content);
      assert.equal((await owner("POST", `${base}/entries/${note.id}/notes`, payload)).status, 409);
      assert.equal((await member("POST", `${base}/entries/${note.id}/notes`, { ...payload, content: "Changed" })).status, 409);
      assert.equal((await member("GET", base)).body.entries.length, countBefore);
    });
    await t.test("phase and assignee eligibility, firm boundaries and revocation apply to every type", async () => {
      const otherPhase = (await owner("POST", `${otherBase}/phases`, { name: "Foreign phase" })).body;
      for (const extra of [{ phaseId: otherPhase.id }, { assigneeId: ids[3] }, { assigneeId: ids[2] }]) {
        assert.equal((await member("POST", `${base}/entries`, { requestId: randomUUID(), entry: { entryType: "Note", description: "Bad link", ...extra } })).status, 400);
      }
      assert.equal((await api("outsider", "GET", base)).status, 403);
      assert.equal((await api("unassigned", "GET", base)).status, 404);
      assert.equal((await member("GET", otherBase)).status, 404);
      await owner("PUT", `/api/leads/${project.id}/assignments`, { userIds: [ids[0]] });
      assert.equal((await member("GET", base)).status, 404);
      assert.equal((await member("PATCH", `${base}/entries/${note.id}`, { version: note.version, description: "No access" })).status, 404);
      assert.equal((await member("GET", `${base}/entries/${note.id}/notes`)).status, 404);
      const work = (await owner("GET", base)).body;
      assert.equal(work.entries.find((e: any) => e.id === task.id).assigneeEligible, false);
    });
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.delete(leads).where(inArray(leads.workspaceId, firms));
    await db.delete(workspaces).where(inArray(workspaces.id, firms));
    await db.delete(users).where(inArray(users.id, ids));
  }
});
test.after(async () => { await pool.end(); });
