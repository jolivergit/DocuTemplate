import { test } from "node:test";
import { strict as assert } from "node:assert";
import { apiRequest, ApiError } from "./queryClient";

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
