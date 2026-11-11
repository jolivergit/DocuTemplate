import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import type { Request, Response } from "express";
import {
  GOOGLE_FILE_SCOPE, GOOGLE_IDENTITY_SCOPES, GOOGLE_DOCUMENT_SCOPES,
  assertPerFileScopes, GoogleAccessError, googleErrorResponse,
  validDocsState, requirePickerRequest,
} from "./google-permissions";

test("ordinary login scopes are identity-only; Docs adds drive.file only", () => {
  assert.deepEqual(GOOGLE_IDENTITY_SCOPES, ["openid", "profile", "email"]);
  assert.deepEqual(GOOGLE_DOCUMENT_SCOPES, ["openid", "profile", "email", GOOGLE_FILE_SCOPE]);
  assert.doesNotThrow(() => assertPerFileScopes([
    "openid", "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile", GOOGLE_FILE_SCOPE,
  ]));
});

for (const scope of [
  "https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/documents", "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly", "unknown-scope",
]) {
  test(`legacy or unexpected scope is blocked: ${scope}`, () => {
    assert.throws(() => assertPerFileScopes([GOOGLE_FILE_SCOPE, scope]),
      (error: unknown) => error instanceof GoogleAccessError && error.code === "GOOGLE_DOCS_LEGACY_GRANT");
  });
}

test("identity token alone cannot be used for document APIs", () => {
  assert.throws(() => assertPerFileScopes(GOOGLE_IDENTITY_SCOPES),
    (error: unknown) => error instanceof GoogleAccessError && error.code === "GOOGLE_DOCS_RECONNECT_REQUIRED");
});

test("document connection binds state to session, current user and ten-minute window", () => {
  const grant = { state: "docs_random_state", userId: "test-user", createdAt: 1_000 };
  assert.equal(validDocsState(grant, grant.state, grant.userId, 2_000), true);
  assert.equal(validDocsState(grant, "docs_random_statz", grant.userId, 2_000), false);
  assert.equal(validDocsState(grant, "", grant.userId, 2_000), false);
  assert.equal(validDocsState(undefined, grant.state, grant.userId, 2_000), false);
  assert.equal(validDocsState(grant, grant.state, undefined, 2_000), false);
  assert.equal(validDocsState(grant, grant.state, "different-user", 2_000), false);
  assert.equal(validDocsState(grant, grant.state, grant.userId, 601_000), false);
  assert.equal(validDocsState(grant, grant.state, grant.userId, 999), false);
  assert.equal(validDocsState(grant, [grant.state], grant.userId, 2_000), false);
});

test("revoked, denied and missing-file errors offer recovery without exposing provider payloads", () => {
  assert.equal(googleErrorResponse({ response: { status: 400, data: { error: "invalid_grant" } } }).body.code, "GOOGLE_DOCS_RECONNECT_REQUIRED");
  assert.equal(googleErrorResponse({ response: { status: 401 } }).body.code, "GOOGLE_DOCS_RECONNECT_REQUIRED");
  for (const status of [403, 404]) {
    assert.equal(googleErrorResponse({ response: { status } }).body.code, "GOOGLE_FILE_ACCESS_REQUIRED");
  }
  const secretError = { response: { status: 500 }, message: "access_token=never-return", config: { secret: "never-return" } };
  assert.ok(!JSON.stringify(googleErrorResponse(secretError)).includes("never-return"));
});

test("browser token route rejects cross-site and form requests", () => {
  for (const [header, site, allowed] of [
    ["StudioPM", "same-origin", true], ["StudioPM", "cross-site", false],
    [undefined, "same-origin", false], ["other", undefined, false],
  ] as const) {
    let advanced = false;
    let status;
    const req = { get: (name: string) => name === "X-Requested-With" ? header : site } as Request;
    const res = {
      status: (value: number) => { status = value; return res; },
      json: () => res,
    } as unknown as Response;
    requirePickerRequest(req, res, () => { advanced = true; });
    assert.equal(advanced, allowed);
    if (!allowed) assert.equal(status, 403);
  }
});

test("normal login cannot overwrite document credentials or force consent", () => {
  const auth = readFileSync(new URL("./auth.ts", import.meta.url), "utf8");
  const routes = readFileSync(new URL("./routes/auth.ts", import.meta.url), "utf8");
  assert.match(auth, /state: true/);
  assert.doesNotMatch(auth, /accessToken,\s*refreshToken/);
  assert.doesNotMatch(routes, /prompt:\s*["']consent/);
});

test("callback consumes state before errors and never logs credentials", () => {
  const route = readFileSync(new URL("./routes/google-docs-auth.ts", import.meta.url), "utf8");
  assert.ok(route.indexOf("delete req.session.googleDocsGrant") < route.indexOf("if (req.query.error)"));
  assert.ok(route.indexOf("if (!valid)") < route.indexOf("auth.getToken(req.query.code)"));
  assert.match(route, /identity.data.id !== \(req.user as User\).googleId/);
  assert.match(route, /assertPerFileScopes\(info.scopes\)/);
  assert.match(route, /include_granted_scopes: false/);
  assert.doesNotMatch(route, /console\.(log|error)/);
  const server = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  assert.match(server, /if \(path !== "\/api\/google-docs\/picker"\) capturedJsonResponse/);
});
