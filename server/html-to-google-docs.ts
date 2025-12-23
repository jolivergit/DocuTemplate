/**
 * Converts TipTap HTML content to Google Docs API batchUpdate requests.
 * Uses htmlparser2 for proper DOM-based traversal to preserve document order and handle nested formatting.
 */

import * as htmlparser2 from 'htmlparser2';

interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  link?: string;
}

// Ordered list style types matching Google Docs glyph types
type OrderedListStyle = 'decimal' | 'zero-decimal' | 'lower-alpha' | 'upper-alpha' | 'lower-roman' | 'upper-roman';

interface FormattedBlock {
  type: 'paragraph' | 'heading1' | 'heading2' | 'heading3' | 'heading4' | 'heading5' | 'heading6' | 'listItem' | 'blockquote' | 'horizontalRule';
  runs: TextRun[];
  listLevel?: number;
  listType?: 'bullet' | 'ordered';
  orderedListStyle?: OrderedListStyle;
}

interface ParseResult {
  blocks: FormattedBlock[];
  plainText: string;
}

interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  link?: string;
}

// Simple DOM node interface matching what htmlparser2 produces
interface DomNode {
  type: string;
  name?: string;
  data?: string;
  attribs?: Record<string, string>;
  children?: DomNode[];
}

// Check if a tag is an inline formatting element
const INLINE_TAGS = new Set(['strong', 'b', 'em', 'i', 'u', 's', 'del', 'strike', 'a', 'span', 'code', 'mark', 'sub', 'sup']);
const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'hr', 'ul', 'ol', 'li', 'div']);

/**
 * Decode HTML entities
 */
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

/**
 * Parse HTML string to DOM
 */
function parseHtml(html: string): DomNode[] {
  return htmlparser2.parseDocument(html).children as unknown as DomNode[];
}

/**
 * Extract text content from DOM tree
 */
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

/**
 * Check if a node is an inline element or text
 */
function isInlineOrText(node: DomNode): boolean {
  if (node.type === 'text') return true;
  if (node.type === 'tag' && node.name) {
    return INLINE_TAGS.has(node.name.toLowerCase());
  }
  return false;
}

/**
 * Check if DOM starts with inline content (no block wrapper)
 */
function startsWithInlineContent(nodes: DomNode[]): boolean {
  for (const node of nodes) {
    // Skip whitespace-only text nodes
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

/**
 * Extract text runs from inline content, preserving formatting
 */
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
    
    // Update format state based on tag
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
    
    // Process children with new state
    for (const child of node.children || []) {
      runs.push(...extractRuns(child, newState));
    }
  }
  
  return runs;
}

/**
 * Get block type from element tag name
 */
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

/**
 * Process children that may contain multiple block elements (like <li><p>one</p><p>two</p></li>)
 * Returns runs with proper newlines between block children
 */
function extractBlockChildrenRuns(children: DomNode[], defaultState: FormatState): TextRun[] {
  const runs: TextRun[] = [];
  let blockCount = 0;
  
  for (const child of children) {
    if (child.type === 'tag' && child.name) {
      const tagName = child.name.toLowerCase();
      
      // If it's a nested list, skip it (handled separately)
      if (tagName === 'ul' || tagName === 'ol') continue;
      
      // If it's a block element (like <p>), extract its content
      if (tagName === 'p' || tagName === 'div') {
        // Add newline before subsequent blocks
        if (blockCount > 0 && runs.length > 0) {
          runs.push({ text: '\n' });
        }
        for (const pChild of child.children || []) {
          runs.push(...extractRuns(pChild, defaultState));
        }
        blockCount++;
      } else {
        // Inline element
        runs.push(...extractRuns(child, defaultState));
      }
    } else {
      runs.push(...extractRuns(child, defaultState));
    }
  }
  
  return runs;
}

/**
 * Info about a list context in the stack
 */
interface ListContext {
  type: 'bullet' | 'ordered';
  orderedStyle?: OrderedListStyle;
}

/**
 * Parse ordered list style from HTML attributes
 * Supports data-list-style attribute and HTML type attribute
 */
function parseOrderedListStyle(attribs?: Record<string, string>): OrderedListStyle {
  if (!attribs) return 'decimal';
  
  // Check data-list-style first (our custom attribute)
  const dataStyle = attribs['data-list-style'];
  if (dataStyle) {
    const validStyles: OrderedListStyle[] = ['decimal', 'zero-decimal', 'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman'];
    if (validStyles.includes(dataStyle as OrderedListStyle)) {
      return dataStyle as OrderedListStyle;
    }
  }
  
  // Check HTML type attribute as fallback
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
  
  // Check CSS list-style-type in style attribute
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

/**
 * Process DOM tree in document order, extracting blocks
 */
function processNode(
  node: DomNode,
  blocks: FormattedBlock[],
  listStack: ListContext[],
  insideBlock: FormattedBlock | null
): FormattedBlock | null {
  
  if (node.type === 'text' && node.data) {
    const text = decodeEntities(node.data);
    // Preserve whitespace (including spaces and nbsp) if there's content,
    // but skip pure whitespace at the start if no block yet
    if (text && (text.trim() || insideBlock)) {
      if (insideBlock) {
        insideBlock.runs.push({ text });
      } else if (text.trim()) {
        // Bootstrap a paragraph block for inline content (only if non-whitespace)
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
  
  // Handle list containers
  if (tagName === 'ul') {
    // Finalize any current block before entering list
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
    // Finalize any current block before entering list
    if (insideBlock && insideBlock.runs.length > 0) {
      blocks.push(insideBlock);
      insideBlock = null;
    }
    const orderedStyle = parseOrderedListStyle(node.attribs);
    listStack.push({ type: 'ordered', orderedStyle });
    for (const child of node.children || []) {
      insideBlock = processNode(child, blocks, listStack, insideBlock);
    }
    listStack.pop();
    return insideBlock;
  }
  
  // Handle list items
  if (tagName === 'li') {
    // Finalize any current block
    if (insideBlock && insideBlock.runs.length > 0) {
      blocks.push(insideBlock);
    }
    
    // Check for nested lists and extract content
    const childrenWithoutNestedLists: DomNode[] = [];
    const nestedLists: DomNode[] = [];
    
    for (const child of node.children || []) {
      if (child.type === 'tag' && (child.name?.toLowerCase() === 'ul' || child.name?.toLowerCase() === 'ol')) {
        nestedLists.push(child);
      } else {
        childrenWithoutNestedLists.push(child);
      }
    }
    
    // Extract runs from non-list children
    const runs = extractBlockChildrenRuns(childrenWithoutNestedLists, defaultState);
    
    // Only create a list item block if there's actual non-whitespace content
    // (Skip empty parent bullets that only contain nested lists or whitespace)
    const hasContent = runs.some(run => run.text.trim().length > 0);
    if (hasContent) {
      const currentList = listStack[listStack.length - 1];
      const listItem: FormattedBlock = {
        type: 'listItem',
        runs,
        listLevel: listStack.length - 1,
        listType: currentList?.type || 'bullet',
        orderedListStyle: currentList?.orderedStyle,
      };
      blocks.push(listItem);
    }
    
    // Process nested lists
    for (const nestedList of nestedLists) {
      processNode(nestedList, blocks, listStack, null);
    }
    
    return null;
  }
  
  // Handle block elements
  const blockType = getBlockType(tagName);
  if (blockType) {
    // Finalize any current block
    if (insideBlock && insideBlock.runs.length > 0) {
      blocks.push(insideBlock);
    }
    
    if (blockType === 'horizontalRule') {
      blocks.push({ type: 'horizontalRule', runs: [{ text: '---' }] });
      return null;
    }
    
    // Create new block
    const newBlock: FormattedBlock = { type: blockType, runs: [] };
    
    // For blockquotes, content might be wrapped in <p>
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
  
  // Handle inline formatting elements
  if (INLINE_TAGS.has(tagName)) {
    const runs = extractRuns(node, defaultState);
    if (runs.length > 0) {
      if (insideBlock) {
        insideBlock.runs.push(...runs);
      } else {
        // Bootstrap a paragraph block for inline-only content
        insideBlock = { type: 'paragraph', runs };
      }
    }
    return insideBlock;
  }
  
  // For other elements (div, etc.), process children
  for (const child of node.children || []) {
    insideBlock = processNode(child, blocks, listStack, insideBlock);
  }
  
  return insideBlock;
}

/**
 * Parse HTML into formatted blocks
 */
export function parseHtmlToBlocks(html: string): ParseResult {
  if (!html || typeof html !== 'string') {
    return { blocks: [], plainText: '' };
  }

  if (!html.includes('<')) {
    return { 
      blocks: [{ type: 'paragraph', runs: [{ text: html }] }], 
      plainText: html 
    };
  }

  const dom = parseHtml(html);
  const blocks: FormattedBlock[] = [];
  const listStack: ListContext[] = [];
  
  // Check if content starts with inline elements (no block wrapper)
  // If so, we need to bootstrap with a paragraph block
  let currentBlock: FormattedBlock | null = null;
  if (startsWithInlineContent(dom)) {
    currentBlock = { type: 'paragraph', runs: [] };
  }
  
  for (const node of dom) {
    currentBlock = processNode(node, blocks, listStack, currentBlock);
  }
  
  // Finalize any remaining block
  if (currentBlock && currentBlock.runs.length > 0) {
    blocks.push(currentBlock);
  }
  
  // Build plain text from blocks
  let plainText = '';
  for (const block of blocks) {
    for (const run of block.runs) {
      plainText += run.text;
    }
    plainText += '\n';
  }
  
  // If no blocks, treat as plain text
  if (blocks.length === 0) {
    const text = decodeEntities(getTextContent(dom)).trim();
    if (text) {
      blocks.push({ type: 'paragraph', runs: [{ text }] });
      plainText = text;
    }
  }
  
  return { blocks, plainText: plainText.trim() };
}

/**
 * Track list item info for batched bullet creation
 */
interface ListItemInfo {
  startIndex: number;
  endIndex: number;
  listLevel: number;
  listType: 'bullet' | 'ordered';
  orderedListStyle?: OrderedListStyle;
}

/**
 * Track contiguous list runs for grouped bullet creation
 */
interface ListRun {
  startIndex: number;
  endIndex: number;
  listType: 'bullet' | 'ordered';
  orderedListStyle?: OrderedListStyle;
  items: ListItemInfo[];
}

/**
 * Generate Google Docs API requests to insert formatted content
 * Uses LEADING TAB CHARACTERS to set nesting level for bullets (● → ○ → ■)
 * Google Docs counts leading tabs when createParagraphBullets is called to determine nesting
 * The tabs are consumed/removed by the bullet creation process
 */
export function generateDocsRequests(
  blocks: FormattedBlock[],
  startIndex: number
): { requests: any[]; insertedLength: number } {
  const requests: any[] = [];
  let currentIndex = startIndex;
  let insertedLength = 0;
  let totalTabsInserted = 0; // Track tabs that will be consumed by createParagraphBullets

  // Track list runs for batched bullet creation
  const listRuns: ListRun[] = [];
  let currentListRun: ListRun | null = null;

  // First pass: Insert all text (with leading tabs for list items), apply text styles, and track list positions
  for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
    const block = blocks[blockIdx];
    
    // Build text for this block
    let blockText = '';
    let tabPrefix = '';
    
    // For list items, prepend tab characters based on nesting level
    // Google Docs uses these leading tabs to determine nesting when createParagraphBullets is called
    if (block.type === 'listItem') {
      const listLevel = block.listLevel || 0;
      tabPrefix = '\t'.repeat(listLevel);
      blockText = tabPrefix;
      totalTabsInserted += listLevel; // Track tabs for later subtraction
    }
    
    for (const run of block.runs) {
      blockText += run.text;
    }

    // Add newline between blocks (except last)
    if (blockIdx < blocks.length - 1) {
      blockText += '\n';
    }

    if (blockText.length === 0) continue;

    const blockStart = currentIndex;
    const blockEnd = currentIndex + blockText.length;

    // Insert text
    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: blockText,
      },
    });

    // Apply text styles for each run (offset by tab prefix length)
    let runOffset = tabPrefix.length; // Start after the leading tabs
    for (const run of block.runs) {
      if (run.text.length === 0) continue;

      const runStart = currentIndex + runOffset;
      const runEnd = runStart + run.text.length;

      const textStyle: any = {};
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

    // Handle paragraph styles based on block type
    if (block.type.startsWith('heading')) {
      // End any current list run
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
      
      // Check if this continues the current list run (same list type and style)
      const sameListType = currentListRun !== null && currentListRun.listType === listType;
      const sameOrderedStyle = currentListRun !== null && currentListRun.orderedListStyle === orderedListStyle;
      if (currentListRun && sameListType && sameOrderedStyle) {
        // Extend the current run
        currentListRun.endIndex = blockEnd;
        currentListRun.items.push({
          startIndex: blockStart,
          endIndex: blockEnd,
          listLevel,
          listType,
          orderedListStyle,
        });
      } else {
        // End previous run if exists
        if (currentListRun) {
          listRuns.push(currentListRun);
        }
        // Start a new run
        currentListRun = {
          startIndex: blockStart,
          endIndex: blockEnd,
          listType,
          orderedListStyle,
          items: [{
            startIndex: blockStart,
            endIndex: blockEnd,
            listLevel,
            listType,
            orderedListStyle,
          }],
        };
      }
    } else if (block.type === 'blockquote') {
      // End any current list run
      if (currentListRun) {
        listRuns.push(currentListRun);
        currentListRun = null;
      }
      
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
      // Regular paragraph - end any current list run
      if (currentListRun) {
        listRuns.push(currentListRun);
        currentListRun = null;
      }
    }

    currentIndex += blockText.length;
    insertedLength += blockText.length;
  }

  // Finalize any remaining list run
  if (currentListRun) {
    listRuns.push(currentListRun);
  }

  // Second pass: Create bullets for each list run (ONE call per contiguous run)
  // This ensures all items in a run share the same listId
  // Google Docs uses the LEADING TABS inserted above to determine nesting level
  // The tabs are consumed/removed when bullets are created
  for (const run of listRuns) {
    let bulletPreset: string;
    
    if (run.listType === 'bullet') {
      bulletPreset = 'BULLET_DISC_CIRCLE_SQUARE';
    } else {
      // Map ordered list style to Google Docs bulletPreset
      // Editor supports: decimal, zero-decimal, upper-alpha, upper-roman
      // Legacy support: lower-alpha → upper-alpha, lower-roman → upper-roman
      switch (run.orderedListStyle) {
        case 'upper-alpha':
        case 'lower-alpha':
          // lower-alpha fallback for legacy content
          bulletPreset = 'NUMBERED_UPPERALPHA_ALPHA_ROMAN';
          break;
        case 'upper-roman':
        case 'lower-roman':
          // lower-roman fallback for legacy content
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
    
    requests.push({
      createParagraphBullets: {
        range: { startIndex: run.startIndex, endIndex: run.endIndex },
        bulletPreset,
      },
    });
  }

  // Subtract tabs from insertedLength since they are consumed by createParagraphBullets
  // This ensures callers have the correct final content length after bullet creation
  const finalInsertedLength = insertedLength - totalTabsInserted;

  return { requests, insertedLength: finalInsertedLength };
}

/**
 * Convert HTML to Google Docs requests
 */
export function htmlToGoogleDocsRequests(
  html: string,
  startIndex: number
): { requests: any[]; insertedLength: number; plainText: string } {
  const { blocks, plainText } = parseHtmlToBlocks(html);
  const { requests, insertedLength } = generateDocsRequests(blocks, startIndex);
  return { requests, insertedLength, plainText };
}

/**
 * Check if content has rich formatting
 */
export function hasRichFormatting(html: string): boolean {
  if (!html || typeof html !== 'string') return false;
  return /<(strong|b|em|i|u|s|del|strike|h[1-6]|ul|ol|li|blockquote|a\s+href)/i.test(html);
}
