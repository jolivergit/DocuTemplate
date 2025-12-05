import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import type { ParsedTemplate, TagMapping } from "@shared/schema";

const formSchema = z.object({
  outputName: z.string().min(1, "Document name is required"),
});

type FormData = z.infer<typeof formSchema>;

interface GenerateDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ParsedTemplate;
  tagMappings: TagMapping[];
  sectionOrder: string[];
}

export function GenerateDocumentDialog({
  open,
  onOpenChange,
  template,
  tagMappings,
  sectionOrder,
}: GenerateDocumentDialogProps) {
  const { toast } = useToast();
  const [generatedDocUrl, setGeneratedDocUrl] = useState<string | null>(null);
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      outputName: `${template.documentName} - Generated`,
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return await apiRequest<{ documentId: string; documentUrl: string }>('POST', '/api/documents/generate', {
        templateId: template.documentId,
        templateName: template.documentName,
        outputName: data.outputName,
        tagMappings,
        sectionOrder,
      });
    },
    onSuccess: (data) => {
      setGeneratedDocUrl(data.documentUrl);
      toast({
        title: "Document generated",
        description: "Your document has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to generate document",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Calculate unique tag count by composite key (name:type) since template.allTags may have duplicates
  const uniqueTagCount = new Set(template.allTags.map(tag => `${tag.name}:${tag.tagType}`)).size;

  const handleSubmit = (data: FormData) => {
    setGeneratedDocUrl(null);
    generateMutation.mutate(data);
  };

  const handleClose = () => {
    setGeneratedDocUrl(null);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg" data-testid="dialog-generate-document">
        <DialogHeader>
          <DialogTitle data-testid="text-generate-title">Generate Document</DialogTitle>
          <DialogDescription data-testid="text-generate-description">
            Create a new Google Doc with your mapped content and customizations.
          </DialogDescription>
        </DialogHeader>

        {!generatedDocUrl ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Template:</span>
                  <span className="font-medium" data-testid="text-template-name-preview">
                    {template.documentName}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Mapped tags:</span>
                  <span className="font-medium" data-testid="text-mapped-tags-count">
                    {tagMappings.length} of {uniqueTagCount}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Sections:</span>
                  <span className="font-medium" data-testid="text-sections-count">
                    {template.sections.length}
                  </span>
                </div>
              </div>

              <FormField
                control={form.control}
                name="outputName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter document name..."
                        {...field}
                        data-testid="input-document-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleClose}
                  disabled={generateMutation.isPending}
                  data-testid="button-cancel-generate"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={generateMutation.isPending}
                  data-testid="button-confirm-generate"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Document
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <div className="space-y-4">
            <div className="bg-primary/10 border border-primary/20 p-6 rounded-lg text-center">
              <Sparkles className="w-12 h-12 mx-auto mb-3 text-primary" data-testid="icon-success" />
              <h3 className="text-lg font-semibold mb-2" data-testid="text-success-title">
                Document Generated Successfully!
              </h3>
              <p className="text-sm text-muted-foreground mb-4" data-testid="text-success-description">
                Your document has been created in Google Drive.
              </p>
              <Button
                variant="default"
                size="default"
                onClick={() => window.open(generatedDocUrl, '_blank')}
                data-testid="button-open-document"
              >
                <ExternalLink className="w-4 h-4" />
                Open in Google Docs
              </Button>
            </div>

            <div className="flex items-center justify-center">
              <Button
                variant="ghost"
                onClick={handleClose}
                data-testid="button-close-success"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
