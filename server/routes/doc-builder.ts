import type { Express } from "express";
import { requireAuth } from "../auth";
import { getGoogleClient } from "../google-client";
import { parseTemplate, generateDocument } from "../services/doc-generation";
import { generateDocumentRequestSchema, type User } from "@shared/schema";

export function registerDocBuilderRoutes(app: Express): void {
  // Google Drive Files
  app.get("/api/google-drive/files", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { drive } = await getGoogleClient(userId);

      const response = await drive.files.list({
        pageSize: 100,
        fields: "files(id, name, mimeType, modifiedTime)",
        q: "mimeType='application/vnd.google-apps.document' and trashed=false",
        orderBy: "modifiedTime desc",
      });

      res.json(response.data.files || []);
    } catch (error) {
      console.error("Error listing Google Drive files:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Parse template
  app.post("/api/templates/parse", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { fileId } = req.body;

      if (!fileId) {
        return res.status(400).json({ error: "fileId is required" });
      }

      const { docs } = await getGoogleClient(userId);
      const parsedTemplate = await parseTemplate(fileId, docs);
      res.json(parsedTemplate);
    } catch (error) {
      console.error("Error parsing template:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Generate document
  app.post("/api/documents/generate", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const validated = generateDocumentRequestSchema.parse(req.body);
      const { docs, drive } = await getGoogleClient(userId);
      const result = await generateDocument(userId, validated, docs, drive);
      res.json(result);
    } catch (error) {
      console.error("Error generating document:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });
}
