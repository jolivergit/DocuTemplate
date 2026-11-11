import { randomBytes } from "node:crypto";
import type { Express, Request, Response, NextFunction } from "express";
import { google } from "googleapis";
import { eq } from "drizzle-orm";
import { users, type User } from "@shared/schema";
import { db } from "../db";
import { requireAuth } from "../auth";
import { createGoogleOAuthClient, getAuthorizedGoogleOAuth } from "../google-client";
import {
  GOOGLE_DOCUMENT_SCOPES, assertPerFileScopes, GoogleAccessError,
  googleErrorResponse, requirePickerRequest, sendGoogleError,
  validDocsState, type DocsGrantState,
} from "../google-permissions";

declare module "express-session" {
  interface SessionData {
    googleDocsGrant?: DocsGrantState;
  }
}

function pickerConfiguration() {
  const apiKey = process.env.GOOGLE_PICKER_API_KEY;
  const appId = process.env.GOOGLE_CLOUD_PROJECT_NUMBER;
  if (!apiKey || !appId || !/^\d+$/.test(appId)) {
    throw new GoogleAccessError(
      "GOOGLE_PICKER_NOT_CONFIGURED",
      "Google template selection needs owner setup: enable Google Picker API and configure GOOGLE_PICKER_API_KEY and GOOGLE_CLOUD_PROJECT_NUMBER. See docs/google-oauth-setup.md.",
      503,
    );
  }
  return { apiKey, appId };
}

function finishPopup(res: Response, success: boolean, code: string) {
  const nonce = randomBytes(18).toString("base64");
  res.set("Cache-Control", "no-store");
  res.set("Referrer-Policy", "no-referrer");
  res.set("Content-Security-Policy", `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`);
  // Only fixed, application-defined codes are passed here, never provider text.
  res.type("html").send(`<!doctype html><html><head><title>Google Docs connection</title></head><body>
<p>${success ? "Google Docs connected. You can close this window." : "Google Docs was not connected. Return to the app to reconnect; your work has been kept."}</p>
<script nonce="${nonce}">
if (window.opener) {
  window.opener.postMessage(${JSON.stringify({ type: "studio-google-docs", success, code })}, window.location.origin);
  window.close();
}
</script></body></html>`);
}

export async function handleDocsCallback(req: Request, res: Response, next: NextFunction) {
  if (typeof req.query.state !== "string" || !req.query.state.startsWith("docs_")) return next();
  const grant = req.session.googleDocsGrant;
  delete req.session.googleDocsGrant;
  const valid = validDocsState(grant, req.query.state, req.isAuthenticated() ? (req.user as User).id : undefined);
  // Consume state even for cancellation; replay must never exchange a code.
  try {
    await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
    if (!valid) return finishPopup(res, false, "GOOGLE_DOCS_STATE_INVALID");
    if (req.query.error) return finishPopup(res, false, "GOOGLE_DOCS_PERMISSION_DENIED");
    if (typeof req.query.code !== "string") return finishPopup(res, false, "GOOGLE_DOCS_PERMISSION_DENIED");
    const auth = createGoogleOAuthClient();
    const { tokens } = await auth.getToken(req.query.code);
    if (!tokens.access_token) return finishPopup(res, false, "GOOGLE_DOCS_RECONNECT_REQUIRED");
    auth.setCredentials(tokens);
    const info = await auth.getTokenInfo(tokens.access_token);
    assertPerFileScopes(info.scopes);
    const identity = await google.oauth2({ version: "v2", auth }).userinfo.get();
    if (identity.data.id !== (req.user as User).googleId) {
      return finishPopup(res, false, "GOOGLE_DOCS_ACCOUNT_MISMATCH");
    }
    // Do not keep a legacy refresh token when accepting a narrow new grant.
    // Consent + offline access normally yields one; if not, fail explicitly.
    if (!tokens.refresh_token) return finishPopup(res, false, "GOOGLE_DOCS_RECONNECT_REQUIRED");
    await db.update(users).set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      updatedAt: new Date(),
    }).where(eq(users.id, grant!.userId));
    return finishPopup(res, true, "GOOGLE_DOCS_CONNECTED");
  } catch (error) {
    return finishPopup(res, false, googleErrorResponse(error).body.code);
  }
}

export function registerGoogleDocsAuthRoutes(app: Express) {
  app.get("/auth/google/docs", requireAuth, async (req, res) => {
    try {
      pickerConfiguration();
      const state = `docs_${randomBytes(32).toString("hex")}`;
      req.session.googleDocsGrant = { state, userId: (req.user as User).id, createdAt: Date.now() };
      await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
      res.redirect(createGoogleOAuthClient().generateAuthUrl({
        scope: GOOGLE_DOCUMENT_SCOPES,
        access_type: "offline",
        prompt: "consent",
        // Do not intentionally union previous account-wide permissions.
        include_granted_scopes: false,
        login_hint: (req.user as User).email,
        state,
      }));
    } catch (error) {
      finishPopup(res, false, googleErrorResponse(error).body.code);
    }
  });

  app.get("/api/google-docs/status", requireAuth, async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      pickerConfiguration();
      await getAuthorizedGoogleOAuth((req.user as User).id);
      res.json({ connected: true });
    } catch (error) {
      const result = googleErrorResponse(error);
      res.json({
        connected: false,
        legacyBroadAccess: result.body.code === "GOOGLE_DOCS_LEGACY_GRANT",
        configurationRequired: result.body.code === "GOOGLE_PICKER_NOT_CONFIGURED",
        error: result.body.error,
        code: result.body.code,
      });
    }
  });

  app.post("/api/google-docs/picker", requireAuth, requirePickerRequest, async (req, res) => {
    res.set("Cache-Control", "no-store");
    res.set("Pragma", "no-cache");
    try {
      const config = pickerConfiguration();
      const auth = await getAuthorizedGoogleOAuth((req.user as User).id);
      const { token } = await auth.getAccessToken();
      if (!token) throw new GoogleAccessError("GOOGLE_DOCS_RECONNECT_REQUIRED", "Reconnect Google Docs.");
      // getAccessToken may proactively refresh a nearly-expired token. Check
      // the actual token being sent, not only the previously stored one.
      assertPerFileScopes((await auth.getTokenInfo(token)).scopes);
      res.json({ accessToken: token, ...config });
    } catch (error) {
      sendGoogleError(res, error);
    }
  });
}
