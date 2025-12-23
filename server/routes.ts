import type { Express } from "express";
import { createServer, type Server } from "http";
import { Readable } from "stream";
import passport, { requireAuth } from "./auth";
import { storage } from "./storage";
import { getGoogleDriveClient } from "./google-drive-client";
import { getGoogleDocsClient } from "./google-docs-client";
import { htmlToPlainText } from "./html-to-text";
import { htmlToGoogleDocsRequests, hasRichFormatting, parseHtmlToBlocks } from "./html-to-google-docs";
import {
  insertCategorySchema,
  insertContentSnippetSchema,
  insertFieldValueSchema,
  generateDocumentRequestSchema,
  type ParsedTemplate,
  type TemplateSection,
  type TemplateTag,
  type User,
  type FieldValue,
} from "@shared/schema";

/**
 * Helper to create a readable stream from a string
 */
function stringToStream(str: string): Readable {
  const stream = new Readable();
  stream.push(str);
  stream.push(null);
  return stream;
}

/**
 * Import HTML content into a Google Doc using Drive API's native conversion.
 * Uses LEADING TAB CHARACTERS to preserve nested list hierarchy.
 * Google Docs counts leading tabs when createParagraphBullets is called to determine nesting.
 * 
 * @param drive - Google Drive client
 * @param docs - Google Docs client  
 * @param htmlContent - HTML content to import
 * @param targetDocId - Target document ID to insert content into
 * @param insertIndex - Index in target doc where content should be inserted
 * @returns The length of inserted content
 */
async function importHtmlContent(
  drive: any,
  docs: any,
  htmlContent: string,
  targetDocId: string,
  insertIndex: number
): Promise<{ insertedLength: number }> {
  // Wrap HTML in a complete document structure for proper conversion
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; }
    ul, ol { margin-left: 0; padding-left: 1.5em; }
    li { margin: 0.25em 0; }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;

  // Create a temporary Google Doc from the HTML
  // Google Drive will convert HTML to native Docs format, preserving list nesting
  const tempFile = await drive.files.create({
    requestBody: {
      name: `_temp_import_${Date.now()}`,
      mimeType: 'application/vnd.google-apps.document',
    },
    media: {
      mimeType: 'text/html',
      body: stringToStream(fullHtml),
    },
    fields: 'id',
  });

  const tempDocId = tempFile.data.id;
  if (!tempDocId) {
    throw new Error('Failed to create temporary document for HTML import');
  }

  try {
    // Get the content from the temporary document
    const tempDocResponse = await docs.documents.get({ documentId: tempDocId });
    const tempBody = tempDocResponse.data.body?.content || [];

    // Extract all structural elements (paragraphs, tables, etc.) except section breaks
    const contentElements: any[] = [];

    for (const element of tempBody) {
      // Skip section breaks and the document start marker
      if (element.sectionBreak) continue;
      if (element.paragraph) {
        contentElements.push(element);
      } else if (element.table) {
        contentElements.push(element);
      }
    }

    // If there's no content, return early
    if (contentElements.length === 0) {
      return { insertedLength: 0 };
    }

    // Build the text to insert WITH leading tabs for bullet nesting
    // Google Docs uses these leading tabs to determine nesting when createParagraphBullets is called
    let textToInsert = '';
    let totalTabsInserted = 0; // Track tabs that will be consumed by createParagraphBullets
    
    // Track paragraph info for formatting later (including tab prefixes)
    interface ParagraphInfo {
      tabPrefix: string;
      originalText: string;
      bullet?: {
        nestingLevel: number;
        listId: string;
      };
      elements: any[];
    }
    const paragraphInfos: ParagraphInfo[] = [];

    for (const element of contentElements) {
      if (element.paragraph?.elements) {
        const paragraphElements = element.paragraph.elements || [];
        let originalText = '';
        
        for (const el of paragraphElements) {
          if (el.textRun?.content) {
            originalText += el.textRun.content;
          }
        }

        // For bullet paragraphs, prepend tabs based on nesting level
        let tabPrefix = '';
        if (element.paragraph.bullet) {
          const nestingLevel = element.paragraph.bullet.nestingLevel || 0;
          tabPrefix = '\t'.repeat(nestingLevel);
          totalTabsInserted += nestingLevel; // Track tabs for later subtraction
        }

        textToInsert += tabPrefix + originalText;
        
        paragraphInfos.push({
          tabPrefix,
          originalText,
          bullet: element.paragraph.bullet ? {
            nestingLevel: element.paragraph.bullet.nestingLevel || 0,
            listId: element.paragraph.bullet.listId,
          } : undefined,
          elements: paragraphElements,
        });
      }
    }

    // If no text, return early
    if (textToInsert.length === 0) {
      return { insertedLength: 0 };
    }

    // Remove trailing newline if present (we'll add our own paragraph break)
    if (textToInsert.endsWith('\n')) {
      textToInsert = textToInsert.slice(0, -1);
    }

    // Insert the text (with leading tabs for nested bullets)
    const insertRequests: any[] = [{
      insertText: {
        location: { index: insertIndex },
        text: textToInsert,
      },
    }];

    // Apply the batch update
    await docs.documents.batchUpdate({
      documentId: targetDocId,
      requestBody: { requests: insertRequests },
    });

    // Build formatting requests based on the temp doc structure
    const formattingRequests: any[] = [];
    let currentOffset = insertIndex;

    // Track contiguous bullet runs for batched bullet creation
    interface BulletRun {
      startIndex: number;
      endIndex: number;
      bulletPreset: string;
    }
    const bulletRuns: BulletRun[] = [];
    let currentBulletRun: BulletRun | null = null;

    for (const info of paragraphInfos) {
      const fullParagraphLength = info.tabPrefix.length + info.originalText.length;
      const paragraphStart = currentOffset;
      const paragraphEnd = currentOffset + fullParagraphLength;

      // Handle bullet formatting
      if (info.bullet) {
        // Get list properties from temp doc
        const tempLists = tempDocResponse.data.lists || {};
        const listProps = tempLists[info.bullet.listId];
        
        // Determine bullet preset based on list properties
        let bulletPreset = 'BULLET_DISC_CIRCLE_SQUARE';
        if (listProps?.listProperties?.nestingLevels) {
          const levelProps = listProps.listProperties.nestingLevels[0];
          if (levelProps?.glyphType?.includes('DECIMAL') || 
              levelProps?.glyphType?.includes('ALPHA') ||
              levelProps?.glyphType?.includes('ROMAN')) {
            bulletPreset = 'NUMBERED_DECIMAL_ALPHA_ROMAN';
          }
        }

        // Track this paragraph for batched bullet creation
        if (currentBulletRun && currentBulletRun.bulletPreset === bulletPreset) {
          // Extend current run
          currentBulletRun.endIndex = paragraphEnd;
        } else {
          // Start new run
          if (currentBulletRun) {
            bulletRuns.push(currentBulletRun);
          }
          currentBulletRun = {
            startIndex: paragraphStart,
            endIndex: paragraphEnd,
            bulletPreset,
          };
        }
      } else {
        // End current bullet run if exists
        if (currentBulletRun) {
          bulletRuns.push(currentBulletRun);
          currentBulletRun = null;
        }
      }

      // Apply text formatting (offset by tab prefix length)
      let textOffset = info.tabPrefix.length;
      for (const el of info.elements) {
        if (!el.textRun?.content) continue;
        
        const textStart = paragraphStart + textOffset;
        const textEnd = textStart + el.textRun.content.length;
        const textStyle = el.textRun.textStyle || {};
        
        const styleFields: string[] = [];
        const newStyle: any = {};

        if (textStyle.bold) { newStyle.bold = true; styleFields.push('bold'); }
        if (textStyle.italic) { newStyle.italic = true; styleFields.push('italic'); }
        if (textStyle.underline) { newStyle.underline = true; styleFields.push('underline'); }
        if (textStyle.strikethrough) { newStyle.strikethrough = true; styleFields.push('strikethrough'); }
        if (textStyle.link?.url) { newStyle.link = { url: textStyle.link.url }; styleFields.push('link'); }

        if (styleFields.length > 0) {
          formattingRequests.push({
            updateTextStyle: {
              range: { startIndex: textStart, endIndex: textEnd },
              textStyle: newStyle,
              fields: styleFields.join(','),
            },
          });
        }

        textOffset += el.textRun.content.length;
      }

      currentOffset += fullParagraphLength;
    }

    // Finalize any remaining bullet run
    if (currentBulletRun) {
      bulletRuns.push(currentBulletRun);
    }

    // Create bullets for each contiguous run
    // Google Docs uses the LEADING TABS to determine nesting level
    // The tabs are consumed/removed when bullets are created
    for (const run of bulletRuns) {
      formattingRequests.push({
        createParagraphBullets: {
          range: { startIndex: run.startIndex, endIndex: run.endIndex },
          bulletPreset: run.bulletPreset,
        },
      });
    }

    // Apply formatting in batches
    if (formattingRequests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: targetDocId,
        requestBody: { requests: formattingRequests },
      });
    }

    // Subtract tabs from insertedLength since they are consumed by createParagraphBullets
    const finalInsertedLength = textToInsert.length - totalTabsInserted;
    return { insertedLength: finalInsertedLength };
  } finally {
    // Clean up the temporary document
    try {
      await drive.files.delete({ fileId: tempDocId });
    } catch (cleanupError) {
      console.error('Failed to delete temporary document:', cleanupError);
    }
  }
}

// Extract field tags ({{...}}) from content
function extractEmbeddedFields(content: string): string[] {
  const fieldTagPattern = /\{\{([^}]+)\}\}/g;
  const fields: string[] = [];
  let match;
  while ((match = fieldTagPattern.exec(content)) !== null) {
    const fieldName = match[1].trim();
    if (fieldName && !fields.includes(fieldName)) {
      fields.push(fieldName);
    }
  }
  return fields;
}


export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.get("/auth/google", passport.authenticate("google", { 
    accessType: "offline",
    prompt: "consent"
  }));

  app.get(
    "/auth/google/callback",
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
      // Parse embedded field tags from content
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
      // If content is being updated, re-parse embedded fields
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

  // Field Values - simple key/value pairs for field tags
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
      // Field tags use {{...}}, content tags use <<...>>
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

      // Find all field tags ({{...}}) in the document
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

      // Find all content tags (<<...>>) in the document
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

      // Sort tags by their position in the document
      allTags.sort((a, b) => a.startIndex - b.startIndex);

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

  // Generate document using hybrid approach:
  // 1. Copy template to preserve all original styling (fonts, headers, margins)
  // 2. Replace field tags with replaceAllText (inherits surrounding styles)
  // 3. For content tags: create temp doc from HTML, extract content, insert at tag location
  app.post("/api/documents/generate", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const validated = generateDocumentRequestSchema.parse(req.body);
      const { templateId, outputName, tagMappings } = validated;

      const docs = await getGoogleDocsClient(userId);
      const drive = await getGoogleDriveClient(userId);
      
      // Generate timestamp ticks for unique document naming
      const timestamp = Date.now();
      const documentNameWithTicks = `${outputName}_${timestamp}`;
      
      // Step 1: Copy the template to preserve all original styling
      const copiedFile = await drive.files.copy({
        fileId: templateId,
        requestBody: {
          name: documentNameWithTicks,
        },
      });

      const newDocId = copiedFile.data.id;
      if (!newDocId) {
        return res.status(500).json({ error: "Failed to copy template document" });
      }

      // Build lookup maps for field and content values
      const fieldValueLookup = new Map<string, string>();
      const contentValueLookup = new Map<string, string>();
      
      for (const mapping of tagMappings) {
        if (mapping.tagType === 'field') {
          let value = "";
          if (mapping.fieldValueId) {
            const fieldValue = await storage.getFieldValueById(userId, mapping.fieldValueId);
            if (fieldValue) {
              value = fieldValue.value;
            }
          } else if (mapping.customContent) {
            value = htmlToPlainText(mapping.customContent);
          } else if (mapping.snippetId) {
            const snippet = await storage.getContentSnippetById(userId, mapping.snippetId);
            if (snippet) {
              value = htmlToPlainText(snippet.content);
            }
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

      // Helper to resolve nested field tags in plain text
      const resolveNestedFieldsPlainText = (content: string): string => {
        return content.replace(/\{\{([^}]+)\}\}/g, (match, fieldName) => {
          const trimmedName = fieldName.trim();
          return fieldValueLookup.get(trimmedName) ?? match;
        });
      };

      // Resolve nested field tags within field values themselves
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

      // Step 2: Replace field tags with replaceAllText (inherits surrounding styles)
      const fieldRequests: any[] = [];
      for (const [tagName, value] of Array.from(fieldValueLookup.entries())) {
        fieldRequests.push({
          replaceAllText: {
            containsText: {
              text: `{{${tagName}}}`,
              matchCase: true,
            },
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

      // Step 3: For content tags, use HTML-to-Docs conversion for proper nested list formatting
      // Process each content tag
      for (const [tagName, htmlContent] of Array.from(contentValueLookup.entries())) {
        if (!htmlContent) continue;

        const tagSyntax = `<<${tagName}>>`;

        // Resolve nested field tags in the HTML content
        const resolvedHtml = htmlContent.replace(/\{\{([^}]+)\}\}/g, (match: string, fieldName: string) => {
          const trimmedName = fieldName.trim();
          return fieldValueLookup.get(trimmedName) ?? match;
        });

        // DEBUG: Log the content being processed for each tag
        console.log(`\n========== Processing content tag: ${tagName} ==========`);
        console.log(`Raw HTML content:\n${htmlContent}`);
        console.log(`\nResolved HTML (after field substitution):\n${resolvedHtml}`);

        // Check if content has rich formatting that needs HTML-to-Docs conversion
        if (hasRichFormatting(resolvedHtml)) {
          // Get current document to find tag locations
          const docResponse = await docs.documents.get({ documentId: newDocId });
          const docContent = docResponse.data.body?.content || [];
          
          // Find all occurrences of the tag in the document
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

          // Process tag locations from end to beginning to avoid index shifting
          tagLocations.sort((a, b) => b.startIndex - a.startIndex);

          for (const location of tagLocations) {
            // Generate the formatted content insertion requests using htmlToGoogleDocsRequests
            const { requests: formatRequests } = htmlToGoogleDocsRequests(resolvedHtml, location.startIndex);

            // Build batch: delete tag first, then insert formatted content
            const batchRequests: any[] = [
              {
                deleteContentRange: {
                  range: {
                    startIndex: location.startIndex,
                    endIndex: location.endIndex,
                  },
                },
              },
              ...formatRequests,
            ];

            // Apply the batch update for this tag occurrence
            await docs.documents.batchUpdate({
              documentId: newDocId,
              requestBody: { requests: batchRequests },
            });
          }
        } else {
          // No rich formatting, use simple replaceAllText
          const plainText = resolveNestedFieldsPlainText(htmlToPlainText(resolvedHtml));
          await docs.documents.batchUpdate({
            documentId: newDocId,
            requestBody: {
              requests: [{
                replaceAllText: {
                  containsText: {
                    text: tagSyntax,
                    matchCase: true,
                  },
                  replaceText: plainText,
                },
              }],
            },
          });
        }
      }

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
