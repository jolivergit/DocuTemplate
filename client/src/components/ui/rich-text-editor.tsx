import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import OrderedList from "@tiptap/extension-ordered-list";
import { Bold, Italic, List, ListOrdered, ChevronDown } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

type OrderedListStyle = 'decimal' | 'zero-decimal' | 'lower-alpha' | 'upper-alpha' | 'lower-roman' | 'upper-roman';

const LIST_STYLES: { value: OrderedListStyle; label: string; preview: string }[] = [
  { value: 'decimal', label: 'Numbers', preview: '1, 2, 3' },
  { value: 'zero-decimal', label: 'Leading Zero', preview: '01, 02, 03' },
  { value: 'upper-alpha', label: 'Uppercase Letters', preview: 'A, B, C' },
  { value: 'lower-alpha', label: 'Lowercase Letters', preview: 'a, b, c' },
  { value: 'upper-roman', label: 'Uppercase Roman', preview: 'I, II, III' },
  { value: 'lower-roman', label: 'Lowercase Roman', preview: 'i, ii, iii' },
];

const CustomOrderedList = OrderedList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-list-style': {
        default: 'decimal',
        parseHTML: element => element.getAttribute('data-list-style') || 'decimal',
        renderHTML: attributes => {
          return {
            'data-list-style': attributes['data-list-style'],
          };
        },
      },
    };
  },
});

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  "data-testid"?: string;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Enter content...",
  className,
  "data-testid": testId,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: false,
      }),
      CustomOrderedList.configure({
        keepMarks: true,
        keepAttributes: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[120px] p-3 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  const setOrderedListStyle = (style: OrderedListStyle) => {
    if (!editor) return;
    
    if (editor.isActive('orderedList')) {
      editor.chain().focus().updateAttributes('orderedList', { 'data-list-style': style }).run();
    } else {
      editor.chain().focus().toggleOrderedList().updateAttributes('orderedList', { 'data-list-style': style }).run();
    }
  };

  const getCurrentListStyle = (): OrderedListStyle => {
    if (!editor) return 'decimal';
    const attrs = editor.getAttributes('orderedList');
    return (attrs['data-list-style'] as OrderedListStyle) || 'decimal';
  };

  if (!editor) {
    return null;
  }

  const currentStyle = getCurrentListStyle();
  const currentStyleInfo = LIST_STYLES.find(s => s.value === currentStyle) || LIST_STYLES[0];

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        className
      )}
      data-testid={testId}
    >
      <div className="flex items-center gap-1 border-b p-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8",
            editor.isActive("bold") && "bg-muted"
          )}
          onClick={() => editor.chain().focus().toggleBold().run()}
          data-testid={testId ? `${testId}-bold` : undefined}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8",
            editor.isActive("italic") && "bg-muted"
          )}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          data-testid={testId ? `${testId}-italic` : undefined}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-4 w-px bg-border" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8",
            editor.isActive("bulletList") && "bg-muted"
          )}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          data-testid={testId ? `${testId}-bullet-list` : undefined}
        >
          <List className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 gap-1 px-2",
                editor.isActive("orderedList") && "bg-muted"
              )}
              data-testid={testId ? `${testId}-ordered-list` : undefined}
            >
              <ListOrdered className="h-4 w-4" />
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {LIST_STYLES.map((style) => (
              <DropdownMenuItem
                key={style.value}
                onClick={() => setOrderedListStyle(style.value)}
                className={cn(
                  "flex items-center justify-between gap-4",
                  currentStyle === style.value && editor.isActive("orderedList") && "bg-muted"
                )}
                data-testid={testId ? `${testId}-list-style-${style.value}` : undefined}
              >
                <span>{style.label}</span>
                <span className="text-muted-foreground text-xs">{style.preview}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

interface RichTextDisplayProps {
  content: string;
  className?: string;
  "data-testid"?: string;
}

export function RichTextDisplay({
  content,
  className,
  "data-testid": testId,
}: RichTextDisplayProps) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      dangerouslySetInnerHTML={{ __html: content }}
      data-testid={testId}
    />
  );
}

export function stripHtmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
}
