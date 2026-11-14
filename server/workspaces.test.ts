import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import express from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "./db";
import { users, workspaces, workspaceMembers, workspaceInvitations, leads, companies, contacts } from "@shared/schema";
import { ensurePersonalWorkspace } from "./workspaces";
import { registerRoutes } from "./routes/index";

test("workspace migration preserves synthetic legacy records and is repeatable", async () => {
  const client = await pool.connect();
  const schema = `test_workspace_${randomUUID().replaceAll("-", "")}`;
  try {
    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET LOCAL search_path TO ${schema},public`);
    await client.query(`
      CREATE TABLE users (id varchar PRIMARY KEY,name text NOT NULL);
      CREATE TABLE profiles (id varchar,user_id varchar,name text,phone text,email text,address_line_1 text,address_line_2 text,
        city text,state text,zip text,created_at timestamp);
      CREATE TABLE leads (id serial PRIMARY KEY,user_id varchar,project_name text);
      CREATE TABLE companies (id varchar PRIMARY KEY,user_id varchar,name text);
      CREATE TABLE contacts (id varchar PRIMARY KEY,user_id varchar,full_name text);
      INSERT INTO users VALUES ('legacy-a','Legacy A'),('legacy-b','Legacy B');
      INSERT INTO profiles (id,user_id,name,phone) VALUES ('profile-a','legacy-a','Legacy Studio','555-0100');
      INSERT INTO leads (user_id,project_name) VALUES ('legacy-a','Keep me'),('legacy-b','Other company');
      INSERT INTO companies VALUES ('company-a','legacy-a','Keep Company');
      INSERT INTO contacts VALUES ('contact-a','legacy-a','Keep Contact');
    `);
    const migration = await readFile(new URL("../scripts/migrate-workspaces.sql", import.meta.url), "utf8");
    await client.query(migration);
    // Exercise upgrade from the original one-workspace-per-user constraint.
    await client.query("ALTER TABLE workspaces ALTER COLUMN legacy_owner_id SET NOT NULL");
    const before = await client.query("SELECT id,name,firm FROM workspaces ORDER BY legacy_owner_id");
    await client.query(migration);
    const after = await client.query("SELECT id,name,firm FROM workspaces ORDER BY legacy_owner_id");
    assert.deepEqual(after.rows, before.rows);
    const records = await client.query("SELECT id,project_name,workspace_id FROM leads ORDER BY id");
    assert.equal(records.rows.length, 2);
    assert.equal(records.rows[0].project_name, "Keep me");
    assert.notEqual(records.rows[0].workspace_id, records.rows[1].workspace_id);
    assert.equal(before.rows[0].firm.phone, "555-0100");
    assert.equal((await client.query("SELECT count(*) FROM workspace_members")).rows[0].count, "2");
    await client.query(`
      INSERT INTO workspaces (id,name,created_by_id,creation_request_id,creation_name)
      VALUES ('extra-firm','Second firm','legacy-a','creation-intent','Second firm'),
             ('empty-extra','Empty additional firm','legacy-a','other-intent','Empty additional firm');
      INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ('extra-firm','legacy-a','Owner');
      UPDATE workspaces SET firm='{"phone":"updated"}' WHERE legacy_owner_id='legacy-a';
    `);
    const expanded = (await client.query("SELECT * FROM workspaces ORDER BY id")).rows;
    await client.query(migration);
    assert.deepEqual((await client.query("SELECT * FROM workspaces ORDER BY id")).rows, expanded);
    assert.equal((await client.query("SELECT count(*) FROM workspace_members WHERE workspace_id='empty-extra'")).rows[0].count, "0");
    assert.equal((await client.query("SELECT count(*) FROM workspace_members WHERE workspace_id='extra-firm' AND role='Owner'")).rows[0].count, "1");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("workspace APIs enforce company isolation, assignments and invitations", async t => {
  const tag = randomUUID();
  const fixtureIds: string[] = [];
  const workspaceIds: string[] = [];
  const actors = new Map<string, typeof users.$inferSelect>();
  const makeUser = async (key: string, verified = true) => {
    const [user] = await db.insert(users).values({
      googleId: `workspace-test-${tag}-${key}`, email: `${key}-${tag}@example.invalid`,
      name: `Workspace Test ${key}`, emailVerified: verified, accessToken: "",
    }).returning();
    fixtureIds.push(user.id);
    actors.set(key, user);
    const workspace = await ensurePersonalWorkspace(user);
    workspaceIds.push(workspace.id);
    return { user, workspace };
  };
  const a = await makeUser("owner-a");
  const b = await makeUser("owner-b");
  const member = await makeUser("member");
  const noEmail = await makeUser("unverified", false);
  await db.insert(workspaceMembers).values({ workspaceId: a.workspace.id, userId: member.user.id, role: "Member" });
  const app = express();
  app.use(express.json());
  // Test-local authenticated transport, never mounted by the actual server.
  app.use((req, _res, next) => {
    req.user = actors.get(req.get("X-Test-Actor") || "");
    req.isAuthenticated = (() => !!req.user) as typeof req.isAuthenticated;
    next();
  });
  const server = await registerRoutes(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const api = async (actor: string, workspace: string, method: string, path: string, body?: unknown) => {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method, headers: { "X-Test-Actor": actor, "X-Workspace-Id": workspace, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() as any };
  };
  const A = (method: string, path: string, body?: unknown) => api("owner-a", a.workspace.id, method, path, body);
  const M = (method: string, path: string, body?: unknown) => api("member", a.workspace.id, method, path, body);
  const B = (method: string, path: string, body?: unknown) => api("owner-b", b.workspace.id, method, path, body);
  const project = async (request: typeof A, name: string) => {
    const result = await request("POST", "/api/leads", { projectName: name, probability: "HIGH", status: "Active Project" });
    assert.equal(result.status, 200);
    return result.body;
  };
  try {
    await t.test("firm creation validates input and authenticated creator identity", async () => {
      assert.equal((await api("unknown", a.workspace.id, "POST", "/api/workspaces", { name: "No auth", requestId: randomUUID() })).status, 401);
      for (const name of ["", "   ", "x".repeat(101)]) {
        assert.equal((await A("POST", "/api/workspaces", { name, requestId: randomUUID() })).status, 400);
      }
      assert.equal((await A("POST", "/api/workspaces", { name: "Bad key", requestId: "not-a-uuid" })).status, 400);
      assert.equal((await A("POST", "/api/workspaces", { name: "Spoof", requestId: randomUUID(), userId: b.user.id, role: "Owner" })).status, 400);
      const crossSite = await fetch(`http://127.0.0.1:${address.port}/api/workspaces`, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Test-Actor": "owner-a", "X-Workspace-Id": a.workspace.id, "Sec-Fetch-Site": "cross-site" },
        body: JSON.stringify({ name: "Cross site", requestId: randomUUID() }),
      });
      assert.equal(crossSite.status, 403);
    });
    await t.test("multiple firms have atomic ownership, empty records and concurrent safe retries", async () => {
      await A("PATCH", "/api/profile", { name: "Original Studio", phone: "555-0101" });
      const requestId = randomUUID();
      const results = await Promise.all(Array.from({ length: 3 }, () =>
        A("POST", "/api/workspaces", { name: "  Second Studio  ", requestId })));
      assert.ok(results.every(r => r.status === 201));
      const created = results[0].body.workspace;
      workspaceIds.push(created.id);
      assert.ok(results.every(r => r.body.workspace.id === created.id));
      assert.equal(created.name, "Second Studio");
      assert.equal(created.role, "Owner");
      const [stored] = await db.select().from(workspaces).where(eq(workspaces.id, created.id));
      assert.equal(stored.legacyOwnerId, null);
      assert.deepEqual(stored.firm, {});
      assert.equal((await ensurePersonalWorkspace(a.user)).id, a.workspace.id);
      const second = (method: string, path: string, body?: unknown) => api("owner-a", created.id, method, path, body);
      assert.deepEqual((await second("GET", "/api/leads")).body, []);
      assert.deepEqual((await second("GET", "/api/companies")).body, []);
      assert.deepEqual((await second("GET", "/api/contacts")).body, []);
      const profile = (await second("GET", "/api/profile")).body;
      assert.equal(profile.name, "Second Studio");
      assert.equal(profile.phone, null);
      assert.equal((await A("GET", "/api/profile")).body.phone, "555-0101");
      const team = (await second("GET", "/api/workspace/team")).body;
      assert.deepEqual(team.members.map((m: any) => [m.userId, m.role]), [[a.user.id, "Owner"]]);
      assert.deepEqual(team.invitations, []);
      assert.equal((await api("owner-b", created.id, "GET", "/api/workspace/team")).status, 403);
      assert.equal((await A("POST", "/api/workspaces", { name: "Different payload", requestId })).status, 409);
      await second("PATCH", "/api/workspace", { name: "Renamed Second Studio" });
      assert.equal((await A("POST", "/api/workspaces", { name: "Second Studio", requestId })).body.workspace.name, "Renamed Second Studio");
      const third = (await A("POST", "/api/workspaces", { name: "Third Studio", requestId: randomUUID() })).body.workspace;
      workspaceIds.push(third.id);
      const listing = (await A("GET", "/api/workspaces")).body;
      assert.equal(listing.active.id, a.workspace.id);
      assert.ok([a.workspace.id, created.id, third.id].every(id => listing.workspaces.some((w: any) => w.id === id && w.role === "Owner")));
      await db.delete(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, created.id), eq(workspaceMembers.userId, a.user.id)));
      assert.equal((await A("POST", "/api/workspaces", { name: "Second Studio", requestId })).status, 403);
      assert.equal((await db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, created.id))).length, 0);
    });
    await t.test("a current member can create a firm without gaining ownership of their employer", async () => {
      const requestId = randomUUID();
      const created = await M("POST", "/api/workspaces", { name: "Member's Independent Firm", requestId });
      assert.equal(created.status, 201);
      workspaceIds.push(created.body.workspace.id);
      assert.equal(created.body.workspace.role, "Owner");
      assert.equal((await M("GET", "/api/workspace/team")).status, 403);
      assert.equal((await api("member", created.body.workspace.id, "GET", "/api/workspace/team")).status, 200);
      const memberships = (await M("GET", "/api/workspaces")).body.workspaces;
      assert.equal(memberships.find((w: any) => w.id === a.workspace.id).role, "Member");
      assert.equal(memberships.find((w: any) => w.id === created.body.workspace.id).role, "Owner");
      const otherCreator = await A("POST", "/api/workspaces", { name: "Same key, different creator", requestId });
      workspaceIds.push(otherCreator.body.workspace.id);
      assert.equal(otherCreator.status, 201);
      assert.notEqual(otherCreator.body.workspace.id, created.body.workspace.id);
      const newFirm = (method: string, path: string, body?: unknown) =>
        api("member", created.body.workspace.id, method, path, body);
      const invitedOwner = (method: string, path: string, body?: unknown) =>
        api("owner-a", created.body.workspace.id, method, path, body);
      const invitation = (await newFirm("POST", "/api/workspace/invitations", { email: a.user.email })).body;
      assert.equal((await A("POST", "/api/invitations/accept", { token: invitation.token })).status, 200);
      assert.equal((await invitedOwner("GET", "/api/workspace/team")).status, 403);
      const assigned = await project(newFirm, "Assigned in additional firm");
      const hidden = await project(newFirm, "Hidden in additional firm");
      assert.equal((await newFirm("PUT", `/api/leads/${assigned.id}/assignments`, { userIds: [a.user.id] })).status, 200);
      assert.deepEqual((await invitedOwner("GET", "/api/leads")).body.map((p: any) => p.id), [assigned.id]);
      assert.equal((await invitedOwner("GET", `/api/leads/${hidden.id}`)).status, 404);
      assert.equal((await invitedOwner("PATCH", "/api/workspace", { name: "Forbidden" })).status, 403);
      assert.equal((await newFirm("PUT", `/api/leads/${assigned.id}/assignments`, { userIds: [b.user.id] })).status, 400);
    });
    await t.test("failed owner membership insertion rolls back creation and permits a safe retry", async t => {
      const requestId = randomUUID();
      const transact = db.transaction.bind(db);
      const injected = t.mock.method(db, "transaction", (async (callback: any) => transact(async tx => {
        const insert = tx.insert.bind(tx);
        tx.insert = ((table: any) => {
          if (table === workspaceMembers) throw new Error("Synthetic membership insertion failure");
          return insert(table);
        }) as typeof tx.insert;
        return callback(tx);
      })) as typeof db.transaction);
      try {
        const failed = await A("POST", "/api/workspaces", { name: "Atomic Test Studio", requestId });
        assert.equal(failed.status, 500);
      } finally { injected.mock.restore(); }
      assert.equal((await db.select().from(workspaces).where(and(
        eq(workspaces.createdById, a.user.id), eq(workspaces.creationRequestId, requestId),
      ))).length, 0);
      const retry = await A("POST", "/api/workspaces", { name: "Atomic Test Studio", requestId });
      assert.equal(retry.status, 201);
      workspaceIds.push(retry.body.workspace.id);
      assert.equal((await api("owner-a", retry.body.workspace.id, "GET", "/api/workspace/team")).body.members[0].role, "Owner");
    });
    const assigned = await project(A, "Assigned A");
    const hidden = await project(A, "Hidden A");
    const other = await project(B, "Company B");
    await t.test("members with no assignments see no projects or totals", async () => {
      assert.deepEqual((await M("GET", "/api/leads")).body, []);
      const stats = (await M("GET", "/api/dashboard")).body;
      assert.deepEqual(stats.leadsByStatus, {});
      assert.deepEqual(stats.recentLeads, []);
      assert.equal(stats.sentInvoicesTotal, 0);
      assert.equal((await M("GET", `/api/leads/${assigned.id}`)).status, 404);
    });
    await A("PUT", `/api/leads/${assigned.id}/assignments`, { userIds: [member.user.id] });
    await t.test("assigned projects only; cross-company memberships are rejected", async () => {
      assert.deepEqual((await M("GET", "/api/leads")).body.map((p: any) => p.id), [assigned.id]);
      assert.deepEqual((await M("GET", "/api/dashboard")).body.recentLeads.map((p: any) => p.id), [assigned.id]);
      assert.equal((await M("GET", `/api/leads/${assigned.id}`)).status, 200);
      assert.equal((await M("GET", `/api/leads/${hidden.id}`)).status, 404);
      assert.equal((await M("PATCH", `/api/leads/${hidden.id}`, { projectName: "tamper" })).status, 404);
      assert.equal((await M("GET", `/api/leads/${other.id}`)).status, 404);
      assert.equal((await api("owner-b", a.workspace.id, "GET", "/api/leads")).status, 403);
      const invalid = await A("PUT", `/api/leads/${assigned.id}/assignments`, { userIds: [b.user.id] });
      assert.equal(invalid.status, 400);
      assert.equal((await M("GET", `/api/leads/${assigned.id}`)).status, 200);
    });
    await t.test("members cannot change access or delete financial/project records", async () => {
      assert.equal((await M("GET", "/api/workspace/team")).status, 403);
      assert.equal((await M("POST", "/api/workspace/invitations", { email: b.user.email })).status, 403);
      assert.equal((await M("PUT", `/api/leads/${assigned.id}/assignments`, { userIds: [member.user.id] })).status, 403);
      assert.equal((await M("DELETE", `/api/leads/${assigned.id}`)).status, 403);
      assert.equal((await M("DELETE", "/api/proposals/fake")).status, 403);
      assert.equal((await M("DELETE", "/api/invoices/fake")).status, 403);
      assert.equal((await M("POST", "/api/contacts", { fullName: "Forbidden" })).status, 403);
    });
    await t.test("member-created projects are assigned automatically; ownership fields are ignored", async () => {
      const own = await project(M, "Member-created");
      assert.equal(own.workspaceId, a.workspace.id);
      assert.equal((await M("GET", `/api/leads/${own.id}`)).status, 200);
      const result = await M("PATCH", `/api/leads/${own.id}`, { workspaceId: b.workspace.id, userId: b.user.id });
      assert.equal(result.body.workspaceId, a.workspace.id);
      assert.equal(result.body.userId, member.user.id);
    });
    await t.test("address book filters nested relationships as well as top-level records", async () => {
      const visibleCompany = (await A("POST", "/api/companies", { name: "Visible" })).body;
      const hiddenCompany = (await A("POST", "/api/companies", { name: "Hidden" })).body;
      const visibleContact = (await A("POST", "/api/contacts", { fullName: "Visible", companyIds: [visibleCompany.id, hiddenCompany.id] })).body;
      const hiddenContact = (await A("POST", "/api/contacts", { fullName: "Hidden", companyIds: [visibleCompany.id] })).body;
      assert.equal((await A("PATCH", `/api/leads/${assigned.id}`, { companies: [{ companyRole: "Client", companyId: visibleCompany.id, contactId: visibleContact.id }] })).status, 200);
      await A("PATCH", `/api/leads/${hidden.id}`, { companies: [{ companyRole: "Client", companyId: hiddenCompany.id, contactId: hiddenContact.id }] });
      const cos = (await M("GET", "/api/companies")).body;
      assert.deepEqual(cos.map((c: any) => c.id), [visibleCompany.id]);
      assert.deepEqual(cos[0].contacts.map((c: any) => c.id), [visibleContact.id]);
      const people = (await M("GET", "/api/contacts")).body;
      assert.deepEqual(people.map((c: any) => c.id), [visibleContact.id]);
      assert.deepEqual(people[0].companies.map((c: any) => c.id), [visibleCompany.id]);
      const before = (await M("GET", `/api/leads/${assigned.id}`)).body;
      const rejected = await M("PATCH", `/api/leads/${assigned.id}`, { projectName: "Must not persist", companies: [{ companyRole: "Client", companyId: hiddenCompany.id }] });
      assert.notEqual(rejected.status, 200);
      const after = (await M("GET", `/api/leads/${assigned.id}`)).body;
      assert.equal(after.projectName, before.projectName);
      assert.deepEqual(after.companies, before.companies);
      const malformed = await M("PATCH", `/api/leads/${assigned.id}`, { projectName: "Invalid shape must not persist", companies: [{ companyRole: "Client", companyId: 123 }] });
      assert.notEqual(malformed.status, 200);
      assert.equal((await M("GET", `/api/leads/${assigned.id}`)).body.projectName, before.projectName);
      assert.equal((await A("POST", "/api/companies", { name: "Invalid cross company", contactIds: [b.user.id] })).status, 400);
    });
    let privateProposal: any;
    let publicProposal: any;
    let privateInvoice: any;
    await t.test("proposal, invoice, time, notes and save-back inherit project access", async () => {
      const phases = [{ name: "Schematic Design", sortOrder: 0, feeLines: [{ consultant: "Interior Design", feeType: "Fixed", amount: "1000", sortOrder: 0 }] }];
      privateProposal = (await A("POST", `/api/leads/${hidden.id}/proposals`, { name: "Private", status: "Signed", phases })).body;
      publicProposal = (await M("POST", `/api/leads/${assigned.id}/proposals`, { name: "Visible", status: "Signed", phases })).body;
      assert.ok(publicProposal.id);
      privateInvoice = (await A("POST", `/api/leads/${hidden.id}/invoices`, { proposalId: privateProposal.id, feeLineInputs: [], hoursInputs: [], expenseInputs: [] })).body;
      assert.ok(privateInvoice.id);
      assert.equal((await M("GET", `/api/proposals/${privateProposal.id}`)).status, 404);
      assert.equal((await M("GET", `/api/proposals/${privateProposal.id}/consultant-contracts`)).status, 404);
      assert.equal((await M("PATCH", `/api/proposals/${privateProposal.id}`, { docUrl: "https://example.invalid" })).status, 404);
      assert.equal((await M("GET", `/api/invoices/${privateInvoice.id}`)).status, 404);
      assert.equal((await M("PATCH", `/api/invoices/${privateInvoice.id}/doc-url`, { docUrl: "https://example.invalid" })).status, 404);
      assert.deepEqual((await M("GET", `/api/leads/${hidden.id}/comments`)).body, []);
      assert.notEqual((await M("POST", `/api/leads/${hidden.id}/comments`, { content: "forbidden" })).status, 200);
      const entry = (await A("POST", `/api/leads/${hidden.id}/hours`, { date: "2026-11-11", description: "Private", hours: "1", ratePerHour: "10" })).body;
      assert.ok(entry.id);
      assert.equal((await M("PATCH", `/api/hours/${entry.id}`, { hours: "5" })).status, 404);
      assert.equal((await M("DELETE", `/api/hours/${entry.id}`)).status, 404);
    });
    await t.test("cross-parent invoices, fee lines and time attachment are rejected", async () => {
      const invalidProposal = await M("POST", `/api/leads/${assigned.id}/invoices`, { proposalId: privateProposal.id, feeLineInputs: [], hoursInputs: [], expenseInputs: [] });
      assert.notEqual(invalidProposal.status, 200);
      const invalidFee = await M("POST", `/api/leads/${assigned.id}/invoices`, { proposalId: publicProposal.id,
        feeLineInputs: [{ proposalFeeLineId: privateProposal.phases[0].feeLines[0].id, percentComplete: "50" }], hoursInputs: [], expenseInputs: [] });
      assert.notEqual(invalidFee.status, 200);
      const forgedExtra = await M("POST", `/api/leads/${assigned.id}/invoices`, { proposalId: publicProposal.id,
        feeLineInputs: [], hoursInputs: [], expenseInputs: [], additionalLineItemInputs: [{ additionalLineItemId: privateProposal.id, description: "forged", amount: "1", percentComplete: "100" }] });
      assert.notEqual(forgedExtra.status, 200);
      assert.notEqual((await M("POST", `/api/leads/${assigned.id}/hours`, { invoiceId: privateInvoice.id,
        date: "2026-11-11", description: "forged", hours: "1", ratePerHour: "10" })).status, 200);
      const privateTime = (await A("GET", `/api/leads/${hidden.id}/hours`)).body;
      assert.ok(privateTime[0]?.id);
      const foreignTime = await M("POST", `/api/leads/${assigned.id}/invoices`, { proposalId: publicProposal.id,
        feeLineInputs: [], hoursInputs: [], expenseInputs: [], existingHoursIds: [privateTime[0].id] });
      assert.notEqual(foreignTime.status, 200);
      const foreignExpense = await M("POST", `/api/leads/${assigned.id}/invoices`, { proposalId: publicProposal.id,
        feeLineInputs: [], hoursInputs: [], expenseInputs: [], existingExpenseIds: ["unavailable-expense"] });
      assert.notEqual(foreignExpense.status, 200);
    });
    await t.test("workspace firm details are shared but only owner-editable; contacts remain personal", async () => {
      assert.equal((await A("PATCH", "/api/profile", { name: "Shared Studio", phone: "555-0111", contactName: "Owner Contact" })).status, 200);
      assert.equal((await M("GET", "/api/profile")).body.name, "Shared Studio");
      assert.notEqual((await M("PATCH", "/api/profile", { name: "Stolen Studio" })).status, 200);
      assert.equal((await M("PATCH", "/api/profile", { name: "Shared Studio", contactName: "Member Contact" })).status, 200);
      assert.equal((await A("GET", "/api/profile")).body.contactName, "Owner Contact");
      assert.equal((await M("GET", "/api/profile")).body.contactName, "Member Contact");
    });
    await t.test("invitations are email-bound, verified, single use, and revocable", async () => {
      const invitation = (await A("POST", "/api/workspace/invitations", { email: b.user.email.toUpperCase() })).body;
      assert.ok(invitation.token);
      assert.equal((await M("POST", "/api/invitations/accept", { token: invitation.token })).status, 403);
      assert.equal((await B("POST", "/api/invitations/accept", { token: invitation.token })).status, 200);
      assert.equal((await B("POST", "/api/invitations/accept", { token: invitation.token })).status, 400);
      const unverified = (await A("POST", "/api/workspace/invitations", { email: noEmail.user.email })).body;
      assert.equal((await api("unverified", noEmail.workspace.id, "POST", "/api/invitations/accept", { token: unverified.token })).status, 403);
      const revoked = (await A("POST", "/api/workspace/invitations", { email: b.user.email })).body;
      await A("POST", `/api/workspace/invitations/${revoked.invitation.id}/revoke`);
      assert.equal((await B("POST", "/api/invitations/accept", { token: revoked.token })).status, 400);
      const expired = (await A("POST", "/api/workspace/invitations", { email: b.user.email })).body;
      await db.update(workspaceInvitations).set({ expiresAt: new Date(0) }).where(eq(workspaceInvitations.id, expired.invitation.id));
      assert.equal((await B("POST", "/api/invitations/accept", { token: expired.token })).status, 400);
      const list = (await A("GET", "/api/workspace/team")).body;
      assert.ok(list.members.some((m: any) => m.userId === b.user.id));
      assert.ok(!JSON.stringify(list).includes("tokenHash"));
    });
    await t.test("last owner cannot be removed or demoted", async () => {
      assert.equal((await A("DELETE", `/api/workspace/members/${a.user.id}`)).status, 403);
      assert.equal((await A("PATCH", `/api/workspace/members/${a.user.id}`, { role: "Member" })).status, 403);
    });
    await t.test("unassignment and removal take effect on the next request", async () => {
      await A("PUT", `/api/leads/${assigned.id}/assignments`, { userIds: [] });
      assert.equal((await M("GET", `/api/leads/${assigned.id}`)).status, 404);
      assert.equal((await M("GET", `/api/proposals/${publicProposal.id}`)).status, 404);
      assert.equal((await A("DELETE", `/api/workspace/members/${member.user.id}`)).status, 200);
      assert.equal((await M("GET", "/api/leads")).status, 403);
      assert.equal((await api("member", member.workspace.id, "GET", "/api/leads")).status, 200);
    });
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.delete(leads).where(inArray(leads.workspaceId, workspaceIds));
    await db.delete(companies).where(inArray(companies.workspaceId, workspaceIds));
    await db.delete(contacts).where(inArray(contacts.workspaceId, workspaceIds));
    await db.delete(workspaces).where(inArray(workspaces.id, workspaceIds));
    await db.delete(users).where(inArray(users.id, fixtureIds));
  }
});

test.after(async () => { await pool.end(); });
