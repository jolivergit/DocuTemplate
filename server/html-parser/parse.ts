/**
 * HTML → FormattedBlock[] parser.
 * Converts TipTap HTML to an intermediate block representation.
 */

import * as htmlparser2 from 'htmlparser2';
import type {
  TextRun,
  FormattedBlock,
  ParseResult,
  FormatState,
  DomNode,
  ListContext,
  OrderedListStyle,
} from './types';

export const INLINE_TAGS = new Set([
  'strong', 'b', 'em', 'i', 'u', 's', 'del', 'strike',
  'a', 'span', 'code', 'mark', 'sub', 'sup',
]);
export const BLOCK_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'hr', 'ul', 'ol', 'li', 'div',
]);

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function parseHtml(html: string): DomNode[] {
  return htmlparser2.parseDocument(html).children as unknown as DomNode[];
}

function getTextContent(nodes: DomNode[]): string {
  let text = '';
  for (const node of nodes) {
    if (node.type === 'text' && node.data) {
      text += node.data;
    } else if (node.children) {
      text += getTextContent(node.children);
    }
  }
  return text;
}

function isInlineOrText(node: DomNode): boolean {
  if (node.type === 'text') return true;
  if (node.type === 'tag' && node.name) {
    return INLINE_TAGS.has(node.name.toLowerCase());
  }
  return false;
}

function startsWithInlineContent(nodes: DomNode[]): boolean {
  for (const node of nodes) {
    if (node.type === 'text' && node.data?.trim() === '') continue;
    if (node.type === 'text') return true;
    if (node.type === 'tag' && node.name) {
      const tagName = node.name.toLowerCase();
      if (INLINE_TAGS.has(tagName)) return true;
      if (BLOCK_TAGS.has(tagName)) return false;
    }
    break;
  }
  return false;
}

function extractRuns(node: DomNode, state: FormatState): TextRun[] {
  const runs: TextRun[] = [];

  if (node.type === 'text' && node.data) {
    const text = decodeEntities(node.data);
    if (text) {
      const run: TextRun = { text };
      if (state.bold) run.bold = true;
      if (state.italic) run.italic = true;
      if (state.underline) run.underline = true;
      if (state.strikethrough) run.strikethrough = true;
      if (state.link) run.link = state.link;
      runs.push(run);
    }
    return runs;
  }

  if (node.type === 'tag' && node.name) {
    const tagName = node.name.toLowerCase();
    const newState = { ...state };

    if (tagName === 'strong' || tagName === 'b') {
      newState.bold = true;
    } else if (tagName === 'em' || tagName === 'i') {
      newState.italic = true;
    } else if (tagName === 'u') {
      newState.underline = true;
    } else if (tagName === 's' || tagName === 'del' || tagName === 'strike') {
      newState.strikethrough = true;
    } else if (tagName === 'a') {
      const href = node.attribs?.href;
      if (href) newState.link = href;
    } else if (tagName === 'br') {
      runs.push({ text: '\n' });
      return runs;
    }

    for (const child of node.children || []) {
      runs.push(...extractRuns(child, newState));
    }
  }

  return runs;
}

function getBlockType(tagName: string): FormattedBlock['type'] | null {
  const tag = tagName.toLowerCase();
  if (tag === 'p') return 'paragraph';
  if (tag === 'h1') return 'heading1';
  if (tag === 'h2') return 'heading2';
  if (tag === 'h3') return 'heading3';
  if (tag === 'h4') return 'heading4';
  if (tag === 'h5') return 'heading5';
  if (tag === 'h6') return 'heading6';
  if (tag === 'blockquote') return 'blockquote';
  if (tag === 'hr') return 'horizontalRule';
  return null;
}

function extractBlockChildrenRuns(children: DomNode[], defaultState: FormatState): TextRun[] {
  const runs: TextRun[] = [];
  let blockCount = 0;

  for (const child of children) {
    if (child.type === 'tag' && child.name) {
      const tagName = child.name.toLowerCase();
      if (tagName === 'ul' || tagName === 'ol') continue;

      if (tagName === 'p' || tagName === 'div') {
        if (blockCount > 0 && runs.length > 0) {
          runs.push({ text: '\n' });
        }
        for (const pChild of child.children || []) {
          runs.push(...extractRuns(pChild, defaultState));
        }
        blockCount++;
      } else {
        runs.push(...extractRuns(child, defaultState));
      }
    } else {
      runs.push(...extractRuns(child, defaultState));
    }
  }

  return runs;
}

function parseOrderedListStyle(attribs?: Record<string, string>): OrderedListStyle {
  if (!attribs) return 'decimal';

  const dataStyle = attribs['data-list-style'];
  if (dataStyle) {
    const validStyles: OrderedListStyle[] = [
      'decimal', 'zero-decimal', 'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman',
    ];
    if (validStyles.includes(dataStyle as OrderedListStyle)) {
      return dataStyle as OrderedListStyle;
    }
  }

  const typeAttr = attribs['type'];
  if (typeAttr) {
    switch (typeAttr) {
      case '1': return 'decimal';
      case 'A': return 'upper-alpha';
      case 'a': return 'lower-alpha';
      case 'I': return 'upper-roman';
      case 'i': return 'lower-roman';
    }
  }

  const style = attribs['style'];
  if (style) {
    if (style.includes('decimal-leading-zero')) return 'zero-decimal';
    if (style.includes('upper-alpha') || style.includes('upper-latin')) return 'upper-alpha';
    if (style.includes('lower-alpha') || style.includes('lower-latin')) return 'lower-alpha';
    if (style.includes('upper-roman')) return 'upper-roman';
    if (style.includes('lower-roman')) return 'lower-roman';
  }

  return 'decimal';
}

function processNode(
  node: DomNode,
  blocks: FormattedBlock[],
  listStack: ListContext[],
  insideBlock: FormattedBlock | null
): FormattedBlock | null {
  if (node.type === 'text' && node.data) {
    const text = decodeEntities(node.data);
    if (text && (text.trim() || insideBlock)) {
      if (insideBlock) {
        insideBlock.runs.push({ text });
      } else if (text.trim()) {
        insideBlock = { type: 'paragraph', runs: [{ text }] };
      }
    }
    return insideBlock;
  }

  if (node.type !== 'tag' || !node.name) {
    return insideBlock;
  }

  const tagName = node.name.toLowerCase();
  const defaultState: FormatState = { bold: false, italic: false, underline: false, strikethrough: false };

  if (tagName === 'ul') {
    if (insideBlock && insideBlock.runs.length > 0) {
      blocks.push(insideBlock);
      insideBlock = null;
    }
    listStack.push({ type: 'bullet' });
    for (const child of node.children || []) {
      insideBlock = processNode(child, blocks, listStack, insideBlock);
    }
    listStack.pop();
    return insideBlock;
  }

  if (tagName === 'ol') {
    if (insideBlock && insideBlock.runs.length > 0) {
      blocks.push(insideBlock);
      insideBlock = null;
    }
    const orderedStyle = parseOrderedListStyle(node.attribs);
    const startAttr = node.attribs?.['start'];
    const startNumber = startAttr ? parseInt(startAttr, 10) : 1;
    listStack.push({ type: 'ordered', orderedStyle, startNumber });
    for (const child of node.children || []) {
      insideBlock = processNode(child, blocks, listStack, insideBlock);
    }
    listStack.pop();
    return insideBlock;
  }

  if (tagName === 'li') {
    if (insideBlock && insideBlock.runs.length > 0) {
      blocks.push(insideBlock);
    }

    const childrenWithoutNestedLists: DomNode[] = [];
    const nestedLists: DomNode[] = [];

    for (const child of node.children || []) {
      if (child.type === 'tag' && (child.name?.toLowerCase() === 'ul' || child.name?.toLowerCase() === 'ol')) {
        nestedLists.push(child);
      } else {
        childrenWithoutNestedLists.push(child);
      }
    }

    const runs = extractBlockChildrenRuns(childrenWithoutNestedLists, defaultState);
    const hasContent = runs.some((run) => run.text.trim().length > 0);
    if (hasContent) {
      const currentList = listStack[listStack.length - 1];
      const listItem: FormattedBlock = {
        type: 'listItem',
        runs,
        listLevel: listStack.length - 1,
        listType: currentList?.type || 'bullet',
        orderedListStyle: currentList?.orderedStyle,
        listStartNumber: currentList?.startNumber,
      };
      blocks.push(listItem);
    }

    for (const nestedList of nestedLists) {
      processNode(nestedList, blocks, listStack, null);
    }

    return null;
  }

  const blockType = getBlockType(tagName);
  if (blockType) {
    if (insideBlock && insideBlock.runs.length > 0) {
      blocks.push(insideBlock);
    }

    if (blockType === 'horizontalRule') {
      blocks.push({ type: 'horizontalRule', runs: [{ text: '---' }] });
      return null;
    }

    const newBlock: FormattedBlock = { type: blockType, runs: [] };

    if (blockType === 'blockquote') {
      newBlock.runs = extractBlockChildrenRuns(node.children || [], defaultState);
    } else {
      for (const child of node.children || []) {
        newBlock.runs.push(...extractRuns(child, defaultState));
      }
    }

    if (newBlock.runs.length > 0) {
      blocks.push(newBlock);
    }

    return null;
  }

  if (INLINE_TAGS.has(tagName)) {
    const runs = extractRuns(node, defaultState);
    if (runs.length > 0) {
      if (insideBlock) {
        insideBlock.runs.push(...runs);
      } else {
        insideBlock = { type: 'paragraph', runs };
      }
    }
    return insideBlock;
  }

  for (const child of node.children || []) {
    insideBlock = processNode(child, blocks, listStack, insideBlock);
  }

  return insideBlock;
}

export function parseHtmlToBlocks(html: string): ParseResult {
  if (!html || typeof html !== 'string') {
    return { blocks: [], plainText: '' };
  }

  if (!html.includes('<')) {
    return {
      blocks: [{ type: 'paragraph', runs: [{ text: html }] }],
      plainText: html,
    };
  }

  const dom = parseHtml(html);
  const blocks: FormattedBlock[] = [];
  const listStack: ListContext[] = [];

  let currentBlock: FormattedBlock | null = null;
  if (startsWithInlineContent(dom)) {
    currentBlock = { type: 'paragraph', runs: [] };
  }

  for (const node of dom) {
    currentBlock = processNode(node, blocks, listStack, currentBlock);
  }

  if (currentBlock && currentBlock.runs.length > 0) {
    blocks.push(currentBlock);
  }

  let plainText = '';
  for (const block of blocks) {
    for (const run of block.runs) {
      plainText += run.text;
    }
    plainText += '\n';
  }

  if (blocks.length === 0) {
    const text = decodeEntities(getTextContent(dom)).trim();
    if (text) {
      blocks.push({ type: 'paragraph', runs: [{ text }] });
      plainText = text;
    }
  }

  // DEBUG: Log parsed blocks
  console.log('\n--- Parsed Blocks ---');
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const text = block.runs.map((r) => r.text).join('');
    const preview = text.substring(0, 80).replace(/\n/g, '\\n');
    if (block.type === 'listItem') {
      const startInfo = block.listStartNumber && block.listStartNumber > 1 ? `, start=${block.listStartNumber}` : '';
      console.log(`  [${i}] ${block.type} (level=${block.listLevel}, type=${block.listType}, style=${block.orderedListStyle}${startInfo}): "${preview}..."`);
    } else {
      console.log(`  [${i}] ${block.type}: "${preview}..."`);
    }
  }

  return { blocks, plainText: plainText.trim() };
}
