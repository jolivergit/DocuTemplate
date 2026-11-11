import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ParsedTemplate } from "@shared/schema";
import { GoogleDocsPicker, type PickedGoogleDoc } from "@/components/google-docs-picker";

interface TemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplateSelect: (template: ParsedTemplate) => void;
}

export function TemplateSelector({ open, onOpenChange, onTemplateSelect }: TemplateSelectorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { toast } = useToast();

  const parseMutation = useMutation({
    mutationFn: async (file: PickedGoogleDoc) => {
      const parsed = await apiRequest<ParsedTemplate>('POST', '/api/templates/parse', { fileId: file.id });
      return { ...parsed, documentId: parsed.documentId || file.id, documentName: parsed.documentName || file.name };
    },
    onSuccess: (data: ParsedTemplate) => {
      onTemplateSelect(data);
      toast({
        title: "Template loaded",
        description: `${data.documentName} has been loaded successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to load template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl min-w-0 max-h-[90dvh] overflow-y-auto [overflow-wrap:anywhere]" data-testid="dialog-template-selector"
        onInteractOutside={(event) => { if (pickerOpen) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">Load Template from Google Drive</DialogTitle>
          <DialogDescription data-testid="text-dialog-description">
            Select a Google Docs document to use as your template. The document should contain tagged sections like &lt;&lt;section_name&gt;&gt;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <GoogleDocsPicker
            disabled={parseMutation.isPending}
            onSelect={(file) => parseMutation.mutate(file)}
            onPickerOpenChange={setPickerOpen}
          />
          {parseMutation.isPending && (
            <p className="text-xs text-muted-foreground" role="status">Reading selected template…</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
