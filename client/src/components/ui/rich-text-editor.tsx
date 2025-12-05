import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

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
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
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

  if (!editor) {
    return null;
  }

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
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8",
            editor.isActive("orderedList") && "bg-muted"
          )}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          data-testid={testId ? `${testId}-ordered-list` : undefined}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
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
