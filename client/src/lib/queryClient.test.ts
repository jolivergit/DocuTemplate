import { test } from "node:test";
import { strict as assert } from "node:assert";
import { apiRequest, ApiError, getQueryFn, setActiveWorkspaceId } from "./queryClient";

test("Google reconnect errors show readable text and retain machine-readable status", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: "Reconnect Google Docs; your work has been kept.",
    code: "GOOGLE_DOCS_RECONNECT_REQUIRED",
  }), { status: 403, headers: { "Content-Type": "application/json" } });
  try {
    await assert.rejects(apiRequest("POST", "/api/documents/generate"), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 403);
      assert.equal(error.code, "GOOGLE_DOCS_RECONNECT_REQUIRED");
      assert.equal(error.message, "Reconnect Google Docs; your work has been kept.");
      assert.ok(!error.message.includes("{"));
      return true;
    });
  } finally {
    globalThis.fetch = original;
  }
});

test("API writes carry the selected workspace and reject responses after a switch", async () => {
  const original = globalThis.fetch;
  setActiveWorkspaceId("workspace-a");
  globalThis.fetch = async (_url, init) => {
    assert.equal(new Headers(init?.headers).get("X-Workspace-Id"), "workspace-a");
    setActiveWorkspaceId("workspace-b");
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  try {
    await assert.rejects(apiRequest("POST", "/api/leads", {}), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, "WORKSPACE_CHANGED");
      return true;
    });
  } finally {
    setActiveWorkspaceId(null);
    globalThis.fetch = original;
  }
});

test("API writes reject a workspace switch while the response body is still loading", async () => {
  const original = globalThis.fetch;
  setActiveWorkspaceId("workspace-a");
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => {
      setActiveWorkspaceId("workspace-b");
      return { privateRecord: "belongs-to-a" };
    },
  } as Response);
  try {
    await assert.rejects(apiRequest("POST", "/api/leads", {}), (error: unknown) =>
      error instanceof ApiError && error.code === "WORKSPACE_CHANGED");
  } finally { setActiveWorkspaceId(null); globalThis.fetch = original; }
});

test("late or cancelled query responses cannot populate another firm's cache", async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  const query = getQueryFn({ on401: "throw" });
  const context = { queryKey: ["/api/leads"], signal: controller.signal } as Parameters<typeof query>[0];
  try {
    for (const abort of [false, true]) {
      setActiveWorkspaceId("workspace-a");
      globalThis.fetch = async (_url, init) => {
        assert.equal(new Headers(init?.headers).get("X-Workspace-Id"), "workspace-a");
        return {
          ok: true,
          json: async () => {
            if (abort) controller.abort();
            else setActiveWorkspaceId("workspace-b");
            return [{ projectName: "Private A" }];
          },
        } as Response;
      };
      await assert.rejects(query(context), (error: unknown) =>
        error instanceof ApiError && error.code === "WORKSPACE_CHANGED");
    }
  } finally { setActiveWorkspaceId(null); globalThis.fetch = original; }
});
