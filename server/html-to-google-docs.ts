/**
 * Public API for HTML → Google Docs conversion.
 *
 * Parsing and request-generation logic live in:
 *   server/html-parser/parse.ts    — HTML → FormattedBlock[]
 *   server/html-parser/requests.ts — FormattedBlock[] → Docs API requests
 *   server/html-parser/types.ts    — shared interfaces
 */

import { parseHtmlToBlocks } from './html-parser/parse';
import { generateDocsRequests } from './html-parser/requests';
import type { ListRun } from './html-parser/types';

export type { ListRun };

export function htmlToGoogleDocsRequests(
  html: string,
  startIndex: number
): { requests: Record<string, unknown>[]; insertedLength: number; plainText: string; listRuns: ListRun[] } {
  const { blocks, plainText } = parseHtmlToBlocks(html);
  const { requests, insertedLength, listRuns } = generateDocsRequests(blocks, startIndex);
  return { requests, insertedLength, plainText, listRuns };
}

export function hasRichFormatting(html: string): boolean {
  if (!html || typeof html !== 'string') return false;
  return /<(strong|b|em|i|u|s|del|strike|h[1-6]|ul|ol|li|blockquote|a\s+href)/i.test(html);
}
