import type { Express } from "express";
import { requireAuth } from "../auth";
import { getGoogleClient } from "../google-client";
import { parseTemplate, generateDocument } from "../services/doc-generation";
import { generateDocumentRequestSchema, type User } from "@shared/schema";
import { sendGoogleError } from "../google-permissions";

const MOCK_MODE = process.env.NODE_ENV === "development" && process.env.GENERATE_DOCS_MOCK === "true";

const MOCK_FILES = [
  {
    id: "MOCK_TEMPLATE_ID",
    name: "Mock Test Template",
    mimeType: "application/vnd.google-apps.document",
    modifiedTime: "2024-01-01T00:00:00.000Z",
  },
];

const MOCK_PARSED_TEMPLATE = {
  documentId: "MOCK_TEMPLATE_ID",
  documentName: "Mock Test Template",
  sections: [
    {
      id: "section-0",
      title: "Document Content",
      tags: [
        { type: "tag", name: "firm_name", tagType: "field", startIndex: 0, endIndex: 13 },
        { type: "tag", name: "project_name", tagType: "field", startIndex: 14, endIndex: 29 },
        { type: "tag", name: "proposal_total", tagType: "field", startIndex: 30, endIndex: 47 },
      ],
      startIndex: 0,
      endIndex: 200,
      children: [],
    },
  ],
  allTags: [
    { type: "tag", name: "firm_name", tagType: "field", startIndex: 0, endIndex: 13 },
    { type: "tag", name: "project_name", tagType: "field", startIndex: 14, endIndex: 29 },
    { type: "tag", name: "proposal_total", tagType: "field", startIndex: 30, endIndex: 47 },
  ],
};

const MOCK_DOC_ID = "MOCK_TEST_DOC_1234567890";

export function registerDocBuilderRoutes(app: Express): void {
  // Google Drive Files
  app.get("/api/google-drive/files", requireAuth, async (req, res) => {
    if (MOCK_MODE) {
      return res.json(MOCK_FILES);
    }
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
      sendGoogleError(res, error);
    }
  });

  // Parse template
  app.post("/api/templates/parse", requireAuth, async (req, res) => {
    if (MOCK_MODE) {
      return res.json(MOCK_PARSED_TEMPLATE);
    }
    try {
      const userId = (req.user as User).id;
      const { fileId } = req.body;

      if (typeof fileId !== "string" || !fileId.trim()) {
        return res.status(400).json({ error: "fileId is required" });
      }

      const { docs } = await getGoogleClient(userId);
      const parsedTemplate = await parseTemplate(fileId, docs);
      res.json(parsedTemplate);
    } catch (error) {
      sendGoogleError(res, error);
    }
  });

  // Generate document
  app.post("/api/documents/generate", requireAuth, async (req, res) => {
    if (MOCK_MODE) {
      return res.json({
        documentId: MOCK_DOC_ID,
        documentUrl: `https://docs.google.com/document/d/${MOCK_DOC_ID}/edit`,
      });
    }
    try {
      const userId = (req.user as User).id;
      const validated = generateDocumentRequestSchema.parse(req.body);
      const { docs, drive } = await getGoogleClient(userId);
      const result = await generateDocument(userId, validated, docs, drive);
      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid document generation request." });
      }
      sendGoogleError(res, error);
    }
  });
}
