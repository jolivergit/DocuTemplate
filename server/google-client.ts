import { google } from "googleapis";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { assertPerFileScopes, GoogleAccessError } from "./google-permissions";

export function createGoogleOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/auth/google/callback",
  );
}

export async function getAuthorizedGoogleOAuth(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.accessToken) {
    throw new GoogleAccessError("GOOGLE_DOCS_RECONNECT_REQUIRED", "Connect Google Docs to choose templates and create documents.");
  }
  const auth = createGoogleOAuthClient();
  auth.setCredentials({ access_token: user.accessToken, refresh_token: user.refreshToken });
  let token = user.accessToken;
  let info;
  try {
    info = await auth.getTokenInfo(token);
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status !== 400 && status !== 401) throw error;
    if (!user.refreshToken) {
      throw new GoogleAccessError("GOOGLE_DOCS_RECONNECT_REQUIRED", "Google Docs authorization expired. Reconnect Google Docs; your work has been kept.");
    }
    const { credentials } = await auth.refreshAccessToken();
    if (!credentials.access_token) {
      throw new GoogleAccessError("GOOGLE_DOCS_RECONNECT_REQUIRED", "Reconnect Google Docs to restore access.");
    }
    token = credentials.access_token;
    // Persist before returning, not through an unawaited token event.
    await db.update(users).set({
      accessToken: token,
      refreshToken: credentials.refresh_token || user.refreshToken,
      updatedAt: new Date(),
    }).where(eq(users.id, userId));
    info = await auth.getTokenInfo(token);
  }
  assertPerFileScopes(info.scopes);
  auth.setCredentials({ ...auth.credentials, access_token: token, expiry_date: info.expiry_date });
  // Persist automatic refreshes used during longer document-generation runs.
  auth.on("tokens", (tokens) => {
    if (tokens.access_token) {
      void db.update(users).set({
        accessToken: tokens.access_token,
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        updatedAt: new Date(),
      }).where(eq(users.id, userId)).catch(() => {
        console.error("Failed to persist refreshed Google Docs authorization");
      });
    }
  });
  return auth;
}

export async function getGoogleClient(userId: string) {
  const auth = await getAuthorizedGoogleOAuth(userId);
  return {
    docs: google.docs({ version: "v1", auth }),
    drive: google.drive({ version: "v3", auth }),
  };
}
