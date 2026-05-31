/**
 * FormattedBlock[] → Google Docs API batchUpdate request generator.
 */

import type { FormattedBlock, ListItemInfo, ParagraphInfo, ListRun, OrderedListStyle } from './types';

export function generateDocsRequests(
  blocks: FormattedBlock[],
  startIndex: number
): { requests: Record<string, unknown>[]; insertedLength: number; listRuns: ListRun[] } {
  const requests: Record<string, unknown>[] = [];
  let currentIndex = startIndex;
  let insertedLength = 0;
  let totalTabsInserted = 0;

  const listRuns: ListRun[] = [];
  let currentListRun: ListRun | null = null;
  const suspendedListRuns: ListRun[] = [];
  let paragraphsSinceLastList: ParagraphInfo[] = [];
  let lastEndedListRun: ListRun | null = null;

  for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
    const block = blocks[blockIdx];

    let blockText = '';
    let tabPrefix = '';

    if (block.type === 'listItem') {
      const listLevel = block.listLevel || 0;
      tabPrefix = '\t'.repeat(listLevel);
      blockText = tabPrefix;
      totalTabsInserted += listLevel;
    }

    for (const run of block.runs) {
      blockText += run.text;
    }

    if (blockIdx < blocks.length - 1) {
      blockText += '\n';
    }

    if (blockText.length === 0) continue;

    const blockStart = currentIndex;
    const blockEnd = currentIndex + blockText.length;

    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: blockText,
      },
    });

    let runOffset = tabPrefix.length;
    for (const run of block.runs) {
      if (run.text.length === 0) continue;

      const runStart = currentIndex + runOffset;
      const runEnd = runStart + run.text.length;

      const textStyle: {
        bold?: boolean;
        italic?: boolean;
        underline?: boolean;
        strikethrough?: boolean;
        link?: { url: string };
      } = {};
      const fields: string[] = [];

      if (run.bold) { textStyle.bold = true; fields.push('bold'); }
      if (run.italic) { textStyle.italic = true; fields.push('italic'); }
      if (run.underline) { textStyle.underline = true; fields.push('underline'); }
      if (run.strikethrough) { textStyle.strikethrough = true; fields.push('strikethrough'); }
      if (run.link) { textStyle.link = { url: run.link }; fields.push('link'); }

      if (fields.length > 0) {
        requests.push({
          updateTextStyle: {
            range: { startIndex: runStart, endIndex: runEnd },
            textStyle,
            fields: fields.join(','),
          },
        });
      }

      runOffset += run.text.length;
    }

    if (block.type.startsWith('heading')) {
      if (currentListRun) {
        listRuns.push(currentListRun);
        currentListRun = null;
      }
      const level = parseInt(block.type.replace('heading', ''));
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: blockStart, endIndex: blockEnd },
          paragraphStyle: { namedStyleType: `HEADING_${level}` },
          fields: 'namedStyleType',
        },
      });
    } else if (block.type === 'listItem') {
      const listLevel = block.listLevel || 0;
      const listType = block.listType || 'bullet';
      const orderedListStyle = block.orderedListStyle;
      const listStartNumber = block.listStartNumber || 1;

      const sameListType = currentListRun !== null && currentListRun.listType === listType;
      const sameOrderedStyle = currentListRun !== null && currentListRun.orderedListStyle === orderedListStyle;

      if (currentListRun && sameListType && sameOrderedStyle) {
        currentListRun.endIndex = blockEnd;
        currentListRun.items.push({
          startIndex: blockStart,
          endIndex: blockEnd,
          listLevel,
          listType,
          orderedListStyle,
          listStartNumber,
        });
      } else {
        let resumedSuspended = false;

        for (let i = suspendedListRuns.length - 1; i >= 0; i--) {
          const suspended = suspendedListRuns[i];
          if (suspended.listType === listType && suspended.orderedListStyle === orderedListStyle) {
            if (currentListRun) {
              listRuns.push(currentListRun);
              lastEndedListRun = currentListRun;
            }

            currentListRun = suspended;
            suspendedListRuns.splice(i, 1);

            if (paragraphsSinceLastList.length > 0) {
              if (!currentListRun.interveningParagraphs) {
                currentListRun.interveningParagraphs = [];
              }
              currentListRun.interveningParagraphs.push(...paragraphsSinceLastList);
              paragraphsSinceLastList = [];
            }

            currentListRun.endIndex = blockEnd;
            currentListRun.items.push({
              startIndex: blockStart,
              endIndex: blockEnd,
              listLevel,
              listType,
              orderedListStyle,
              listStartNumber,
            });

            resumedSuspended = true;
            break;
          }
        }

        if (!resumedSuspended) {
          let mergedWithPrevious = false;

          if (listStartNumber > 1 && lastEndedListRun !== null && paragraphsSinceLastList.length > 0) {
            const prevRun: ListRun = lastEndedListRun;
            if (prevRun.listType === listType && prevRun.orderedListStyle === orderedListStyle) {
              if (!prevRun.interveningParagraphs) {
                prevRun.interveningParagraphs = [];
              }
              prevRun.interveningParagraphs.push(...paragraphsSinceLastList);

              prevRun.endIndex = blockEnd;
              prevRun.items.push({
                startIndex: blockStart,
                endIndex: blockEnd,
                listLevel,
                listType,
                orderedListStyle,
                listStartNumber,
              });

              currentListRun = prevRun;
              const idx = listRuns.indexOf(prevRun);
              if (idx !== -1) {
                listRuns.splice(idx, 1);
              }

              paragraphsSinceLastList = [];
              lastEndedListRun = null;
              mergedWithPrevious = true;
            }
          }

          if (!mergedWithPrevious) {
            if (currentListRun) {
              const lastItemLevel =
                currentListRun.items.length > 0
                  ? currentListRun.items[currentListRun.items.length - 1].listLevel
                  : 0;

              if (listLevel > lastItemLevel) {
                suspendedListRuns.push(currentListRun);
              } else {
                listRuns.push(currentListRun);
                lastEndedListRun = currentListRun;
              }
            }
            paragraphsSinceLastList = [];

            currentListRun = {
              startIndex: blockStart,
              endIndex: blockEnd,
              listType,
              orderedListStyle,
              items: [
                {
                  startIndex: blockStart,
                  endIndex: blockEnd,
                  listLevel,
                  listType,
                  orderedListStyle,
                  listStartNumber,
                },
              ],
            };
          }
        }
      }
    } else if (block.type === 'blockquote') {
      if (currentListRun) {
        listRuns.push(currentListRun);
        lastEndedListRun = currentListRun;
        currentListRun = null;
      }
      paragraphsSinceLastList = [];
      lastEndedListRun = null;

      requests.push({
        updateParagraphStyle: {
          range: { startIndex: blockStart, endIndex: blockEnd },
          paragraphStyle: {
            indentFirstLine: { magnitude: 36, unit: 'PT' },
            indentStart: { magnitude: 36, unit: 'PT' },
          },
          fields: 'indentFirstLine,indentStart',
        },
      });
    } else {
      if (currentListRun) {
        listRuns.push(currentListRun);
        lastEndedListRun = currentListRun;
        currentListRun = null;
        paragraphsSinceLastList = [];
      }

      if (lastEndedListRun) {
        paragraphsSinceLastList.push({
          startIndex: blockStart,
          endIndex: blockEnd,
        });
      }
    }

    currentIndex += blockText.length;
    insertedLength += blockText.length;
  }

  if (currentListRun) {
    listRuns.push(currentListRun);
  }

  for (const suspended of suspendedListRuns) {
    listRuns.push(suspended);
  }

  listRuns.sort((a, b) => a.startIndex - b.startIndex);

  const mergedRuns: ListRun[] = [];
  const processedIndices = new Set<number>();

  for (let i = 0; i < listRuns.length; i++) {
    if (processedIndices.has(i)) continue;

    const parentRun = listRuns[i];
    const nestedIndices: number[] = [];

    for (let j = 0; j < listRuns.length; j++) {
      if (i === j) continue;
      const other = listRuns[j];
      if (
        other.startIndex >= parentRun.startIndex &&
        other.endIndex <= parentRun.endIndex
      ) {
        nestedIndices.push(j);
      }
    }

    if (nestedIndices.length === 0) {
      mergedRuns.push(parentRun);
      processedIndices.add(i);
    } else {
      const mergedItems = [...parentRun.items];
      const levelStyles: Map<number, OrderedListStyle | undefined> = new Map();
      levelStyles.set(0, parentRun.orderedListStyle);

      for (const nestedIdx of nestedIndices) {
        const nestedRun = listRuns[nestedIdx];
        for (const item of nestedRun.items) {
          mergedItems.push(item);
          levelStyles.set(item.listLevel, nestedRun.orderedListStyle);
        }
        processedIndices.add(nestedIdx);
      }

      mergedItems.sort((a, b) => a.startIndex - b.startIndex);

      const mergedRun: ListRun = {
        startIndex: parentRun.startIndex,
        endIndex: parentRun.endIndex,
        listType: parentRun.listType,
        orderedListStyle: parentRun.orderedListStyle,
        items: mergedItems,
        interveningParagraphs: parentRun.interveningParagraphs,
        levelStyles,
      };

      mergedRuns.push(mergedRun);
      processedIndices.add(i);
    }
  }

  listRuns.length = 0;
  listRuns.push(...mergedRuns);
  listRuns.sort((a, b) => a.startIndex - b.startIndex);

  // DEBUG: Log list runs
  console.log('\n--- List Runs (merged for single createParagraphBullets call) ---');
  for (let i = 0; i < listRuns.length; i++) {
    const run = listRuns[i];
    console.log(`  Run ${i}: type=${run.listType}, style=${run.orderedListStyle}, items=${run.items.length}, range=[${run.startIndex}-${run.endIndex}]`);
    if (run.levelStyles) {
      console.log(`    Level styles: ${JSON.stringify(Array.from(run.levelStyles.entries()))}`);
    }
    for (let j = 0; j < run.items.length; j++) {
      const item = run.items[j];
      console.log(`    Item ${j}: level=${item.listLevel}, start=${item.listStartNumber || 1}, range=[${item.startIndex}-${item.endIndex}]`);
    }
    if (run.interveningParagraphs && run.interveningParagraphs.length > 0) {
      console.log(`    Intervening paragraphs to de-bullet: ${run.interveningParagraphs.length}`);
      for (const p of run.interveningParagraphs) {
        console.log(`      Para: range=[${p.startIndex}-${p.endIndex}]`);
      }
    }
  }

  // Second pass: create bullets
  console.log('\n--- Creating Bullet Requests ---');
  for (const run of listRuns) {
    let bulletPreset: string;

    if (run.listType === 'bullet') {
      bulletPreset = 'BULLET_DISC_CIRCLE_SQUARE';
    } else {
      switch (run.orderedListStyle) {
        case 'upper-alpha':
        case 'lower-alpha':
          bulletPreset = 'NUMBERED_UPPERALPHA_ALPHA_ROMAN';
          break;
        case 'upper-roman':
        case 'lower-roman':
          bulletPreset = 'NUMBERED_UPPERROMAN_UPPERALPHA_DECIMAL';
          break;
        case 'zero-decimal':
          bulletPreset = 'NUMBERED_ZERODECIMAL_ALPHA_ROMAN';
          break;
        case 'decimal':
        default:
          bulletPreset = 'NUMBERED_DECIMAL_ALPHA_ROMAN';
          break;
      }
    }

    console.log(`  Creating bullets: style=${run.orderedListStyle} → preset=${bulletPreset}, range=[${run.startIndex}-${run.endIndex}]`);

    requests.push({
      createParagraphBullets: {
        range: { startIndex: run.startIndex, endIndex: run.endIndex },
        bulletPreset,
      },
    });

    if (run.interveningParagraphs && run.interveningParagraphs.length > 0) {
      for (const para of run.interveningParagraphs) {
        requests.push({
          deleteParagraphBullets: {
            range: { startIndex: para.startIndex, endIndex: para.endIndex },
          },
        });
      }
    }
  }

  const finalInsertedLength = insertedLength - totalTabsInserted;
  return { requests, insertedLength: finalInsertedLength, listRuns };
}
