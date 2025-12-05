/**
 * Converts HTML content from TipTap editor to plain text for Google Docs insertion.
 * Handles paragraphs, lists, and basic formatting while preserving structure.
 */

export function htmlToPlainText(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // If it doesn't look like HTML, return as-is
  if (!html.includes('<')) {
    return html;
  }

  let text = html;

  // Replace &nbsp; with regular spaces
  text = text.replace(/&nbsp;/g, ' ');

  // Handle line breaks
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Handle paragraphs - add newlines around them
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<p[^>]*>/gi, '');

  // Handle headers - add newlines and keep text
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  text = text.replace(/<h[1-6][^>]*>/gi, '');

  // Handle blockquotes
  text = text.replace(/<blockquote[^>]*>/gi, '\n"');
  text = text.replace(/<\/blockquote>/gi, '"\n');

  // Handle horizontal rules
  text = text.replace(/<hr\s*\/?>/gi, '\n---\n');

  // Process lists with a state machine approach
  // This handles nested ordered and unordered lists properly
  const result = processLists(text);
  text = result;

  // Remove remaining HTML tags (bold, italic, links, etc.)
  // but keep their text content
  text = text.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&apos;/g, "'");

  // Clean up excessive whitespace
  // Replace multiple spaces with single space only WITHIN text (not at start of line)
  // This preserves indentation while cleaning up inline spacing
  text = text.split('\n').map(line => {
    // Find the leading whitespace
    const leadingMatch = line.match(/^(\s*)/);
    const leadingSpaces = leadingMatch ? leadingMatch[1] : '';
    const rest = line.substring(leadingSpaces.length);
    // Collapse multiple spaces in the rest of the line, then trim the end
    const cleanedRest = rest.replace(/ {2,}/g, ' ').trimEnd();
    return leadingSpaces + cleanedRest;
  }).join('\n');
  
  // Replace more than 2 consecutive newlines with just 2
  text = text.replace(/\n{3,}/g, '\n\n');
  
  // Trim leading/trailing whitespace from entire text
  text = text.trim();

  return text;
}

/**
 * Process lists (ordered and unordered) with proper nesting and indentation
 */
function processLists(html: string): string {
  // Tokenize the HTML for list processing
  const tokens = tokenizeLists(html);
  
  let result = '';
  const listStack: { type: 'ol' | 'ul', counter: number }[] = [];
  let lastWasListItem = false;
  
  for (const token of tokens) {
    switch (token.type) {
      case 'ol_start':
        // When starting a nested list, add a newline if we're inside an item
        if (listStack.length > 0 && !result.endsWith('\n')) {
          result += '\n';
        }
        listStack.push({ type: 'ol', counter: 0 });
        lastWasListItem = false;
        break;
        
      case 'ul_start':
        // When starting a nested list, add a newline if we're inside an item
        if (listStack.length > 0 && !result.endsWith('\n')) {
          result += '\n';
        }
        listStack.push({ type: 'ul', counter: 0 });
        lastWasListItem = false;
        break;
        
      case 'ol_end':
      case 'ul_end':
        listStack.pop();
        if (listStack.length === 0 && !result.endsWith('\n')) {
          result += '\n';
        }
        lastWasListItem = false;
        break;
        
      case 'li_start':
        if (listStack.length > 0) {
          const currentList = listStack[listStack.length - 1];
          const indent = '  '.repeat(listStack.length - 1);
          
          if (currentList.type === 'ol') {
            currentList.counter++;
            result += `${indent}${currentList.counter}. `;
          } else {
            result += `${indent}• `;
          }
          lastWasListItem = true;
        }
        break;
        
      case 'li_end':
        // Only add newline if we haven't already (nested list would have added one)
        if (!result.endsWith('\n')) {
          result += '\n';
        }
        lastWasListItem = false;
        break;
        
      case 'text':
        result += token.content;
        break;
    }
  }
  
  return result;
}

interface Token {
  type: 'ol_start' | 'ol_end' | 'ul_start' | 'ul_end' | 'li_start' | 'li_end' | 'text';
  content?: string;
}

/**
 * Tokenize HTML into list-related tokens and text content
 */
function tokenizeLists(html: string): Token[] {
  const tokens: Token[] = [];
  const tagPattern = /<(\/?)(ol|ul|li)(?:\s[^>]*)?>/gi;
  
  let lastIndex = 0;
  let match;
  
  while ((match = tagPattern.exec(html)) !== null) {
    // Add any text before this tag
    if (match.index > lastIndex) {
      const textContent = html.substring(lastIndex, match.index);
      if (textContent) {
        tokens.push({ type: 'text', content: textContent });
      }
    }
    
    const isClosing = match[1] === '/';
    const tagName = match[2].toLowerCase() as 'ol' | 'ul' | 'li';
    
    if (isClosing) {
      tokens.push({ type: `${tagName}_end` as Token['type'] });
    } else {
      tokens.push({ type: `${tagName}_start` as Token['type'] });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add any remaining text after the last tag
  if (lastIndex < html.length) {
    const textContent = html.substring(lastIndex);
    if (textContent) {
      tokens.push({ type: 'text', content: textContent });
    }
  }
  
  return tokens;
}
