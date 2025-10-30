import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getUncachableGoogleDriveClient } from "./google-drive-client";
import { getUncachableGoogleDocsClient } from "./google-docs-client";
import {
  insertCategorySchema,
  insertContentSnippetSchema,
  generateDocumentRequestSchema,
  type ParsedTemplate,
  type TemplateSection,
  type TemplateTag,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Categories
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const validated = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(validated);
      res.json(category);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validated = insertCategorySchema.partial().parse(req.body);
      const category = await storage.updateCategory(id, validated);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteCategory(id);
      if (!success) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Content Snippets
  app.get("/api/content-snippets", async (req, res) => {
    try {
      const snippets = await storage.getContentSnippets();
      res.json(snippets);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/content-snippets", async (req, res) => {
    try {
      const validated = insertContentSnippetSchema.parse(req.body);
      const snippet = await storage.createContentSnippet(validated);
      res.json(snippet);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/content-snippets/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validated = insertContentSnippetSchema.partial().parse(req.body);
      const snippet = await storage.updateContentSnippet(id, validated);
      if (!snippet) {
        return res.status(404).json({ error: "Content snippet not found" });
      }
      res.json(snippet);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/content-snippets/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteContentSnippet(id);
      if (!success) {
        return res.status(404).json({ error: "Content snippet not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Google Drive Files
  app.get("/api/google-drive/files", async (req, res) => {
    try {
      const drive = await getUncachableGoogleDriveClient();
      
      const response = await drive.files.list({
        pageSize: 100,
        fields: 'files(id, name, mimeType, modifiedTime)',
        q: "mimeType='application/vnd.google-apps.document' and trashed=false",
        orderBy: 'modifiedTime desc',
      });

      const files = response.data.files || [];
      res.json(files);
    } catch (error: any) {
      console.error('Error listing Google Drive files:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Parse template
  app.post("/api/templates/parse", async (req, res) => {
    try {
      const { fileId } = req.body;
      
      if (!fileId) {
        return res.status(400).json({ error: "fileId is required" });
      }

      const docs = await getUncachableGoogleDocsClient();
      
      const doc = await docs.documents.get({
        documentId: fileId,
      });

      if (!doc.data || !doc.data.body) {
        return res.status(400).json({ error: "Invalid document" });
      }

      const documentName = doc.data.title || "Untitled";
      const content = doc.data.body.content || [];
      
      // Extract text content and find tags
      let fullText = "";
      const tagRegex = /<<([^>]+)>>/g;
      const allTags: TemplateTag[] = [];
      
      for (const element of content) {
        if (element.paragraph?.elements) {
          for (const textElement of element.paragraph.elements) {
            const text = textElement.textRun?.content || "";
            fullText += text;
          }
        }
      }

      // Find all tags in the document
      let match;
      while ((match = tagRegex.exec(fullText)) !== null) {
        const tagName = match[1].trim();
        allTags.push({
          type: "tag",
          name: tagName,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }

      // Build hierarchical sections based on heading levels
      const sections: TemplateSection[] = [];
      const sectionStack: { section: TemplateSection, level: number }[] = [];
      let textOffset = 0;
      let sectionCounter = 0;
      let currentSection: TemplateSection | null = null;

      // Helper to extract heading level from style
      const getHeadingLevel = (style: string | undefined): number | null => {
        if (!style) return null;
        const match = style.match(/HEADING_(\d+)/);
        return match ? parseInt(match[1]) : null;
      };

      for (const element of content) {
        if (element.paragraph) {
          const paragraphStyle = element.paragraph.paragraphStyle?.namedStyleType || undefined;
          const headingLevel = getHeadingLevel(paragraphStyle);
          
          let paragraphText = "";
          for (const textElement of element.paragraph.elements || []) {
            paragraphText += textElement.textRun?.content || "";
          }

          if (headingLevel && paragraphText.trim()) {
            // Create new section for this heading
            const newSection: TemplateSection = {
              id: `section-${sectionCounter++}`,
              title: paragraphText.trim(),
              tags: [],
              startIndex: textOffset,
              endIndex: textOffset + paragraphText.length,
              children: [],
            };

            // Find the correct parent based on heading level
            // Pop sections from stack that are at same or deeper level
            while (sectionStack.length > 0 && sectionStack[sectionStack.length - 1].level >= headingLevel) {
              sectionStack.pop();
            }

            if (sectionStack.length === 0) {
              // Top-level section (Heading 1 or first heading)
              sections.push(newSection);
            } else {
              // Child section - add to parent's children
              const parent = sectionStack[sectionStack.length - 1].section;
              parent.children.push(newSection);
            }

            // Push this section onto the stack
            sectionStack.push({ section: newSection, level: headingLevel });
            currentSection = newSection;
          }

          // Find tags in this paragraph
          const paragraphTags = allTags.filter(
            tag => tag.startIndex >= textOffset && tag.endIndex <= textOffset + paragraphText.length
          );

          // Add tags to the current section
          if (currentSection && paragraphTags.length > 0) {
            currentSection.tags.push(...paragraphTags);
          } else if (!currentSection && paragraphTags.length > 0) {
            // Create a default section if we have tags but no section yet
            // Don't push to stack so it doesn't interfere with subsequent headings
            const defaultSection: TemplateSection = {
              id: `section-${sectionCounter++}`,
              title: "Content",
              tags: paragraphTags,
              startIndex: textOffset,
              endIndex: textOffset + paragraphText.length,
              children: [],
            };
            sections.push(defaultSection);
            currentSection = defaultSection;
            // Note: Not pushing to stack so subsequent headings remain top-level
          }

          textOffset += paragraphText.length;
        }
      }

      // If no sections were created, create a default one with all tags
      if (sections.length === 0 && allTags.length > 0) {
        sections.push({
          id: 'section-0',
          title: 'Document Content',
          tags: allTags,
          startIndex: 0,
          endIndex: fullText.length,
          children: [],
        });
      }

      const parsedTemplate: ParsedTemplate = {
        documentId: fileId,
        documentName,
        sections,
        allTags,
      };

      res.json(parsedTemplate);
    } catch (error: any) {
      console.error('Error parsing template:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Generate document
  app.post("/api/documents/generate", async (req, res) => {
    try {
      const validated = generateDocumentRequestSchema.parse(req.body);
      const { templateId, outputName, tagMappings } = validated;

      const docs = await getUncachableGoogleDocsClient();
      const drive = await getUncachableGoogleDriveClient();
      
      // Get the original document
      const originalDoc = await docs.documents.get({
        documentId: templateId,
      });

      if (!originalDoc.data || !originalDoc.data.body) {
        return res.status(400).json({ error: "Invalid template document" });
      }

      // Extract full text content
      let fullText = "";
      const content = originalDoc.data.body.content || [];
      
      for (const element of content) {
        if (element.paragraph?.elements) {
          for (const textElement of element.paragraph.elements) {
            fullText += textElement.textRun?.content || "";
          }
        }
      }

      // Replace tags with mapped content
      let processedText = fullText;
      for (const mapping of tagMappings) {
        const tagPattern = new RegExp(`<<${mapping.tagName}>>`, 'g');
        let replacementContent = "";

        if (mapping.customContent) {
          replacementContent = mapping.customContent;
        } else if (mapping.snippetId) {
          const snippet = await storage.getContentSnippetById(mapping.snippetId);
          if (snippet) {
            replacementContent = snippet.content;
            await storage.incrementSnippetUsage(mapping.snippetId);
          }
        }

        processedText = processedText.replace(tagPattern, replacementContent);
      }

      // Create new document
      const newDoc = await docs.documents.create({
        requestBody: {
          title: outputName,
        },
      });

      const newDocId = newDoc.data.documentId;
      if (!newDocId) {
        return res.status(500).json({ error: "Failed to create document" });
      }

      // Insert content into the new document
      await docs.documents.batchUpdate({
        documentId: newDocId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: {
                  index: 1,
                },
                text: processedText,
              },
            },
          ],
        },
      });

      const documentUrl = `https://docs.google.com/document/d/${newDocId}/edit`;

      res.json({
        documentId: newDocId,
        documentUrl,
      });
    } catch (error: any) {
      console.error('Error generating document:', error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
