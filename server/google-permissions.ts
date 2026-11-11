import type { Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";

export const GOOGLE_IDENTITY_SCOPES = ["openid", "profile", "email"];
export const GOOGLE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const GOOGLE_DOCUMENT_SCOPES = [...GOOGLE_IDENTITY_SCOPES, GOOGLE_FILE_SCOPE];

// Do not send a legacy account-wide access token to the browser's Picker.
const allowedScopes = new Set([
  GOOGLE_FILE_SCOPE, ...GOOGLE_IDENTITY_SCOPES,
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
]);

export class GoogleAccessError extends Error {
  constructor(public code: string, message: string, public status = 403) {
    super(message);
  }
}

export interface DocsGrantState { state: string; userId: string; createdAt: number }

export function validDocsState(grant: DocsGrantState | undefined, state: unknown, userId: string | undefined, now = Date.now()) {
  if (!grant || typeof state !== "string" || !userId) return false;
  const supplied = Buffer.from(state);
  const expected = Buffer.from(grant.state);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected) &&
    now >= grant.createdAt && now - grant.createdAt < 10 * 60_000 && userId === grant.userId;
}

export function assertPerFileScopes(scopes: string[]) {
  if (scopes.some(scope => !allowedScopes.has(scope))) {
    throw new GoogleAccessError(
      "GOOGLE_DOCS_LEGACY_GRANT",
      "This Google connection has older, broader permissions. Remove this app in Google Account → Third-party connections, then reconnect Google Docs here. Your studio records will not be deleted.",
    );
  }
  if (!scopes.includes(GOOGLE_FILE_SCOPE)) {
    throw new GoogleAccessError(
      "GOOGLE_DOCS_RECONNECT_REQUIRED",
      "Connect Google Docs and allow access to the files you select.",
    );
  }
}

export function googleErrorResponse(error: unknown): { status: number; body: { error: string; code: string } } {
  if (error instanceof GoogleAccessError) {
    return { status: error.status, body: { error: error.message, code: error.code } };
  }
  const e = error as { code?: number | string; response?: { status?: number; data?: { error?: string } } };
  const status = Number(e?.response?.status || e?.code);
  const reason = e?.response?.data?.error;
  if (status === 401 || reason === "invalid_grant" || reason === "invalid_token") {
    return { status: 403, body: {
      code: "GOOGLE_DOCS_RECONNECT_REQUIRED",
      error: "Google Docs authorization expired or was revoked. Reconnect Google Docs; your work has been kept.",
    } };
  }
  if (status === 403 || status === 404) {
    return { status: 403, body: {
      code: "GOOGLE_FILE_ACCESS_REQUIRED",
      error: "Google could not access this file. Select it again using the Google picker with the same Google account. Check that you can open and copy it in Google Drive.",
    } };
  }
  return { status: 502, body: { code: "GOOGLE_DOCS_ERROR", error: "Google Docs could not complete this request. Your work has been kept. Try again." } };
}

export function sendGoogleError(res: Response, error: unknown) {
  const result = googleErrorResponse(error);
  res.status(result.status).json(result.body);
}

// No cross-site form can obtain a browser token. SameSite cookies provide an
// additional layer; the custom header forces a preflight for cross-site JS.
export function requirePickerRequest(req: Request, res: Response, next: () => void) {
  if (req.get("X-Requested-With") !== "StudioPM" || req.get("Sec-Fetch-Site") === "cross-site") {
    res.status(403).json({ error: "Open the Google picker from this application.", code: "GOOGLE_PICKER_REQUEST_REQUIRED" });
    return;
  }
  next();
}
