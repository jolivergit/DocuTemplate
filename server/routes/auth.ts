import type { Express } from "express";
import passport, { requireAuth } from "../auth";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { User } from "@shared/schema";
import { handleDocsCallback, registerGoogleDocsAuthRoutes } from "./google-docs-auth";

const DEV_TEST_USER = {
  googleId: "dev_test_user_bypass",
  email: "devtest@test.local",
  name: "Dev Test User",
  accessToken: "dev_test_bypass_token",
  refreshToken: null as string | null,
  picture: null as string | null,
};

export function registerAuthRoutes(app: Express): void {
  if (process.env.NODE_ENV === "development") {
    app.get("/api/dev/test-login", async (req, res) => {
      try {
        let [existing] = await db
          .select()
          .from(users)
          .where(eq(users.googleId, DEV_TEST_USER.googleId))
          .limit(1);

        if (!existing) {
          const [created] = await db
            .insert(users)
            .values(DEV_TEST_USER)
            .returning();
          existing = created;
        }

        req.login(existing, (err) => {
          if (err) return res.status(500).json({ error: "Login failed" });
          res.json({ id: existing.id, email: existing.email, name: existing.name });
        });
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });
  }

  registerGoogleDocsAuthRoutes(app);
  app.get("/auth/google", passport.authenticate("google"));

  app.get(
    "/auth/google/callback",
    handleDocsCallback,
    passport.authenticate("google", { failureRedirect: "/" }),
    (req, res) => {
      res.redirect("/");
    }
  );

  app.get("/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.redirect("/");
    });
  });

  app.get("/auth/user", (req, res) => {
    if (req.isAuthenticated()) {
      const user = req.user as User;
      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      });
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  });
}
