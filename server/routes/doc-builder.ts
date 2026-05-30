import type { Express } from "express";
import { requireAuth } from "../auth";
import { storage } from "../storage";
import { getGoogleDriveClient } from "../google-drive-client";
import { getGoogleDocsClient } from "../google-docs-client";
import { htmlToPlainText } from "../html-to-text";
import { htmlToGoogleDocsRequests, hasRichFormatting } from "../html-to-google-docs";
import { extractEmbeddedFields, insertPhaseTable, insertAdditionalServicesTable } from "../services/google-docs";
import type { AdditionalServiceRow } from "../services/google-docs";
import {
  insertCategorySchema,
  insertContentSnippetSchema,
  insertFieldValueSchema,
  generateDocumentRequestSchema,
  type ParsedTemplate,
  type TemplateSection,
  type TemplateTag,
  type User,
} from "@shared/schema";

export function registerDocBuilderRoutes(app: Express): void {
  // Categories
  app.get("/api/categories", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const categories = await storage.getCategories(userId);
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/categories", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const validated = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(userId, validated);
      res.json(category);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/categories/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { id } = req.params;
      const validated = insertCategorySchema.partial().parse(req.body);
      const category = await storage.updateCategory(userId, id, validated);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/categories/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { id } = req.params;
      const success = await storage.deleteCategory(userId, id);
      if (!success) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Content Snippets
  app.get("/api/content-snippets", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const snippets = await storage.getContentSnippets(userId);
      res.json(snippets);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/content-snippets", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const validated = insertContentSnippetSchema.parse(req.body);
      const embeddedFields = extractEmbeddedFields(validated.content);
      const snippet = await storage.createContentSnippet(userId, validated, embeddedFields);
      res.json(snippet);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/content-snippets/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { id } = req.params;
      const validated = insertContentSnippetSchema.partial().parse(req.body);
      const embeddedFields = validated.content ? extractEmbeddedFields(validated.content) : undefined;
      const snippet = await storage.updateContentSnippet(userId, id, validated, embeddedFields);
      if (!snippet) {
        return res.status(404).json({ error: "Content snippet not found" });
      }
      res.json(snippet);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/content-snippets/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { id } = req.params;
      const success = await storage.deleteContentSnippet(userId, id);
      if (!success) {
        return res.status(404).json({ error: "Content snippet not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Field Values
  app.get("/api/field-values", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const fieldValues = await storage.getFieldValues(userId);
      res.json(fieldValues);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/field-values/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { id } = req.params;
      const fieldValue = await storage.getFieldValueById(userId, id);
      if (!fieldValue) {
        return res.status(404).json({ error: "Field value not found" });
      }
      res.json(fieldValue);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/field-values", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const validated = insertFieldValueSchema.parse(req.body);
      const fieldValue = await storage.createFieldValue(userId, validated);
      res.json(fieldValue);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/field-values/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { id } = req.params;
      const validated = insertFieldValueSchema.partial().parse(req.body);
      const fieldValue = await storage.updateFieldValue(userId, id, validated);
      if (!fieldValue) {
        return res.status(404).json({ error: "Field value not found" });
      }
      res.json(fieldValue);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/field-values/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { id } = req.params;
      const success = await storage.deleteFieldValue(userId, id);
      if (!success) {
        return res.status(404).json({ error: "Field value not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete field values by name prefixes
  app.delete("/api/field-values/by-prefix", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { prefixes } = req.body;
      if (!Array.isArray(prefixes) || prefixes.some((p) => typeof p !== "string")) {
        return res.status(400).json({ error: "prefixes must be an array of strings" });
      }
      const count = await storage.deleteFieldValuesByPrefixes(userId, prefixes);
      res.json({ deleted: count });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Upsert field value by name
  app.post("/api/field-values/upsert-by-name", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { name, value } = req.body;
      if (!name || value === undefined || value === null) {
        return res.status(400).json({ error: "name is required and value must be provided" });
      }
      const existing = await storage.getFieldValueByName(userId, name);
      if (existing) {
        const updated = await storage.updateFieldValue(userId, existing.id, { name, value });
        return res.json(updated);
      }
      const created = await storage.createFieldValue(userId, { name, value });
      res.json(created);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Google Drive Files
  app.get("/api/google-drive/files", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const drive = await getGoogleDriveClient(userId);

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
  app.post("/api/templates/parse", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { fileId } = req.body;

      if (!fileId) {
        return res.status(400).json({ error: "fileId is required" });
      }

      const docs = await getGoogleDocsClient(userId);
      const doc = await docs.documents.get({ documentId: fileId });

      if (!doc.data || !doc.data.body) {
        return res.status(400).json({ error: "Invalid document" });
      }

      const documentName = doc.data.title || "Untitled";
      const content = doc.data.body.content || [];

      let fullText = "";
      const fieldTagRegex = /\{\{([^}]+)\}\}/g;
      const contentTagRegex = /<<([^>]+)>>/g;
      const allTags: TemplateTag[] = [];

      for (const element of content) {
        if (element.paragraph?.elements) {
          for (const textElement of element.paragraph.elements) {
            const text = textElement.textRun?.content || "";
            fullText += text;
          }
        }
      }

      let match;
      while ((match = fieldTagRegex.exec(fullText)) !== null) {
        const tagName = match[1].trim();
        allTags.push({
          type: "tag",
          name: tagName,
          tagType: "field",
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }

      while ((match = contentTagRegex.exec(fullText)) !== null) {
        const tagName = match[1].trim();
        allTags.push({
          type: "tag",
          name: tagName,
          tagType: "content",
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }

      allTags.sort((a, b) => a.startIndex - b.startIndex);

      const sections: TemplateSection[] = [];
      const sectionStack: { section: TemplateSection; level: number }[] = [];
      let textOffset = 0;
      let sectionCounter = 0;
      let currentSection: TemplateSection | null = null;

      const getHeadingLevel = (style: string | undefined): number | null => {
        if (!style) return null;
        const m = style.match(/HEADING_(\d+)/);
        return m ? parseInt(m[1]) : null;
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
            const newSection: TemplateSection = {
              id: `section-${sectionCounter++}`,
              title: paragraphText.trim(),
              tags: [],
              startIndex: textOffset,
              endIndex: textOffset + paragraphText.length,
              children: [],
            };

            while (sectionStack.length > 0 && sectionStack[sectionStack.length - 1].level >= headingLevel) {
              sectionStack.pop();
            }

            if (sectionStack.length === 0) {
              sections.push(newSection);
            } else {
              const parent = sectionStack[sectionStack.length - 1].section;
              parent.children.push(newSection);
            }

            sectionStack.push({ section: newSection, level: headingLevel });
            currentSection = newSection;
          }

          const paragraphTags = allTags.filter(
            tag => tag.startIndex >= textOffset && tag.endIndex <= textOffset + paragraphText.length
          );

          if (currentSection && paragraphTags.length > 0) {
            currentSection.tags.push(...paragraphTags);
          } else if (!currentSection && paragraphTags.length > 0) {
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
          }

          textOffset += paragraphText.length;
        }
      }

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
  app.post("/api/documents/generate", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const validated = generateDocumentRequestSchema.parse(req.body);
      const { templateId, outputName, tagMappings } = validated;

      const docs = await getGoogleDocsClient(userId);
      const drive = await getGoogleDriveClient(userId);

      const timestamp = Date.now();
      const documentNameWithTicks = `${outputName}_${timestamp}`;

      const copiedFile = await drive.files.copy({
        fileId: templateId,
        requestBody: { name: documentNameWithTicks },
      });

      const newDocId = copiedFile.data.id;
      if (!newDocId) {
        return res.status(500).json({ error: "Failed to copy template document" });
      }

      const fieldValueLookup = new Map<string, string>();
      const contentValueLookup = new Map<string, string>();

      for (const mapping of tagMappings) {
        if (mapping.tagType === 'field') {
          let value = "";
          if (mapping.fieldValueId) {
            const fieldValue = await storage.getFieldValueById(userId, mapping.fieldValueId);
            if (fieldValue) value = fieldValue.value;
          } else if (mapping.customContent) {
            value = htmlToPlainText(mapping.customContent);
          } else if (mapping.snippetId) {
            const snippet = await storage.getContentSnippetById(userId, mapping.snippetId);
            if (snippet) value = htmlToPlainText(snippet.content);
          }
          fieldValueLookup.set(mapping.tagName, value);
        } else if (mapping.tagType === 'content') {
          let htmlContent = "";
          if (mapping.customContent) {
            htmlContent = mapping.customContent;
          } else if (mapping.snippetId) {
            const snippet = await storage.getContentSnippetById(userId, mapping.snippetId);
            if (snippet) {
              htmlContent = snippet.content;
              await storage.incrementSnippetUsage(userId, mapping.snippetId);
            }
          }
          contentValueLookup.set(mapping.tagName, htmlContent);
        }
      }

      const resolveNestedFieldsPlainText = (content: string): string => {
        return content.replace(/\{\{([^}]+)\}\}/g, (match, fieldName) => {
          const trimmedName = fieldName.trim();
          return fieldValueLookup.get(trimmedName) ?? match;
        });
      };

      let hasChanges = true;
      let iterations = 0;
      const maxIterations = 10;
      while (hasChanges && iterations < maxIterations) {
        hasChanges = false;
        Array.from(fieldValueLookup.entries()).forEach(([key, value]) => {
          const resolvedValue = resolveNestedFieldsPlainText(value);
          if (resolvedValue !== value) {
            fieldValueLookup.set(key, resolvedValue);
            hasChanges = true;
          }
        });
        iterations++;
      }

      const hasPhaseTable = fieldValueLookup.has('proposal_phases_table');
      let phasesData: { phase: string; consultant: string; feeType: string; amount: string | null }[] = [];
      if (hasPhaseTable) {
        fieldValueLookup.delete('proposal_phases_table');
        const phasesJsonFv = await storage.getFieldValueByName(userId, '_proposal_phases_json');
        if (phasesJsonFv) {
          try {
            phasesData = JSON.parse(phasesJsonFv.value);
          } catch (e) {
            console.error('Failed to parse _proposal_phases_json:', e);
          }
        }
      }

      const hasAsTable = fieldValueLookup.has('additional_services_table');
      let additionalServicesData: AdditionalServiceRow[] = [];
      if (hasAsTable) {
        fieldValueLookup.delete('additional_services_table');
        const asJsonFv = await storage.getFieldValueByName(userId, '_additional_services_json');
        if (asJsonFv) {
          try {
            additionalServicesData = JSON.parse(asJsonFv.value);
          } catch (e) {
            console.error('Failed to parse _additional_services_json:', e);
          }
        }
      }

      const fieldRequests: any[] = [];
      for (const [tagName, value] of Array.from(fieldValueLookup.entries())) {
        fieldRequests.push({
          replaceAllText: {
            containsText: { text: `{{${tagName}}}`, matchCase: true },
            replaceText: value,
          },
        });
      }

      if (fieldRequests.length > 0) {
        await docs.documents.batchUpdate({
          documentId: newDocId,
          requestBody: { requests: fieldRequests },
        });
      }

      if (hasPhaseTable && phasesData.length > 0) {
        await insertPhaseTable(docs, newDocId, '{{proposal_phases_table}}', phasesData);
      }

      if (hasAsTable && additionalServicesData.length > 0) {
        await insertAdditionalServicesTable(docs, newDocId, '{{additional_services_table}}', additionalServicesData);
      }

      for (const [tagName, htmlContent] of Array.from(contentValueLookup.entries())) {
        if (!htmlContent) continue;

        const tagSyntax = `<<${tagName}>>`;

        const resolvedHtml = htmlContent.replace(/\{\{([^}]+)\}\}/g, (match: string, fieldName: string) => {
          const trimmedName = fieldName.trim();
          return fieldValueLookup.get(trimmedName) ?? match;
        });

        const contentMappingEntry = tagMappings.find(m => m.tagName === tagName && m.tagType === 'content');
        const sectionHeaderText = contentMappingEntry?.sectionHeader;
        const sectionHeaderLevel = contentMappingEntry?.sectionHeaderLevel || 'H2';

        let processedHtml = resolvedHtml;
        if (sectionHeaderText) {
          const headingNum = sectionHeaderLevel.replace('H', '');
          processedHtml = `<h${headingNum}>${sectionHeaderText}</h${headingNum}>${resolvedHtml || ''}`;
        }

        console.log(`\n========== Processing content tag: ${tagName} ==========`);
        console.log(`Raw HTML content:\n${htmlContent}`);
        console.log(`\nProcessed HTML (after field substitution + section header):\n${processedHtml}`);

        if (hasRichFormatting(processedHtml)) {
          const docResponse = await docs.documents.get({ documentId: newDocId });
          const docContent = docResponse.data.body?.content || [];
          const tagLocations: { startIndex: number; endIndex: number }[] = [];

          for (const element of docContent) {
            if (element.paragraph?.elements) {
              for (const el of element.paragraph.elements) {
                if (el.textRun?.content) {
                  const text = el.textRun.content;
                  const startOffset = el.startIndex || 0;
                  let searchStart = 0;
                  while (true) {
                    const idx = text.indexOf(tagSyntax, searchStart);
                    if (idx === -1) break;
                    tagLocations.push({
                      startIndex: startOffset + idx,
                      endIndex: startOffset + idx + tagSyntax.length,
                    });
                    searchStart = idx + 1;
                  }
                }
              }
            }
          }

          tagLocations.sort((a, b) => b.startIndex - a.startIndex);

          for (const location of tagLocations) {
            const { requests: formatRequests } = htmlToGoogleDocsRequests(processedHtml, location.startIndex);
            const batchRequests: any[] = [
              {
                deleteContentRange: {
                  range: { startIndex: location.startIndex, endIndex: location.endIndex },
                },
              },
              ...formatRequests,
            ];
            await docs.documents.batchUpdate({
              documentId: newDocId,
              requestBody: { requests: batchRequests },
            });
          }
        } else {
          const plainText = resolveNestedFieldsPlainText(htmlToPlainText(processedHtml));
          await docs.documents.batchUpdate({
            documentId: newDocId,
            requestBody: {
              requests: [{
                replaceAllText: {
                  containsText: { text: tagSyntax, matchCase: true },
                  replaceText: plainText,
                },
              }],
            },
          });
        }
      }

      const documentUrl = `https://docs.google.com/document/d/${newDocId}/edit`;
      res.json({ documentId: newDocId, documentUrl });
    } catch (error: any) {
      console.error('Error generating document:', error);
      res.status(500).json({ error: error.message });
    }
  });
}
