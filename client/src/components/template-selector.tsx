import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileText, Search, Loader2, FolderOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ParsedTemplate } from "@shared/schema";

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

interface TemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplateSelect: (template: ParsedTemplate) => void;
}

export function TemplateSelector({ open, onOpenChange, onTemplateSelect }: TemplateSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: files = [], isLoading } = useQuery<GoogleDriveFile[]>({
    queryKey: ['/api/google-drive/files'],
    enabled: open,
  });

  const parseMutation = useMutation({
    mutationFn: async (fileId: string) => {
      return await apiRequest('POST', '/api/templates/parse', { fileId });
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

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFileSelect = (file: GoogleDriveFile) => {
    parseMutation.mutate(file.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-template-selector">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">Load Template from Google Drive</DialogTitle>
          <DialogDescription data-testid="text-dialog-description">
            Select a Google Docs document to use as your template. The document should contain tagged sections like &lt;&lt;section_name&gt;&gt;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" data-testid="icon-search" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-documents"
            />
          </div>

          <ScrollArea className="h-96 border rounded-md">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" data-testid="icon-loading" />
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <FolderOpen className="w-12 h-12 mb-3 text-muted-foreground" data-testid="icon-empty-folder" />
                <p className="text-sm font-medium mb-1" data-testid="text-no-documents-title">No documents found</p>
                <p className="text-xs text-muted-foreground" data-testid="text-no-documents-description">
                  {searchQuery ? "Try a different search term" : "Create some Google Docs to get started"}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredFiles.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => handleFileSelect(file)}
                    disabled={parseMutation.isPending}
                    className="w-full flex items-center gap-3 p-3 rounded-md hover-elevate active-elevate-2 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid={`button-file-${file.id}`}
                  >
                    <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" data-testid={`text-file-name-${file.id}`}>
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground" data-testid={`text-file-date-${file.id}`}>
                        Modified {new Date(file.modifiedTime).toLocaleDateString()}
                      </p>
                    </div>
                    {parseMutation.isPending && (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
