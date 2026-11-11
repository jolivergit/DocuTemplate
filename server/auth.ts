import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import type { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { GOOGLE_IDENTITY_SCOPES } from "./google-permissions";
import { resolveWorkspace } from "./workspaces";
import { workspaceContext, AccessError } from "./workspace-context";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL ||
  "http://localhost:5000/auth/google/callback";

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error(
    "Missing Google OAuth credentials. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables.",
  );
}

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID!,
      clientSecret: GOOGLE_CLIENT_SECRET!,
      callbackURL: CALLBACK_URL,
      scope: GOOGLE_IDENTITY_SCOPES,
      state: true,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value || "";
        const name = profile.displayName || "";
        const picture = profile.photos?.[0]?.value || null;
        const emailVerified = profile._json?.email_verified === true;

        let [user] = await db
          .select()
          .from(users)
          .where(eq(users.googleId, googleId))
          .limit(1);

        if (user) {
          await db
            .update(users)
            .set({
              name,
              email,
              picture,
              emailVerified,
              updatedAt: new Date(),
            })
            .where(eq(users.id, user.id));

          user = {
            ...user,
            name,
            email,
            picture,
            emailVerified,
          };
        } else {
          const [newUser] = await db
            .insert(users)
            .values({
              googleId,
              email,
              name,
              picture,
              emailVerified,
              // This column holds document credentials only. Identity sign-in
              // must never overwrite a separate Google Docs connection.
              accessToken: "",
              refreshToken: null,
            })
            .returning();
          user = newUser;
        }

        done(null, user);
      } catch (error) {
        done(error as Error);
      }
    },
  ),
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    done(null, user || null);
  } catch (error) {
    done(error);
  }
});

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Authentication required" });
  res.setHeader("Cache-Control", "no-store");
  // Same-origin JSON clients only for writes; protects invitation/member changes too.
  if (!["GET", "HEAD"].includes(req.method) && req.get("Sec-Fetch-Site") === "cross-site") {
    return res.status(403).json({ error: "Cross-site requests are not allowed." });
  }
  try {
    const c = await resolveWorkspace(req.user as import("@shared/schema").User, req.get("X-Workspace-Id"));
    const ownerMutation = !["GET", "HEAD"].includes(req.method) && (
      /^\/api\/(companies|contacts)(\/|$)/.test(req.path) ||
      (req.method === "DELETE" && /^\/api\/(leads|proposals|invoices)\/[^/]+$/.test(req.path))
    );
    if (ownerMutation && c.role !== "Owner") return res.status(403).json({ error: "Only a company owner can perform this action." });
    return workspaceContext.run(c, () => next());
  } catch (error) {
    if (error instanceof AccessError) return res.status(error.status).json({ error: error.message, code: "WORKSPACE_ACCESS_REVOKED" });
    next(error);
  }
}

export default passport;
