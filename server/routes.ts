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
 * This approach preserves nested list hierarchy because Google handles the conversion.
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
    // Skip the first element which is typically an empty paragraph or section break
    const contentElements: any[] = [];
    let plainTextLength = 0;

    for (const element of tempBody) {
      // Skip section breaks and the document start marker
      if (element.sectionBreak) continue;
      if (element.paragraph) {
        const paragraphElements = element.paragraph.elements || [];
        for (const el of paragraphElements) {
          if (el.textRun?.content) {
            plainTextLength += el.textRun.content.length;
          }
        }
        contentElements.push(element);
      } else if (element.table) {
        contentElements.push(element);
      }
    }

    // If there's no content, return early
    if (contentElements.length === 0 || plainTextLength === 0) {
      return { insertedLength: 0 };
    }

    // Build the plain text from the temp doc to insert
    let textToInsert = '';
    for (const element of contentElements) {
      if (element.paragraph?.elements) {
        for (const el of element.paragraph.elements) {
          if (el.textRun?.content) {
            textToInsert += el.textRun.content;
          }
        }
      }
    }

    // Remove trailing newline if present (we'll add our own paragraph break)
    if (textToInsert.endsWith('\n')) {
      textToInsert = textToInsert.slice(0, -1);
    }

    // Insert the plain text first
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

    // Now copy the formatting from the temp doc to the target doc
    // Get the target doc's current state to find the inserted content
    const targetDocResponse = await docs.documents.get({ documentId: targetDocId });
    const targetBody = targetDocResponse.data.body?.content || [];

    // Build formatting requests based on the temp doc structure
    const formattingRequests: any[] = [];
    let currentOffset = insertIndex;

    for (const element of contentElements) {
      if (!element.paragraph) continue;

      const paragraphElements = element.paragraph.elements || [];
      let paragraphText = '';
      
      for (const el of paragraphElements) {
        if (el.textRun?.content) {
          paragraphText += el.textRun.content;
        }
      }

      const paragraphStart = currentOffset;
      const paragraphEnd = currentOffset + paragraphText.length;

      // Apply bullet formatting if present
      if (element.paragraph.bullet) {
        const bullet = element.paragraph.bullet;
        const listId = bullet.listId;
        const nestingLevel = bullet.nestingLevel || 0;

        // Get list properties from temp doc
        const tempLists = tempDocResponse.data.lists || {};
        const listProps = tempLists[listId];
        
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

        // Create bullets for this paragraph
        formattingRequests.push({
          createParagraphBullets: {
            range: { startIndex: paragraphStart, endIndex: paragraphEnd },
            bulletPreset,
          },
        });

        // Apply indentation for nesting level
        if (nestingLevel > 0) {
          const indentStart = 36 * (nestingLevel + 1);
          const indentFirstLine = indentStart - 18;
          formattingRequests.push({
            updateParagraphStyle: {
              range: { startIndex: paragraphStart, endIndex: paragraphEnd },
              paragraphStyle: {
                indentFirstLine: { magnitude: indentFirstLine, unit: 'PT' },
                indentStart: { magnitude: indentStart, unit: 'PT' },
              },
              fields: 'indentFirstLine,indentStart',
            },
          });
        }
      }

      // Apply text formatting
      let textOffset = 0;
      for (const el of paragraphElements) {
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

      currentOffset += paragraphText.length;
    }

    // Apply formatting in batches
    if (formattingRequests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: targetDocId,
        requestBody: { requests: formattingRequests },
      });
    }

    return { insertedLength: textToInsert.length };
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

  // Generate document
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
      
      // Copy the template document to preserve all formatting
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

      // Build a lookup map for ALL field tag values (field value, custom content, or snippet)
      // First pass: collect raw values and convert HTML to plain text for field values
      const fieldValueLookup = new Map<string, string>();
      for (const mapping of tagMappings) {
        if (mapping.tagType === 'field') {
          let value = "";
          if (mapping.fieldValueId) {
            const fieldValue = await storage.getFieldValueById(userId, mapping.fieldValueId);
            if (fieldValue) {
              value = fieldValue.value;
            }
          } else if (mapping.customContent) {
            // Convert HTML to plain text for custom content
            value = htmlToPlainText(mapping.customContent);
          } else if (mapping.snippetId) {
            const snippet = await storage.getContentSnippetById(userId, mapping.snippetId);
            if (snippet) {
              value = htmlToPlainText(snippet.content);
            }
          }
          fieldValueLookup.set(mapping.tagName, value);
        }
      }

      // Helper function to resolve nested field tags in content (plain text version)
      const resolveNestedFieldsPlainText = (content: string): string => {
        return content.replace(/\{\{([^}]+)\}\}/g, (match, fieldName) => {
          const trimmedName = fieldName.trim();
          return fieldValueLookup.get(trimmedName) ?? match;
        });
      };

      // Helper function to resolve nested field tags in HTML content (preserves HTML)
      const resolveNestedFieldsHtml = (html: string): string => {
        return html.replace(/\{\{([^}]+)\}\}/g, (match, fieldName) => {
          const trimmedName = fieldName.trim();
          return fieldValueLookup.get(trimmedName) ?? match;
        });
      };

      // Second pass: resolve any nested field tags within the lookup values themselves
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

      // Separate mappings into field tags (plain text) and content tags (rich text)
      const fieldMappings = tagMappings.filter(m => m.tagType === 'field');
      const contentMappings = tagMappings.filter(m => m.tagType === 'content');

      // First, handle simple field tag replacements with replaceAllText
      const fieldRequests: any[] = [];
      for (const mapping of fieldMappings) {
        let replacementContent = "";

        if (mapping.fieldValueId) {
          const fieldValue = await storage.getFieldValueById(userId, mapping.fieldValueId);
          if (fieldValue) {
            replacementContent = resolveNestedFieldsPlainText(fieldValue.value);
          }
        } else if (mapping.customContent) {
          replacementContent = resolveNestedFieldsPlainText(htmlToPlainText(mapping.customContent));
        } else if (mapping.snippetId) {
          const snippet = await storage.getContentSnippetById(userId, mapping.snippetId);
          if (snippet) {
            replacementContent = resolveNestedFieldsPlainText(htmlToPlainText(snippet.content));
            await storage.incrementSnippetUsage(userId, mapping.snippetId);
          }
        }

        fieldRequests.push({
          replaceAllText: {
            containsText: {
              text: `{{${mapping.tagName}}}`,
              matchCase: true,
            },
            replaceText: replacementContent,
          },
        });
      }

      // Apply field replacements first
      if (fieldRequests.length > 0) {
        await docs.documents.batchUpdate({
          documentId: newDocId,
          requestBody: { requests: fieldRequests },
        });
      }

      // Now handle content tags with rich text formatting
      // For each content tag, we need to: 1) find its location, 2) delete it, 3) insert formatted content
      for (const mapping of contentMappings) {
        // Get the HTML content
        let htmlContent = "";
        if (mapping.customContent) {
          htmlContent = resolveNestedFieldsHtml(mapping.customContent);
        } else if (mapping.snippetId) {
          const snippet = await storage.getContentSnippetById(userId, mapping.snippetId);
          if (snippet) {
            htmlContent = resolveNestedFieldsHtml(snippet.content);
            await storage.incrementSnippetUsage(userId, mapping.snippetId);
          }
        }

        if (!htmlContent) continue;

        const tagSyntax = `<<${mapping.tagName}>>`;

        // Check if content has rich formatting
        if (hasRichFormatting(htmlContent)) {
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

          // Process tag locations from end to beginning to avoid index shifting issues
          tagLocations.sort((a, b) => b.startIndex - a.startIndex);

          for (const location of tagLocations) {
            // Generate the formatted content insertion requests
            const { requests: formatRequests } = htmlToGoogleDocsRequests(htmlContent, location.startIndex);

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
          const plainText = resolveNestedFieldsPlainText(htmlToPlainText(htmlContent));
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
