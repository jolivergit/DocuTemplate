import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import express from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "./db";
import { users, workspaces, workspaceMembers, leads, projectAssignments, companies, contacts } from "@shared/schema";
import { ensurePersonalWorkspace } from "./workspaces";
import { registerRoutes } from "./routes/index";
import { PROJECT_ROLES, teamInput } from "@shared/project-setup";

test("project role input supports multiple people and roles, not invalid combinations", () => {
  assert.equal(teamInput.safeParse({ version: 1, members: [
    { userId: "a", assigned: true, roles: [...PROJECT_ROLES] },
    { userId: "b", assigned: true, roles: [...PROJECT_ROLES] },
  ] }).success, true);
  for (const members of [
    [{ userId: "a", assigned: true, roles: ["Owner"] }],
    [{ userId: "a", assigned: true, roles: ["Designer", "Designer"] }],
    [{ userId: "a", assigned: false, roles: ["Project Admin"] }],
    [{ userId: "a", assigned: true, roles: [] }, { userId: "a", assigned: true, roles: [] }],
  ]) assert.equal(teamInput.safeParse({ version: 1, members }).success, false);
});

test("setup migration is additive and repeatable without guessing old roles", async () => {
  const client = await pool.connect();
  const schema = `setup_test_${randomUUID().replaceAll("-", "")}`;
  try {
    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema},public`);
    await client.query(`CREATE TABLE leads(id integer PRIMARY KEY, project_name text);
      CREATE TABLE project_assignments(id varchar PRIMARY KEY,lead_id integer,member_id varchar);
      INSERT INTO leads VALUES(1,'Keep project'); INSERT INTO project_assignments VALUES('old',1,'existing');`);
    const migration = await readFile(new URL("../scripts/migrate-project-setup.sql", import.meta.url), "utf8");
    await client.query(migration);
    assert.deepEqual((await client.query("SELECT roles FROM project_assignments")).rows[0].roles, []);
    assert.equal((await client.query("SELECT setup_complete FROM leads")).rows[0].setup_complete, false);
    await client.query(`UPDATE leads SET general_timeline='8–10 weeks',setup_complete=true;
      UPDATE project_assignments SET roles='["Project Admin","Designer"]'::jsonb`);
    await client.query(migration);
    assert.deepEqual((await client.query("SELECT roles FROM project_assignments")).rows[0].roles, ["Project Admin", "Designer"]);
    assert.equal((await client.query("SELECT general_timeline FROM leads")).rows[0].general_timeline, "8–10 weeks");
    assert.equal((await client.query("SELECT project_name FROM leads")).rows[0].project_name, "Keep project");
  } finally {
    await client.query("ROLLBACK"); client.release();
  }
});

test("inline setup and project roles preserve firm and assigned-project boundaries", async t => {
  const tag = randomUUID(), actorMap = new Map<string, typeof users.$inferSelect>();
  const userIds: string[] = [], firmIds: string[] = [];
  for (const key of ["owner", "admin", "second", "manager", "designer", "unassigned", "foreign"]) {
    const [user] = await db.insert(users).values({
      googleId: `setup-${tag}-${key}`, email: `${key}-${tag}@example.invalid`, name: `Setup ${key}`, accessToken: "", emailVerified: true,
    }).returning();
    actorMap.set(key, user); userIds.push(user.id);
    firmIds.push((await ensurePersonalWorkspace(user)).id);
  }
  const firm = firmIds[0], foreignFirm = firmIds[6];
  for (const key of ["admin", "second", "manager", "designer", "unassigned"])
    await db.insert(workspaceMembers).values({ workspaceId: firm, userId: actorMap.get(key)!.id, role: "Member" });
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => {
    req.user = actorMap.get(req.get("X-Test-Actor") || "");
    req.isAuthenticated = (() => !!req.user) as typeof req.isAuthenticated; next();
  });
  const server = await registerRoutes(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const api = async (actor: string, method: string, path: string, body?: unknown, workspace = firm) => {
    const r = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers: { "X-Test-Actor": actor, "X-Workspace-Id": workspace, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, body: await r.json() as any };
  };
  const row = (key: string, roles: string[]) => ({ userId: actorMap.get(key)!.id, assigned: true, roles });
  const teamFor = async (id: number) => (await api("owner", "GET", `/api/leads/${id}/team`)).body;
  try {
    const created = await api("admin", "POST", "/api/leads", { projectName: "Minimal setup", setupComplete: true, workspaceId: foreignFirm });
    assert.equal(created.status, 200);
    const id = created.body.id, base = `/api/leads/${id}`;
    const hidden = (await api("owner", "POST", "/api/leads", { projectName: "Unassigned other project" })).body;
    const foreign = (await api("foreign", "POST", "/api/leads", { projectName: "Other firm" }, foreignFirm)).body;
    let team = await teamFor(id);
    await t.test("minimal creation assigns project admin without firm promotion", async () => {
      assert.equal(created.body.status, "Lead"); assert.equal(created.body.probability, "LOW");
      assert.equal(created.body.workspaceId, firm); assert.equal(created.body.setupComplete, false);
      assert.deepEqual(team.members.find((m: any) => m.userId === actorMap.get("admin")!.id).roles, ["Project Admin"]);
      assert.equal((await api("admin", "GET", `${base}/team`)).body.canManage, true);
      assert.equal((await api("admin", "GET", "/api/workspace/team")).status, 403);
      assert.equal((await api("admin", "DELETE", base)).status, 403);
      assert.equal((await api("admin", "GET", `/api/leads/${hidden.id}`)).status, 404);
      assert.equal((await api("admin", "GET", `/api/leads/${foreign.id}/team`)).status, 404);
      assert.equal((await api("unassigned", "GET", `${base}/team`)).status, 404);
      assert.equal((await api("foreign", "GET", `${base}/team`)).status, 403);
      assert.equal((await api("unknown", "GET", `${base}/team`)).status, 401);
    });
    await t.test("multiple users per role and multi-role users persist with stable access IDs and safe retry", async () => {
      const before = await db.select().from(projectAssignments).where(eq(projectAssignments.leadId, id));
      const payload = { version: team.version, members: [
        row("admin", ["Project Admin", "Project Manager"]), row("second", ["Project Admin", "Designer"]),
        row("manager", ["Project Manager", "Designer"]), row("designer", ["Designer"]),
      ] };
      const saved = await api("admin", "PUT", `${base}/team`, payload);
      assert.equal(saved.status, 200); team = saved.body;
      for (const role of PROJECT_ROLES) assert.ok(team.members.filter((m: any) => m.roles.includes(role)).length >= 2);
      const after = await db.select().from(projectAssignments).where(eq(projectAssignments.leadId, id));
      assert.equal(after.length, 4);
      assert.equal(after.find(a => a.memberId === before[0].memberId)!.id, before[0].id);
      const retry = await api("admin", "PUT", `${base}/team`, payload);
      assert.equal(retry.status, 200); assert.equal(retry.body.version, team.version);
      assert.equal((await api("admin", "PUT", `${base}/team`, { ...payload, members: [row("admin", ["Project Admin"])] })).status, 409);
      assert.equal((await api("admin", "PUT", `${base}/team`, { version: team.version, members: [row("foreign", ["Project Admin"])] })).status, 400);
      assert.equal((await api("admin", "PUT", `${base}/team`, { version: team.version, members: [row("admin", ["Owner"])] })).status, 400);
      const competing = await Promise.all([
        api("admin", "PUT", `${base}/team`, { version: team.version, members: payload.members.map(m => m.userId === actorMap.get("admin")!.id ? row("admin", [...PROJECT_ROLES]) : m) }),
        api("second", "PUT", `${base}/team`, { version: team.version, members: payload.members.map(m => m.userId === actorMap.get("second")!.id ? row("second", [...PROJECT_ROLES]) : m) }),
      ]);
      assert.deepEqual(competing.map(r => r.status).sort(), [200, 409], "concurrent rosters serialize without lost updates");
      team = await teamFor(id);
    });
    await t.test("project managers and designers keep ordinary editing but cannot administer the team or firm", async () => {
      for (const actor of ["manager", "designer"]) {
        const read = await api(actor, "GET", `${base}/team`);
        assert.equal(read.status, 200); assert.equal(read.body.canManage, false);
        assert.equal(read.body.members.length, 4);
        assert.ok(read.body.members.every((m: any) => m.assigned && m.email === undefined));
        assert.equal((await api(actor, "PUT", `${base}/team`, { version: team.version, members: [row(actor, ["Project Admin"])] })).status, 403);
        const lead = (await api(actor, "GET", base)).body;
        assert.equal((await api(actor, "PATCH", `${base}/setup`, { version: lead.setupVersion, description: `${actor} update` })).status, 200);
        const latest = (await api(actor, "GET", base)).body;
        assert.equal((await api(actor, "PATCH", `${base}/setup`, { version: latest.setupVersion, setupComplete: true })).status, 403);
        assert.equal((await api(actor, "POST", "/api/workspace/invitations", { email: "nobody@example.invalid" })).status, 403);
      }
    });
    await t.test("project admin can select firm address records without gaining global address administration", async () => {
      const co = (await api("owner", "POST", "/api/companies", { name: "Setup partner" })).body;
      const ct = (await api("owner", "POST", "/api/contacts", { fullName: "Setup contact", companyIds: [co.id] })).body;
      const other = (await api("foreign", "POST", "/api/companies", { name: "Forbidden" }, foreignFirm)).body;
      assert.ok(!(await api("admin", "GET", "/api/companies")).body.some((r: any) => r.id === co.id));
      const options = (await api("admin", "GET", `${base}/setup-options`)).body;
      assert.ok(options.companies.some((r: any) => r.id === co.id));
      assert.ok(options.contacts.some((r: any) => r.id === ct.id));
      assert.ok(!options.companies.some((r: any) => r.id === other.id));
      assert.ok(!(await api("manager", "GET", `${base}/setup-options`)).body.companies.some((r: any) => r.id === co.id));
      assert.equal((await api("admin", "POST", "/api/companies", { name: "Not a firm owner" })).status, 403);
      let lead = (await api("admin", "GET", base)).body;
      const saved = await api("admin", "PATCH", `${base}/setup`, {
        version: lead.setupVersion, generalTimeline: "8–10 weeks", companies: [
          { companyRole: "Custom collaborator", companyId: co.id, contactId: ct.id },
          { companyRole: "Custom collaborator", companyName: "Second same-role partner" },
        ],
      });
      assert.equal(saved.status, 200); assert.equal(saved.body.companies.length, 2);
      assert.equal(saved.body.companies[0].linkedContact.fullName, "Setup contact");
      const stale = await api("admin", "PATCH", `${base}/setup`, { version: lead.setupVersion, companies: [] });
      assert.equal(stale.status, 409);
      lead = saved.body;
      assert.equal((await api("admin", "PATCH", `${base}/setup`, { version: lead.setupVersion, projectName: "Must rollback", companies: [{ companyRole: "Bad", companyId: other.id }] })).status, 403);
      const completed = await api("admin", "PATCH", `${base}/setup`, { version: lead.setupVersion, setupComplete: true });
      assert.equal(completed.status, 200); assert.equal(completed.body.setupComplete, true);
      assert.equal(completed.body.companies.length, 2); assert.equal(completed.body.generalTimeline, "8–10 weeks");
      assert.notEqual(completed.body.projectName, "Must rollback");
      assert.equal((await api("admin", "PATCH", `${base}/setup`, { version: completed.body.setupVersion, generalTimeline: null })).body.generalTimeline, null);
    });
    await t.test("last admin protection applies to team, old access endpoint and firm removal; owner recovers legacy", async () => {
      team = await teamFor(id);
      const oneAdmin = await api("second", "PUT", `${base}/team`, { version: team.version, members: [row("admin", ["Project Admin"]), row("second", ["Designer"])] });
      assert.equal(oneAdmin.status, 200); team = oneAdmin.body;
      assert.equal((await api("admin", "PUT", `${base}/team`, { version: team.version, members: [row("second", ["Designer"])] })).status, 409);
      assert.equal((await api("owner", "PUT", `${base}/assignments`, { userIds: [] })).status, 409);
      assert.equal((await api("owner", "DELETE", `/api/workspace/members/${actorMap.get("admin")!.id}`)).status, 409);
      // Simulate a genuinely pre-role project, not guessed migration assignments.
      const [legacy] = await db.insert(leads).values({ projectName: "Old no-admin project", workspaceId: firm, userId: actorMap.get("owner")!.id }).returning();
      const [member] = await db.select().from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, firm), eq(workspaceMembers.userId, actorMap.get("designer")!.id)));
      await db.insert(projectAssignments).values({ leadId: legacy.id, memberId: member.id });
      const oldTeam = await teamFor(legacy.id);
      assert.equal(oldTeam.hasAdmin, false);
      assert.equal((await api("designer", "GET", `/api/leads/${legacy.id}`)).status, 200);
      assert.deepEqual(oldTeam.members.find((m: any) => m.assigned).roles, []);
      assert.equal((await api("owner", "PATCH", `/api/leads/${legacy.id}/setup`, { version: 1, setupComplete: true })).status, 409);
      const repaired = await api("owner", "PUT", `/api/leads/${legacy.id}/team`, { version: oldTeam.version, members: [row("designer", ["Project Admin"])] });
      assert.equal(repaired.status, 200);
      assert.equal((await api("designer", "GET", `/api/leads/${legacy.id}/team`)).body.canManage, true);
    });
    await t.test("admin can transfer responsibility and remove own access; revocation takes effect immediately", async () => {
      team = await teamFor(id);
      const transferred = await api("admin", "PUT", `${base}/team`, { version: team.version, members: [row("second", ["Project Admin"])] });
      assert.equal(transferred.status, 200); assert.deepEqual(transferred.body.members, []);
      assert.equal((await api("admin", "GET", base)).status, 404);
      assert.equal((await api("admin", "PUT", `${base}/team`, { version: transferred.body.version, members: [row("admin", ["Project Admin"])] })).status, 404);
      assert.equal((await api("second", "GET", `${base}/team`)).body.canManage, true);
      assert.equal((await api("second", "GET", "/api/workspace/team")).status, 403);
    });
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.delete(leads).where(inArray(leads.workspaceId, firmIds));
    await db.delete(contacts).where(inArray(contacts.workspaceId, firmIds));
    await db.delete(companies).where(inArray(companies.workspaceId, firmIds));
    await db.delete(workspaces).where(inArray(workspaces.id, firmIds));
    await db.delete(users).where(inArray(users.id, userIds));
  }
});
test.after(async () => { await pool.end(); });
