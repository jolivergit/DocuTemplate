export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  link?: string;
}

export type OrderedListStyle =
  | 'decimal'
  | 'zero-decimal'
  | 'lower-alpha'
  | 'upper-alpha'
  | 'lower-roman'
  | 'upper-roman';

export interface FormattedBlock {
  type:
    | 'paragraph'
    | 'heading1'
    | 'heading2'
    | 'heading3'
    | 'heading4'
    | 'heading5'
    | 'heading6'
    | 'listItem'
    | 'blockquote'
    | 'horizontalRule';
  runs: TextRun[];
  listLevel?: number;
  listType?: 'bullet' | 'ordered';
  orderedListStyle?: OrderedListStyle;
  listStartNumber?: number;
}

export interface ParseResult {
  blocks: FormattedBlock[];
  plainText: string;
}

export interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  link?: string;
}

export interface DomNode {
  type: string;
  name?: string;
  data?: string;
  attribs?: Record<string, string>;
  children?: DomNode[];
}

export interface ListContext {
  type: 'bullet' | 'ordered';
  orderedStyle?: OrderedListStyle;
  startNumber?: number;
}

export interface ListItemInfo {
  startIndex: number;
  endIndex: number;
  listLevel: number;
  listType: 'bullet' | 'ordered';
  orderedListStyle?: OrderedListStyle;
  listStartNumber?: number;
}

export interface ParagraphInfo {
  startIndex: number;
  endIndex: number;
}

export interface ListRun {
  startIndex: number;
  endIndex: number;
  listType: 'bullet' | 'ordered';
  orderedListStyle?: OrderedListStyle;
  items: ListItemInfo[];
  interveningParagraphs?: ParagraphInfo[];
  levelStyles?: Map<number, OrderedListStyle | undefined>;
}
