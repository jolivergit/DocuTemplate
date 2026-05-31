import { Readable } from "stream";
import type { docs_v1, drive_v3 } from "googleapis";

export type PhaseRow = { phase: string; consultant: string; feeType: string; amount: string | null };

export interface AdditionalServiceRow {
  description: string;
  amount: string | null;
}

export function stringToStream(str: string): Readable {
  const stream = new Readable();
  stream.push(str);
  stream.push(null);
  return stream;
}

export function extractEmbeddedFields(content: string): string[] {
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

export async function importHtmlContent(
  drive: drive_v3.Drive,
  docs: docs_v1.Docs,
  htmlContent: string,
  targetDocId: string,
  insertIndex: number
): Promise<{ insertedLength: number }> {
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
    const tempDocResponse = await docs.documents.get({ documentId: tempDocId });
    const tempBody = tempDocResponse.data.body?.content || [];

    const contentElements: any[] = [];
    for (const element of tempBody) {
      if (element.sectionBreak) continue;
      if (element.paragraph) {
        contentElements.push(element);
      } else if (element.table) {
        contentElements.push(element);
      }
    }

    if (contentElements.length === 0) {
      return { insertedLength: 0 };
    }

    interface ParagraphInfo {
      tabPrefix: string;
      originalText: string;
      bullet?: {
        nestingLevel: number;
        listId: string;
      };
      elements: any[];
    }

    let textToInsert = '';
    let totalTabsInserted = 0;
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

        let tabPrefix = '';
        if (element.paragraph.bullet) {
          const nestingLevel = element.paragraph.bullet.nestingLevel || 0;
          tabPrefix = '\t'.repeat(nestingLevel);
          totalTabsInserted += nestingLevel;
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

    if (textToInsert.length === 0) {
      return { insertedLength: 0 };
    }

    if (textToInsert.endsWith('\n')) {
      textToInsert = textToInsert.slice(0, -1);
    }

    await docs.documents.batchUpdate({
      documentId: targetDocId,
      requestBody: {
        requests: [{
          insertText: {
            location: { index: insertIndex },
            text: textToInsert,
          },
        }],
      },
    });

    interface BulletRun {
      startIndex: number;
      endIndex: number;
      bulletPreset: string;
    }

    const formattingRequests: any[] = [];
    let currentOffset = insertIndex;
    const bulletRuns: BulletRun[] = [];
    let currentBulletRun: BulletRun | null = null;

    for (const info of paragraphInfos) {
      const fullParagraphLength = info.tabPrefix.length + info.originalText.length;
      const paragraphStart = currentOffset;
      const paragraphEnd = currentOffset + fullParagraphLength;

      if (info.bullet) {
        const tempLists = tempDocResponse.data.lists || {};
        const listProps = tempLists[info.bullet.listId];

        let bulletPreset = 'BULLET_DISC_CIRCLE_SQUARE';
        if (listProps?.listProperties?.nestingLevels) {
          const levelProps = listProps.listProperties.nestingLevels[0];
          if (levelProps?.glyphType?.includes('DECIMAL') ||
              levelProps?.glyphType?.includes('ALPHA') ||
              levelProps?.glyphType?.includes('ROMAN')) {
            bulletPreset = 'NUMBERED_DECIMAL_ALPHA_ROMAN';
          }
        }

        if (currentBulletRun && currentBulletRun.bulletPreset === bulletPreset) {
          currentBulletRun.endIndex = paragraphEnd;
        } else {
          if (currentBulletRun) bulletRuns.push(currentBulletRun);
          currentBulletRun = { startIndex: paragraphStart, endIndex: paragraphEnd, bulletPreset };
        }
      } else {
        if (currentBulletRun) {
          bulletRuns.push(currentBulletRun);
          currentBulletRun = null;
        }
      }

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

    if (currentBulletRun) bulletRuns.push(currentBulletRun);

    for (const run of bulletRuns) {
      formattingRequests.push({
        createParagraphBullets: {
          range: { startIndex: run.startIndex, endIndex: run.endIndex },
          bulletPreset: run.bulletPreset,
        },
      });
    }

    if (formattingRequests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: targetDocId,
        requestBody: { requests: formattingRequests },
      });
    }

    const finalInsertedLength = textToInsert.length - totalTabsInserted;
    return { insertedLength: finalInsertedLength };
  } finally {
    try {
      await drive.files.delete({ fileId: tempDocId });
    } catch (cleanupError) {
      console.error('Failed to delete temporary document:', cleanupError);
    }
  }
}

export async function insertPhaseTable(
  docs: docs_v1.Docs,
  docId: string,
  tagToFind: string,
  phasesData: PhaseRow[]
): Promise<void> {
  const docSnap = await docs.documents.get({ documentId: docId });
  const docSnapContent = docSnap.data.body?.content || [];

  let tagLocation: { startIndex: number; endIndex: number } | null = null;
  for (const element of docSnapContent) {
    if (element.paragraph?.elements) {
      for (const el of element.paragraph.elements) {
        if (el.textRun?.content) {
          const text = el.textRun.content;
          const startOffset = el.startIndex || 0;
          const idx = text.indexOf(tagToFind);
          if (idx !== -1) {
            tagLocation = {
              startIndex: startOffset + idx,
              endIndex: startOffset + idx + tagToFind.length,
            };
            break;
          }
        }
      }
      if (tagLocation) break;
    }
  }

  if (!tagLocation) return;

  const numTableRows = phasesData.length + 1;
  const numTableCols = 4;

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          deleteContentRange: {
            range: { startIndex: tagLocation.startIndex, endIndex: tagLocation.endIndex },
          },
        },
        {
          insertTable: {
            rows: numTableRows,
            columns: numTableCols,
            location: { index: tagLocation.startIndex },
          },
        },
      ],
    },
  });

  const tableDoc = await docs.documents.get({ documentId: docId });
  const tableDocContent = tableDoc.data.body?.content || [];

  const tableCellTexts: string[][] = [
    ['Phase', 'Consultant', 'Fee Type', 'Amount'],
    ...phasesData.map(d => [
      d.phase || '',
      d.consultant || '',
      d.feeType || '',
      d.feeType === 'Fixed' && d.amount
        ? `$${parseFloat(d.amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
        : d.feeType === 'Hourly' ? 'Hourly' : '',
    ]),
  ];

  const cellInsertions: { index: number; text: string }[] = [];
  for (const element of tableDocContent) {
    if (element.table) {
      const rows = element.table.tableRows || [];
      if (rows.length === numTableRows && (rows[0]?.tableCells?.length || 0) === numTableCols) {
        for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
          const cells = rows[rowIdx].tableCells || [];
          for (let colIdx = 0; colIdx < cells.length; colIdx++) {
            const cellContent = cells[colIdx].content || [];
            if (cellContent.length > 0 && cellContent[0].startIndex !== undefined) {
              const text = (tableCellTexts[rowIdx] || [])[colIdx] || '';
              if (text) {
                cellInsertions.push({ index: (cellContent[0].startIndex as number) + 1, text });
              }
            }
          }
        }
        break;
      }
    }
  }

  cellInsertions.sort((a, b) => b.index - a.index);
  if (cellInsertions.length > 0) {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: cellInsertions.map(({ index, text }) => ({
          insertText: { location: { index }, text },
        })),
      },
    });
  }
}

export async function insertAdditionalServicesTable(
  docs: docs_v1.Docs,
  docId: string,
  tagToFind: string,
  rows: AdditionalServiceRow[]
): Promise<void> {
  const docSnap = await docs.documents.get({ documentId: docId });
  const docSnapContent = docSnap.data.body?.content || [];

  let tagLocation: { startIndex: number; endIndex: number } | null = null;
  for (const element of docSnapContent) {
    if (element.paragraph?.elements) {
      for (const el of element.paragraph.elements) {
        if (el.textRun?.content) {
          const text = el.textRun.content;
          const startOffset = el.startIndex || 0;
          const idx = text.indexOf(tagToFind);
          if (idx !== -1) {
            tagLocation = {
              startIndex: startOffset + idx,
              endIndex: startOffset + idx + tagToFind.length,
            };
            break;
          }
        }
      }
      if (tagLocation) break;
    }
  }

  if (!tagLocation) return;

  const numTableRows = rows.length + 1;
  const numTableCols = 3;

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          deleteContentRange: {
            range: { startIndex: tagLocation.startIndex, endIndex: tagLocation.endIndex },
          },
        },
        {
          insertTable: {
            rows: numTableRows,
            columns: numTableCols,
            location: { index: tagLocation.startIndex },
          },
        },
      ],
    },
  });

  const docAfter = await docs.documents.get({ documentId: docId });
  const docAfterContent = docAfter.data.body?.content || [];

  const cells: { startIndex: number }[] = [];
  for (const element of docAfterContent) {
    if (element.table) {
      for (const row of element.table.tableRows || []) {
        for (const cell of row.tableCells || []) {
          const contentStart = cell.content?.[0]?.startIndex;
          if (contentStart != null) cells.push({ startIndex: contentStart });
        }
      }
    }
  }

  const headers = ["Scope of Services", "Fee", ""];
  const cellInsertions: { index: number; text: string }[] = [];
  for (let i = 0; i < headers.length; i++) {
    if (cells[i]) cellInsertions.push({ index: cells[i].startIndex, text: headers[i] });
  }

  let total = 0;
  for (let r = 0; r < rows.length; r++) {
    const rowData = rows[r];
    const colStart = headers.length + r * numTableCols;
    const amtNum = rowData.amount ? parseFloat(rowData.amount) : null;
    if (amtNum && !isNaN(amtNum)) total += amtNum;
    const amtStr = amtNum && !isNaN(amtNum)
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amtNum)
      : "";
    const rowTexts = [rowData.description, amtStr, ""];
    for (let c = 0; c < numTableCols; c++) {
      const cellIdx = colStart + c;
      if (cells[cellIdx]) cellInsertions.push({ index: cells[cellIdx].startIndex, text: rowTexts[c] });
    }
  }

  cellInsertions.sort((a, b) => b.index - a.index);
  if (cellInsertions.length > 0) {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: cellInsertions.map(({ index, text }) => ({
          insertText: { location: { index }, text },
        })),
      },
    });
  }
}
