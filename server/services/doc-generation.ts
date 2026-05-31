import type { docs_v1, drive_v3 } from "googleapis";
import { storage } from "../storage";
import { htmlToPlainText } from "../html-to-text";
import { htmlToGoogleDocsRequests, hasRichFormatting } from "../html-to-google-docs";
import { insertPhaseTable, insertAdditionalServicesTable } from "./google-docs";
import type { AdditionalServiceRow, PhaseRow } from "./google-docs";
import type {
  GenerateDocumentRequest,
  ParsedTemplate,
  TemplateSection,
  TemplateTag,
} from "@shared/schema";

type StorageProposal = NonNullable<Awaited<ReturnType<typeof storage.getProposalById>>>;
type StorageProfile = Awaited<ReturnType<typeof storage.getMyProfile>>;

export interface GenerateDocumentResult {
  documentId: string;
  documentUrl: string;
}

// ---------------------------------------------------------------------------
// parseTemplate
// ---------------------------------------------------------------------------

export async function parseTemplate(
  fileId: string,
  docs: docs_v1.Docs
): Promise<ParsedTemplate> {
  const doc = await docs.documents.get({ documentId: fileId });

  if (!doc.data || !doc.data.body) {
    throw new Error("Invalid document");
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

        while (
          sectionStack.length > 0 &&
          sectionStack[sectionStack.length - 1].level >= headingLevel
        ) {
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
        (tag) =>
          tag.startIndex >= textOffset &&
          tag.endIndex <= textOffset + paragraphText.length
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
      id: "section-0",
      title: "Document Content",
      tags: allTags,
      startIndex: 0,
      endIndex: fullText.length,
      children: [],
    });
  }

  return { documentId: fileId, documentName, sections, allTags };
}

// ---------------------------------------------------------------------------
// generateDocument
// ---------------------------------------------------------------------------

export async function generateDocument(
  userId: string,
  request: GenerateDocumentRequest,
  docs: docs_v1.Docs,
  drive: drive_v3.Drive
): Promise<GenerateDocumentResult> {
  const { templateId, outputName, tagMappings } = request;

  const timestamp = Date.now();
  const documentNameWithTicks = `${outputName}_${timestamp}`;

  const copiedFile = await drive.files.copy({
    fileId: templateId,
    requestBody: { name: documentNameWithTicks },
  });

  const newDocId = copiedFile.data.id;
  if (!newDocId) {
    throw new Error("Failed to copy template document");
  }

  const fieldValueLookup = new Map<string, string>();
  const contentValueLookup = new Map<string, string>();

  for (const mapping of tagMappings) {
    if (mapping.tagType === "field") {
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
    } else if (mapping.tagType === "content") {
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

  const resolveNestedFieldsPlainText = (content: string): string =>
    content.replace(/\{\{([^}]+)\}\}/g, (match, fieldName) => {
      const trimmedName = fieldName.trim();
      return fieldValueLookup.get(trimmedName) ?? match;
    });

  let hasChanges = true;
  let iterations = 0;
  while (hasChanges && iterations < 10) {
    hasChanges = false;
    for (const [key, value] of Array.from(fieldValueLookup.entries())) {
      const resolvedValue = resolveNestedFieldsPlainText(value);
      if (resolvedValue !== value) {
        fieldValueLookup.set(key, resolvedValue);
        hasChanges = true;
      }
    }
    iterations++;
  }

  const hasPhaseTable = fieldValueLookup.has("proposal_phases_table");
  let phasesData: PhaseRow[] = [];
  if (hasPhaseTable) {
    fieldValueLookup.delete("proposal_phases_table");
    const phasesJsonFv = await storage.getFieldValueByName(userId, "_proposal_phases_json");
    if (phasesJsonFv) {
      try {
        phasesData = JSON.parse(phasesJsonFv.value);
      } catch (e) {
        console.error("Failed to parse _proposal_phases_json:", e);
      }
    }
  }

  const hasAsTable = fieldValueLookup.has("additional_services_table");
  let additionalServicesData: AdditionalServiceRow[] = [];
  if (hasAsTable) {
    fieldValueLookup.delete("additional_services_table");
    const asJsonFv = await storage.getFieldValueByName(userId, "_additional_services_json");
    if (asJsonFv) {
      try {
        additionalServicesData = JSON.parse(asJsonFv.value);
      } catch (e) {
        console.error("Failed to parse _additional_services_json:", e);
      }
    }
  }

  const fieldRequests: Array<{
    replaceAllText: {
      containsText: { text: string; matchCase: boolean };
      replaceText: string;
    };
  }> = [];
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
    await insertPhaseTable(docs, newDocId, "{{proposal_phases_table}}", phasesData);
  }

  if (hasAsTable && additionalServicesData.length > 0) {
    await insertAdditionalServicesTable(
      docs,
      newDocId,
      "{{additional_services_table}}",
      additionalServicesData
    );
  }

  for (const [tagName, htmlContent] of Array.from(contentValueLookup.entries())) {
    if (!htmlContent) continue;

    const tagSyntax = `<<${tagName}>>`;

    const resolvedHtml = htmlContent.replace(
      /\{\{([^}]+)\}\}/g,
      (match: string, fieldName: string) => {
        const trimmedName = fieldName.trim();
        return fieldValueLookup.get(trimmedName) ?? match;
      }
    );

    const contentMappingEntry = tagMappings.find(
      (m) => m.tagName === tagName && m.tagType === "content"
    );
    const sectionHeaderText = contentMappingEntry?.sectionHeader;
    const sectionHeaderLevel = contentMappingEntry?.sectionHeaderLevel || "H2";

    let processedHtml = resolvedHtml;
    if (sectionHeaderText) {
      const headingNum = sectionHeaderLevel.replace("H", "");
      processedHtml = `<h${headingNum}>${sectionHeaderText}</h${headingNum}>${resolvedHtml || ""}`;
    }

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
        const { requests: formatRequests } = htmlToGoogleDocsRequests(
          processedHtml,
          location.startIndex
        );
        const batchRequests: Record<string, unknown>[] = [
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
          requests: [
            {
              replaceAllText: {
                containsText: { text: tagSyntax, matchCase: true },
                replaceText: plainText,
              },
            },
          ],
        },
      });
    }
  }

  const documentUrl = `https://docs.google.com/document/d/${newDocId}/edit`;
  return { documentId: newDocId, documentUrl };
}

// ---------------------------------------------------------------------------
// resolveConsultantContractFields
// ---------------------------------------------------------------------------

export function resolveConsultantContractFields(
  proposal: StorageProposal,
  consultant: string,
  profile: StorageProfile
): Map<string, string> {
  const consultantRows: PhaseRow[] = proposal.phases.flatMap((phase) =>
    phase.feeLines
      .filter((fl) => fl.consultant === consultant && (fl.amount || fl.feeType === "Hourly"))
      .map((fl) => ({
        phase: phase.name,
        consultant: fl.consultant,
        feeType: fl.feeType,
        amount: fl.amount ?? null,
      }))
  );

  const consultantTotal = consultantRows.reduce((sum, row) => {
    if (row.feeType === "Fixed" && row.amount) {
      const n = parseFloat(row.amount);
      return isNaN(n) ? sum : sum + n;
    }
    return sum;
  }, 0);

  const fieldValueLookup = new Map<string, string>();
  fieldValueLookup.set("consultant_name", consultant);
  fieldValueLookup.set(
    "consultant_total",
    consultantTotal > 0
      ? `$${consultantTotal.toLocaleString("en-US", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })}`
      : ""
  );
  fieldValueLookup.set("proposal_name", proposal.name);
  fieldValueLookup.set(
    "proposal_date",
    proposal.dateSigned
      ? new Date(proposal.dateSigned as Date).toLocaleDateString()
      : ""
  );

  if (profile) {
    fieldValueLookup.set("firm_name", profile.name || "");
    fieldValueLookup.set("firm_phone", profile.phone || "");
    fieldValueLookup.set("firm_email", profile.email || "");
    fieldValueLookup.set(
      "firm_address",
      [profile.addressLine1, profile.addressLine2].filter(Boolean).join(", ")
    );
    fieldValueLookup.set("firm_city", profile.city || "");
    fieldValueLookup.set("firm_state", profile.state || "");
    fieldValueLookup.set("firm_zip", profile.zip || "");
    fieldValueLookup.set("firm_contact_name", profile.contactName || "");
    fieldValueLookup.set("firm_contact_title", profile.contactTitle || "");
  }

  return fieldValueLookup;
}

// ---------------------------------------------------------------------------
// generateConsultantDocument
// Combines field resolution + doc copy + field replace + table insertion.
// ---------------------------------------------------------------------------

export async function generateConsultantDocument(
  proposal: StorageProposal,
  consultant: string,
  templateId: string,
  outputName: string,
  profile: StorageProfile,
  docs: docs_v1.Docs,
  drive: drive_v3.Drive
): Promise<GenerateDocumentResult> {
  const fieldValueLookup = resolveConsultantContractFields(proposal, consultant, profile);

  const consultantRows: PhaseRow[] = proposal.phases.flatMap((phase) =>
    phase.feeLines
      .filter((fl) => fl.consultant === consultant && (fl.amount || fl.feeType === "Hourly"))
      .map((fl) => ({
        phase: phase.name,
        consultant: fl.consultant,
        feeType: fl.feeType,
        amount: fl.amount ?? null,
      }))
  );

  const timestamp = Date.now();
  const copiedFile = await drive.files.copy({
    fileId: templateId,
    requestBody: { name: `${outputName}_${timestamp}` },
  });
  const newDocId = copiedFile.data.id;
  if (!newDocId) {
    throw new Error("Failed to copy template document");
  }

  const preDoc = await docs.documents.get({ documentId: newDocId });
  let preDocText = "";
  for (const element of preDoc.data.body?.content || []) {
    if (element.paragraph?.elements) {
      for (const el of element.paragraph.elements) {
        preDocText += el.textRun?.content || "";
      }
    }
  }
  const hasConsultantTableTag = preDocText.includes("{{consultant_phases_table}}");

  const fieldRequests: Array<{
    replaceAllText: {
      containsText: { text: string; matchCase: boolean };
      replaceText: string;
    };
  }> = [];
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

  if (hasConsultantTableTag && consultantRows.length > 0) {
    await insertPhaseTable(docs, newDocId, "{{consultant_phases_table}}", consultantRows);
  }

  const documentUrl = `https://docs.google.com/document/d/${newDocId}/edit`;
  return { documentId: newDocId, documentUrl };
}
