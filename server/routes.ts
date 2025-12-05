import type { Express } from "express";
import { createServer, type Server } from "http";
import passport, { requireAuth } from "./auth";
import { storage } from "./storage";
import { getGoogleDriveClient } from "./google-drive-client";
import { getGoogleDocsClient } from "./google-docs-client";
import {
  insertCategorySchema,
  insertContentSnippetSchema,
  insertProfileSchema,
  generateDocumentRequestSchema,
  type ParsedTemplate,
  type TemplateSection,
  type TemplateTag,
  type User,
  type Profile,
} from "@shared/schema";

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

function getProfileFieldValue(profile: Profile, fieldKey: string): string | null {
  switch (fieldKey) {
    case 'name': return profile.name;
    case 'contactName': return profile.contactName;
    case 'contactTitle': return profile.contactTitle;
    case 'addressLine1': return profile.addressLine1;
    case 'addressLine2': return profile.addressLine2;
    case 'city': return profile.city;
    case 'state': return profile.state;
    case 'zip': return profile.zip;
    case 'phone': return profile.phone;
    case 'email': return profile.email;
    case 'fullAddress': {
      const parts = [];
      if (profile.addressLine1) parts.push(profile.addressLine1);
      if (profile.addressLine2) parts.push(profile.addressLine2);
      const cityStateZip = [profile.city, profile.state, profile.zip].filter(Boolean).join(', ');
      if (cityStateZip) parts.push(cityStateZip);
      return parts.join(', ') || null;
    }
    case 'cityStateZip': {
      const parts = [profile.city, profile.state, profile.zip].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : null;
    }
    default: return null;
  }
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

  // Profiles
  app.get("/api/profiles", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const profiles = await storage.getProfiles(userId);
      res.json(profiles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/profiles/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { id } = req.params;
      const profile = await storage.getProfileById(userId, id);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json(profile);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/profiles", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const validated = insertProfileSchema.parse(req.body);
      const profile = await storage.createProfile(userId, validated);
      res.json(profile);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/profiles/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { id } = req.params;
      const validated = insertProfileSchema.partial().parse(req.body);
      const profile = await storage.updateProfile(userId, id, validated);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json(profile);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/profiles/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { id } = req.params;
      const success = await storage.deleteProfile(userId, id);
      if (!success) {
        return res.status(404).json({ error: "Profile not found" });
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
      
      // Copy the template document to preserve all formatting
      const copiedFile = await drive.files.copy({
        fileId: templateId,
        requestBody: {
          name: outputName,
        },
      });

      const newDocId = copiedFile.data.id;
      if (!newDocId) {
        return res.status(500).json({ error: "Failed to copy template document" });
      }

      // Build a lookup map for ALL field tag values (profile, custom content, or snippet)
      // First pass: collect raw values
      const fieldValueLookup = new Map<string, string>();
      for (const mapping of tagMappings) {
        if (mapping.tagType === 'field') {
          let value = "";
          if (mapping.profileId && mapping.profileField) {
            const profile = await storage.getProfileById(userId, mapping.profileId);
            if (profile) {
              value = getProfileFieldValue(profile, mapping.profileField) || "";
            }
          } else if (mapping.customContent) {
            value = mapping.customContent;
          } else if (mapping.snippetId) {
            const snippet = await storage.getContentSnippetById(userId, mapping.snippetId);
            if (snippet) {
              value = snippet.content;
            }
          }
          fieldValueLookup.set(mapping.tagName, value);
        }
      }

      // Helper function to resolve nested field tags in content
      const resolveNestedFields = (content: string): string => {
        return content.replace(/\{\{([^}]+)\}\}/g, (match, fieldName) => {
          const trimmedName = fieldName.trim();
          return fieldValueLookup.get(trimmedName) ?? match; // Keep original if not found
        });
      };

      // Second pass: resolve any nested field tags within the lookup values themselves
      // This handles cases where a field's value contains other field tags
      // Use a convergence loop to handle multi-level nesting
      let hasChanges = true;
      let iterations = 0;
      const maxIterations = 10; // Prevent infinite loops
      while (hasChanges && iterations < maxIterations) {
        hasChanges = false;
        Array.from(fieldValueLookup.entries()).forEach(([key, value]) => {
          const resolvedValue = resolveNestedFields(value);
          if (resolvedValue !== value) {
            fieldValueLookup.set(key, resolvedValue);
            hasChanges = true;
          }
        });
        iterations++;
      }

      // Build batch update requests to replace all tags with content
      const requests: any[] = [];

      for (const mapping of tagMappings) {
        let replacementContent = "";

        if (mapping.profileId && mapping.profileField) {
          const profile = await storage.getProfileById(userId, mapping.profileId);
          if (profile) {
            replacementContent = getProfileFieldValue(profile, mapping.profileField) || "";
          }
        } else if (mapping.customContent) {
          // Resolve nested field tags in custom content
          replacementContent = resolveNestedFields(mapping.customContent);
        } else if (mapping.snippetId) {
          const snippet = await storage.getContentSnippetById(userId, mapping.snippetId);
          if (snippet) {
            // Resolve nested field tags in snippet content
            replacementContent = resolveNestedFields(snippet.content);
            await storage.incrementSnippetUsage(userId, mapping.snippetId);
          }
        }

        // Use replaceAllText to preserve formatting
        // Use appropriate syntax based on tag type
        const tagSyntax = mapping.tagType === 'field' 
          ? `{{${mapping.tagName}}}` 
          : `<<${mapping.tagName}>>`;

        requests.push({
          replaceAllText: {
            containsText: {
              text: tagSyntax,
              matchCase: true,
            },
            replaceText: replacementContent,
          },
        });
      }

      // Apply all replacements in a single batch update
      if (requests.length > 0) {
        await docs.documents.batchUpdate({
          documentId: newDocId,
          requestBody: {
            requests,
          },
        });
      }

      // Append timestamp ticks at the end of the document
      const timestamp = Date.now();
      await docs.documents.batchUpdate({
        documentId: newDocId,
        requestBody: {
          requests: [
            {
              insertText: {
                text: `\n_${timestamp}`,
                endOfSegmentLocation: {
                  segmentId: '',
                },
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
