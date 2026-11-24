import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import express from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "./db";
import { users, workspaces, workspaceMembers, leads, proposals, proposalPhases, proposalFeeLines } from "@shared/schema";
import { ensurePersonalWorkspace } from "./workspaces";
import { registerRoutes } from "./routes/index";
import { taskInput, phaseInput, isTaskOverdue } from "@shared/project-work";
import { initialProposalPhaseIds, scopeSaveFields, scopeRefreshIds } from "@shared/proposal-scope";

test("new proposals preselect active project phases without expanding saved or legacy scope", () => {
  const phases = [
    { id: "later", archived: false, sortOrder: 2 },
    { id: "archived", archived: true, sortOrder: 0 },
    { id: "first", archived: false, sortOrder: 1 },
  ];
  assert.deepEqual(initialProposalPhaseIds(phases), ["first", "later"]);
  assert.deepEqual(phases.map(phase => phase.id), ["later", "archived", "first"]);
  assert.deepEqual(initialProposalPhaseIds([]), []);
  assert.deepEqual(initialProposalPhaseIds(phases, []), []);
  assert.deepEqual(initialProposalPhaseIds(phases, [{ projectPhaseId: "archived" }]), ["archived"]);
  assert.deepEqual(initialProposalPhaseIds(phases, [{ projectPhaseId: null }]), []);
});

test("proposal UI distinguishes metadata, explicit empty scope and unresolved legacy selection", () => {
  const options = { editing: true, locked: false, selectionChanged: false, selectedPhaseIds: [] };
  assert.deepEqual(scopeSaveFields(options), {});
  assert.deepEqual(scopeSaveFields({ ...options, selectionChanged: true }), { selectedPhaseIds: [] });
  assert.deepEqual(scopeSaveFields({ ...options, editing: false }), { selectedPhaseIds: [] });
  assert.deepEqual(scopeSaveFields({ ...options, locked: true, selectionChanged: true }), {});
  assert.deepEqual(scopeRefreshIds([]), []);
  assert.deepEqual(scopeRefreshIds([{ projectPhaseId: "recorded" }]), ["recorded"]);
  assert.throws(() => scopeRefreshIds([{ projectPhaseId: null }]), /unmapped phases/);
  assert.throws(() => scopeRefreshIds([{ projectPhaseId: "recorded" }, {}]), /unmapped phases/);
});

test("task validation and calendar-date overdue boundaries", () => {
  assert.equal(taskInput.parse({ title: "  Review plans " }).title, "Review plans");
  for (const input of [{ title: "" }, { title: "a", dueDate: "2026-02-30" }, { title: "a", status: "unknown" }, { title: "a", userId: "spoof" }]) {
    assert.equal(taskInput.safeParse(input).success, false);
  }
  assert.equal(phaseInput.parse({ name: "Custom", timeline: "8–10 weeks" }).timeline, "8–10 weeks");
  assert.equal(phaseInput.parse({ name: "Custom" }).timeline, null);
  assert.equal(isTaskOverdue({ archived: false, status: "To do", dueDate: "2026-11-21" }, "2026-11-22"), true);
  for (const task of [
    { archived: false, status: "To do", dueDate: "2026-11-22" },
    { archived: false, status: "Done", dueDate: "2026-11-21" },
    { archived: true, status: "Blocked", dueDate: "2026-11-21" },
    { archived: false, status: "To do", dueDate: null },
  ]) assert.equal(isTaskOverdue(task, "2026-11-22"), false);
});

test("project migration is repeatable and only retires legacy notes once", async () => {
  const client = await pool.connect();
  const schema = `work_test_${randomUUID().replaceAll("-", "")}`;
  try {
    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema},public`);
    await client.query(`
      CREATE TABLE users (id varchar PRIMARY KEY);
      CREATE TABLE leads (id integer PRIMARY KEY);
      CREATE TABLE proposal_phases (id varchar PRIMARY KEY);
      CREATE TABLE project_comments (id varchar PRIMARY KEY, content text);
      INSERT INTO users VALUES ('u'); INSERT INTO leads VALUES (1);
      INSERT INTO project_comments VALUES ('old','retire me');
    `);
    const migration = await readFile(new URL("../scripts/migrate-project-work.sql", import.meta.url), "utf8");
    await client.query(migration);
    assert.equal((await client.query("SELECT count(*) FROM project_comments")).rows[0].count, "0");
    await client.query(`
      INSERT INTO project_phases(id,lead_id,name,timeline) VALUES ('phase',1,'Custom','8–10 weeks');
      INSERT INTO project_tasks(id,lead_id,title,phase_id) VALUES ('task',1,'Keep task','phase');
      INSERT INTO project_task_notes(id,task_id,author_id,author_name,content,request_id) VALUES ('note','task','u','Author','Keep discussion','req');
      INSERT INTO project_comments VALUES ('late','one-time cleanup guard');
    `);
    await client.query(migration);
    assert.equal((await client.query("SELECT timeline FROM project_phases")).rows[0].timeline, "8–10 weeks");
    assert.equal((await client.query("SELECT content FROM project_task_notes")).rows[0].content, "Keep discussion");
    assert.equal((await client.query("SELECT count(*) FROM project_comments")).rows[0].count, "1");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("shared phase, task, proposal and access lifecycle", async t => {
  const tag = randomUUID();
  const userIds: string[] = [], workspaceIds: string[] = [];
  const actors = new Map<string, typeof users.$inferSelect>();
  for (const key of ["owner", "member", "outsider", "unassigned"]) {
    const [user] = await db.insert(users).values({ googleId: `work-${tag}-${key}`, name: `Work ${key}`, email: `${key}-${tag}@example.invalid`, accessToken: "", emailVerified: true }).returning();
    userIds.push(user.id); actors.set(key, user);
    const workspace = await ensurePersonalWorkspace(user);
    workspaceIds.push(workspace.id);
  }
  const firm = workspaceIds[0], foreignFirm = workspaceIds[2];
  for (const key of ["member", "unassigned"]) await db.insert(workspaceMembers).values({ workspaceId: firm, userId: actors.get(key)!.id, role: "Member" });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = actors.get(req.get("X-Test-Actor") || "");
    req.isAuthenticated = (() => !!req.user) as typeof req.isAuthenticated;
    next();
  });
  const server = await registerRoutes(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const api = async (actor: string, method: string, path: string, body?: unknown, workspace = firm) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers: { "X-Test-Actor": actor, "X-Workspace-Id": workspace, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() as any };
  };
  const A = (method: string, path: string, body?: unknown) => api("owner", method, path, body);
  const M = (method: string, path: string, body?: unknown) => api("member", method, path, body);
  try {
    const project = (await A("POST", "/api/leads", { projectName: `Work fixture ${tag}`, probability: "HIGH", status: "Active Project" })).body;
    const hidden = (await A("POST", "/api/leads", { projectName: `Hidden ${tag}`, probability: "LOW", status: "Lead" })).body;
    const foreign = (await api("outsider", "POST", "/api/leads", { projectName: `Foreign ${tag}`, probability: "LOW", status: "Lead" }, foreignFirm)).body;
    const base = `/api/leads/${project.id}/work`;
    await A("PUT", `/api/leads/${project.id}/assignments`, { userIds: [actors.get("owner")!.id, actors.get("member")!.id] });
    let phase: any, task: any, proposal: any;
    await t.test("assignee list is project eligible only and foreign scopes are denied", async () => {
      const work = await M("GET", base);
      assert.equal(work.status, 200);
      assert.deepEqual(work.body.assignees.map((a: any) => a.userId).sort(), [actors.get("owner")!.id, actors.get("member")!.id].sort());
      assert.equal((await M("GET", `/api/leads/${hidden.id}/work`)).status, 404);
      assert.equal((await M("GET", `/api/leads/${foreign.id}/work`)).status, 404);
      assert.equal((await api("outsider", "GET", base)).status, 403);
      assert.equal((await api("unknown", "GET", base)).status, 401);
    });
    await t.test("custom phases allow optional timelines, fees, stale-write rejection and archive", async () => {
      phase = (await M("POST", `${base}/phases`, { name: "Ad-hoc site review", timeline: "8–10 weeks", feeLines: [{ consultant: "Architecture", feeType: "Fixed", amount: "1000" }] })).body;
      assert.ok(phase.id);
      assert.equal(phase.timeline, "8–10 weeks");
      assert.equal(phase.feeLines[0].amount, "1000.00");
      const saved = await M("PATCH", `${base}/phases/${phase.id}`, { version: phase.version, timeline: null });
      assert.equal(saved.status, 200);
      assert.equal(saved.body.timeline, null);
      assert.equal((await M("PATCH", `${base}/phases/${phase.id}`, { version: phase.version, name: "stale" })).status, 409);
      phase = saved.body;
      const noFee = await M("POST", `${base}/phases`, { name: "Internal coordination" });
      assert.equal(noFee.status, 201);
      assert.deepEqual(noFee.body.feeLines, []);
    });
    await t.test("task writes validate parent, phase, assignee, fields and dates", async () => {
      const otherPhase = (await A("POST", `/api/leads/${hidden.id}/work/phases`, { name: "Private" })).body;
      for (const input of [
        { title: "Bad", phaseId: otherPhase.id },
        { title: "Bad", assigneeId: actors.get("unassigned")!.id },
        { title: "Bad", dueDate: "2026-02-30" },
        { title: "Bad", status: "Other" },
        { title: "Bad", leadId: hidden.id },
      ]) assert.equal((await M("POST", `${base}/tasks`, input)).status, 400);
      const created = await M("POST", `${base}/tasks`, { title: "Review drawings", phaseId: phase.id, assigneeId: actors.get("member")!.id, priority: "High", dueDate: "2026-12-01" });
      assert.equal(created.status, 201);
      task = created.body;
      const saved = await A("PATCH", `${base}/tasks/${task.id}`, { version: task.version, status: "Blocked" });
      assert.equal(saved.status, 200); task = saved.body;
      assert.equal((await M("PATCH", `${base}/tasks/${task.id}`, { version: 1, title: "Stale" })).status, 409);
      assert.equal((await A("PATCH", `/api/leads/${hidden.id}/work/tasks/${task.id}`, { version: task.version, title: "Spoof" })).status, 404);
    });
    await t.test("phase reorder is atomic, complete and rejects stale or duplicate entries", async () => {
      const current = (await M("GET", base)).body.phases;
      const ordered = current.slice().reverse().map((p: any) => ({ id: p.id, version: p.version }));
      const saved = await M("POST", `${base}/phases/reorder`, { phases: ordered });
      assert.equal(saved.status, 200);
      assert.deepEqual(saved.body.map((p: any) => p.id), ordered.map((p: any) => p.id));
      assert.equal((await M("POST", `${base}/phases/reorder`, { phases: ordered })).status, 409);
      assert.equal((await M("POST", `${base}/phases/reorder`, { phases: [ordered[0], ordered[0]] })).status, 409);
      phase = saved.body.find((p: any) => p.id === phase.id);
    });
    await t.test("attributed notes persist, retry safely and reject foreign-parent IDs", async () => {
      const body = { content: "<script>literal text</script>", requestId: randomUUID() };
      const first = await M("POST", `${base}/tasks/${task.id}/notes`, body);
      assert.equal(first.status, 201);
      const again = await M("POST", `${base}/tasks/${task.id}/notes`, body);
      assert.equal(again.body.length, 1);
      assert.equal(again.body[0].authorName, "Work member");
      assert.equal(again.body[0].content, body.content);
      assert.equal((await A("POST", `${base}/tasks/${task.id}/notes`, body)).status, 409);
      assert.equal((await M("POST", `${base}/tasks/${task.id}/notes`, { content: "different", requestId: body.requestId })).status, 409);
      assert.equal((await A("GET", `/api/leads/${hidden.id}/work/tasks/${task.id}/notes`)).status, 404);
      assert.equal((await M("GET", base)).body.tasks.find((r: any) => r.id === task.id).noteCount, 1);
      assert.equal((await A("POST", `/api/leads/${project.id}/comments`, { content: "retired" })).status, 410);
    });
    await t.test("new proposal defaults persist both project phases and the list reports the same scope", async () => {
      const fresh = (await A("POST", "/api/leads", { projectName: "Proposal phase defaults fixture" })).body;
      const freshBase = `/api/leads/${fresh.id}/work`;
      const first = (await A("POST", `${freshBase}/phases`, { name: "Unpriced design phase" })).body;
      const second = (await A("POST", `${freshBase}/phases`, {
        name: "Documentation", feeLines: [{ consultant: "Architecture", feeType: "Fixed", amount: "1500" }],
      })).body;
      const archived = (await A("POST", `${freshBase}/phases`, { name: "Retired phase" })).body;
      assert.equal((await A("PATCH", `${freshBase}/phases/${archived.id}`, { version: archived.version, archived: true })).status, 200);
      const work = (await A("GET", freshBase)).body;
      const selected = initialProposalPhaseIds(work.phases);
      assert.deepEqual(selected, [first.id, second.id]);
      const saved = await A("POST", `/api/leads/${fresh.id}/proposals`, {
        name: "Two-phase proposal",
        ...scopeSaveFields({ editing: false, locked: false, selectionChanged: false, selectedPhaseIds: selected }),
      });
      assert.equal(saved.status, 200);
      assert.equal(saved.body.phases.length, 2);
      assert.deepEqual(saved.body.phases.map((phase: any) => phase.projectPhaseId), selected);
      const listed = (await A("GET", `/api/leads/${fresh.id}/proposals`)).body.find((row: any) => row.id === saved.body.id);
      assert.equal(listed.phases.length, 2);
      assert.equal(listed.phases[0].feeLines.length, 0);
      assert.equal(listed.phases[1].feeLines[0].amount, "1500.00");
    });
    await t.test("proposals reuse shared values while issued financial basis and tasks survive later edits", async () => {
      proposal = (await A("POST", `/api/leads/${project.id}/proposals`, { name: "Reusable scope", selectedPhaseIds: [phase.id] })).body;
      assert.equal(proposal.phases[0].projectPhaseId, phase.id);
      assert.equal(proposal.phases[0].feeLines[0].amount, "1000.00");
      phase = (await M("PATCH", `${base}/phases/${phase.id}`, { version: phase.version, name: "Updated shared phase", timeline: "5 weeks", feeLines: [{ consultant: "Architecture", feeType: "Fixed", amount: "1200" }] })).body;
      let draft = (await A("GET", `/api/proposals/${proposal.id}`)).body;
      assert.equal(draft.phases[0].name, "Updated shared phase");
      assert.equal(draft.phases[0].timeline, "5 weeks");
      assert.equal(draft.phases[0].feeLines[0].amount, "1200.00");
      const setupBeforeSigning = (await A("GET", `/api/leads/${project.id}`)).body;
      proposal = (await A("POST", `/api/proposals/${proposal.id}/sign`, {})).body;
      assert.equal((await A("PATCH", `/api/leads/${project.id}/setup`, { version: setupBeforeSigning.setupVersion, status: "Lost" })).status, 409);
      assert.equal((await A("GET", `/api/leads/${project.id}`)).body.status, "Active Project");
      const feeId = proposal.phases[0].feeLines[0].id;
      assert.equal(proposal.phases[0].feeLines[0].amount, "1200.00");
      phase = (await M("PATCH", `${base}/phases/${phase.id}`, { version: phase.version, feeLines: [{ consultant: "Architecture", feeType: "Fixed", amount: "2000" }] })).body;
      assert.equal((await A("GET", `/api/proposals/${proposal.id}`)).body.phases[0].feeLines[0].amount, "1200.00");
      assert.equal((await A("POST", `/api/proposals/${proposal.id}/refresh-from-project`, {})).status, 400);
      assert.equal((await A("PATCH", `/api/proposals/${proposal.id}`, { selectedPhaseIds: [phase.id] })).status, 400);
      const invoice = await A("POST", `/api/leads/${project.id}/invoices`, { proposalId: proposal.id, feeLineInputs: [{ proposalFeeLineId: feeId, percentComplete: "50" }] });
      assert.equal(invoice.status, 200);
      assert.equal(invoice.body.feeLineSnapshots[0].currentBilling, "600.00");
      await db.update(proposals).set({ status: "Revision" }).where(eq(proposals.id, proposal.id));
      const legacyReversal = (await A("GET", `/api/proposals/${proposal.id}`)).body;
      assert.equal(legacyReversal.scopeLocked, true);
      assert.equal(legacyReversal.phases[0].feeLines[0].amount, "1200.00");
      assert.equal((await A("POST", `/api/proposals/${proposal.id}/refresh-from-project`, {})).status, 400);
      await db.update(proposals).set({ status: "Signed" }).where(eq(proposals.id, proposal.id));
      const spare = (await A("POST", `/api/leads/${project.id}/proposals`, { name: "Disposable document", selectedPhaseIds: [phase.id] })).body;
      assert.equal((await A("DELETE", `/api/proposals/${spare.id}`)).status, 200);
      const work = (await A("GET", base)).body;
      assert.ok(work.phases.some((p: any) => p.id === phase.id));
      assert.ok(work.tasks.some((r: any) => r.id === task.id));
    });
    await t.test("supporting billing retains cumulative signed amounts, additional services and one-time time/expense attachment", async () => {
      const feeId = proposal.phases[0].feeLines[0].id;
      const additional = await A("POST", `/api/leads/${project.id}/proposals`, {
        name: "Extra site visit", proposalType: "Additional Services", status: "Draft",
        additionalLineItems: [{ description: "Site visit", amount: "500", sortOrder: 0 }],
      });
      assert.equal(additional.status, 200);
      const approved = (await A("POST", `/api/proposals/${additional.body.id}/sign`, {})).body;
      const item = approved.additionalLineItems[0];
      const hours = (await M("POST", `/api/leads/${project.id}/hours`, {
        date: "2026-11-22", description: "Practice billing hours", hours: "2", ratePerHour: "100",
      })).body;
      const expense = (await M("POST", `/api/leads/${project.id}/expenses`, {
        date: "2026-11-22", expenseType: "Parking", amount: "20",
      })).body;
      const next = await A("POST", `/api/leads/${project.id}/invoices`, {
        proposalId: proposal.id, feeLineInputs: [{ proposalFeeLineId: feeId, percentComplete: "75" }],
        existingHoursIds: [hours.id], existingExpenseIds: [expense.id],
        additionalLineItemInputs: [{ additionalLineItemId: item.id, description: "Untrusted client text", amount: "999999", percentComplete: "40" }],
      });
      assert.equal(next.status, 200);
      assert.equal(next.body.feeLineSnapshots[0].currentBilling, "300.00");
      assert.equal(next.body.additionalLineItemSnapshots[0].currentBilling, "200.00");
      assert.equal(next.body.additionalLineItemSnapshots[0].amount, "500.00");
      assert.equal(next.body.additionalLineItemSnapshots[0].description, "Site visit");
      assert.equal(next.body.hoursEntries[0].id, hours.id);
      assert.equal(next.body.expenseEntries[0].id, expense.id);
      const total = Number(next.body.feeLineSnapshots[0].currentBilling)
        + Number(next.body.additionalLineItemSnapshots[0].currentBilling)
        + Number(next.body.hoursEntries[0].hours) * Number(next.body.hoursEntries[0].ratePerHour)
        + Number(next.body.expenseEntries[0].amount);
      assert.equal(total, 720); // 300 current Standard + 200 AS + 200 time + 20 parking
      const saved = (await A("GET", `/api/invoices/${next.body.id}`)).body;
      assert.equal(saved.hoursEntries[0].invoiceId, next.body.id);
      assert.equal(saved.expenseEntries[0].invoiceId, next.body.id);
      const metadata = await A("PATCH", `/api/proposals/${approved.id}`, { description: "Metadata only after billing" });
      assert.equal(metadata.status, 200);
      assert.equal(metadata.body.additionalLineItems[0].id, item.id);
      assert.equal(metadata.body.additionalLineItems[0].amount, "500.00");
      const count = (await A("GET", `/api/leads/${project.id}/invoices`)).body.length;
      assert.equal((await A("POST", `/api/leads/${project.id}/invoices`, {
        proposalId: proposal.id, existingHoursIds: [hours.id],
      })).status, 400);
      assert.equal((await A("POST", `/api/leads/${project.id}/invoices`, {
        proposalId: proposal.id, existingExpenseIds: [expense.id],
      })).status, 400);
      assert.equal((await A("GET", `/api/leads/${project.id}/invoices`)).body.length, count);
      const final = await A("POST", `/api/leads/${project.id}/invoices`, {
        proposalId: proposal.id, feeLineInputs: [{ proposalFeeLineId: feeId, percentComplete: "100" }],
        additionalLineItemInputs: [{ additionalLineItemId: item.id, description: item.description, amount: item.amount, percentComplete: "60" }],
      });
      assert.equal(final.status, 200);
      assert.equal(final.body.feeLineSnapshots[0].currentBilling, "300.00");
      assert.equal(final.body.additionalLineItemSnapshots[0].currentBilling, "100.00");
      assert.equal(final.body.hoursEntries.length, 0); assert.equal(final.body.expenseEntries.length, 0);
      assert.equal((await A("GET", `/api/proposals/${proposal.id}/billing-summary`)).body[feeId], 1200);
    });
    await t.test("empty proposal scope stays empty after priced phases are added, refresh, signing and status transitions", async () => {
      const emptySign = (await A("POST", `/api/leads/${project.id}/proposals`, { name: "Explicitly no scope", selectedPhaseIds: [] })).body;
      const emptyStatus = (await A("POST", `/api/leads/${project.id}/proposals`, { name: "Empty sent document", selectedPhaseIds: [] })).body;
      assert.deepEqual(emptySign.phases, []);
      assert.deepEqual(emptyStatus.phases, []);
      assert.equal((await A("POST", `${base}/phases`, {
        name: "Later priced phase", feeLines: [{ consultant: "Extra", feeType: "Fixed", amount: "7500" }],
      })).status, 201);
      const refreshed = await A("POST", `/api/proposals/${emptySign.id}/refresh-from-project`, {});
      assert.equal(refreshed.status, 200);
      assert.deepEqual(refreshed.body.phases, []);
      const signed = await A("POST", `/api/proposals/${emptySign.id}/sign`, {});
      assert.equal(signed.status, 200);
      assert.deepEqual(signed.body.phases, []);
      const sent = await A("PATCH", `/api/proposals/${emptyStatus.id}`, { status: "Sent" });
      assert.equal(sent.status, 200);
      assert.deepEqual(sent.body.phases, []);
      assert.deepEqual((await A("GET", `/api/proposals/${emptySign.id}`)).body.phases, []);
      assert.deepEqual((await A("GET", `/api/proposals/${emptyStatus.id}`)).body.phases, []);
    });
    await t.test("archived phases reject new assignments, tasks archive/restore, revoked assignees remain flagged", async () => {
      phase = (await A("PATCH", `${base}/phases/${phase.id}`, { version: phase.version, archived: true })).body;
      assert.equal((await M("POST", `${base}/tasks`, { title: "No archived phase", phaseId: phase.id })).status, 400);
      task = (await M("PATCH", `${base}/tasks/${task.id}`, { version: task.version, archived: true })).body;
      assert.equal(task.archived, true);
      task = (await M("PATCH", `${base}/tasks/${task.id}`, { version: task.version, archived: false })).body;
      assert.equal(task.phaseId, phase.id);
      await A("PUT", `/api/leads/${project.id}/assignments`, { userIds: [actors.get("owner")!.id] });
      assert.equal((await M("GET", base)).status, 404);
      const work = (await A("GET", base)).body;
      assert.equal(work.tasks.find((r: any) => r.id === task.id).assigneeEligible, false);
      assert.equal(work.tasks.find((r: any) => r.id === task.id).assigneeName, "Work member");
      assert.equal((await M("POST", `${base}/tasks/${task.id}/notes`, { content: "revoked", requestId: randomUUID() })).status, 404);
    });
    await t.test("legacy phase conflicts require explicit same-project source selection and retry does not duplicate", async () => {
      const p1 = (await db.insert(proposals).values({ leadId: hidden.id, name: "Legacy A" }).returning())[0];
      const p2 = (await db.insert(proposals).values({ leadId: hidden.id, name: "Legacy B", status: "Signed" }).returning())[0];
      for (const [p, amount] of [[p1, "300"], [p2, "900"]] as const) {
        const [ph] = await db.insert(proposalPhases).values({ proposalId: p.id, name: "Same name, conflicting fee" }).returning();
        await db.insert(proposalFeeLines).values({ phaseId: ph.id, consultant: "Architecture", amount });
      }
      // Use a fresh legacy project: hidden already has explicit shared work initialized.
      const [legacy] = await db.insert(leads).values({ workspaceId: firm, userId: actors.get("owner")!.id, projectName: "Legacy reconciliation" }).returning();
      await db.update(proposals).set({ leadId: legacy.id }).where(inArray(proposals.id, [p1.id, p2.id]));
      const legacyBase = `/api/leads/${legacy.id}/work`;
      const before = (await A("GET", legacyBase)).body;
      assert.equal(before.needsReconciliation, true);
      assert.equal(before.legacySources.length, 2);
      assert.equal((await A("POST", `${legacyBase}/phases`, { name: "Must not bypass" })).status, 409);
      assert.equal((await A("POST", `${legacyBase}/reconcile`, { proposalId: proposal.id })).status, 400);
      assert.equal((await A("POST", `${legacyBase}/reconcile`, { proposalId: p2.id })).status, 200);
      assert.equal((await A("POST", `${legacyBase}/reconcile`, { proposalId: p2.id })).status, 200);
      assert.equal((await A("POST", `${legacyBase}/reconcile`, { proposalId: p1.id })).status, 409);
      const after = (await A("GET", legacyBase)).body;
      assert.equal(after.needsReconciliation, false);
      assert.equal(after.phases.length, 1);
      assert.equal(after.phases[0].feeLines[0].amount, "900.00");
      assert.equal((await A("GET", `/api/proposals/${p1.id}`)).body.phases[0].feeLines[0].amount, "300.00");
      const original = (await A("GET", `/api/proposals/${p1.id}`)).body.phases[0];
      const metadata = {
        name: "Renamed legacy document", description: "Metadata only", status: "Draft",
        ...scopeSaveFields({ editing: true, locked: false, selectionChanged: false, selectedPhaseIds: [] }),
      };
      const renamed = await A("PATCH", `/api/proposals/${p1.id}`, metadata);
      assert.equal(renamed.status, 200);
      assert.equal(renamed.body.name, metadata.name);
      assert.equal(renamed.body.phases[0].id, original.id);
      assert.equal(renamed.body.phases[0].feeLines[0].id, original.feeLines[0].id);
      assert.equal(renamed.body.phases[0].feeLines[0].amount, "300.00");
      assert.throws(() => scopeRefreshIds(renamed.body.phases), /unmapped phases/);
      assert.equal((await A("POST", `/api/proposals/${p1.id}/refresh-from-project`, {})).status, 400);
      assert.equal((await A("PATCH", `/api/proposals/${p1.id}`, { status: "Sent" })).status, 400);
      assert.equal((await A("GET", `/api/proposals/${p1.id}`)).body.phases[0].feeLines[0].amount, "300.00");
      const intentionalEmpty = await A("PATCH", `/api/proposals/${p1.id}`, {
        ...scopeSaveFields({ editing: true, locked: false, selectionChanged: true, selectedPhaseIds: [] }),
      });
      assert.equal(intentionalEmpty.status, 200);
      assert.deepEqual(intentionalEmpty.body.phases, []);
    });
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.delete(leads).where(inArray(leads.workspaceId, workspaceIds));
    await db.delete(workspaces).where(inArray(workspaces.id, workspaceIds));
    await db.delete(users).where(inArray(users.id, userIds));
  }
});
test.after(async () => { await pool.end(); });
