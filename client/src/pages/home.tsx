import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus, Sparkles, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TemplateSelector } from "@/components/template-selector";
import { TemplateStructure } from "@/components/template-structure";
import { ContentLibrary } from "@/components/content-library";
import { TagMappingPanel } from "@/components/tag-mapping-panel";
import { GenerateDocumentDialog } from "@/components/generate-document-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ParsedTemplate, ContentSnippet, Category, TagMapping } from "@shared/schema";

export default function Home() {
  const [selectedTemplate, setSelectedTemplate] = useState<ParsedTemplate | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [tagMappings, setTagMappings] = useState<Map<string, TagMapping>>(new Map());
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState<'structure' | 'library' | 'mapping' | null>(null);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  const { data: snippets = [] } = useQuery<ContentSnippet[]>({
    queryKey: ['/api/content-snippets'],
  });

  const handleTemplateSelect = (template: ParsedTemplate) => {
    setSelectedTemplate(template);
    setShowTemplateSelector(false);
    
    const order = template.sections.map(s => s.id);
    setSectionOrder(order);
    
    setTagMappings(new Map());
    setSelectedTag(null);
  };

  const handleSectionReorder = (newOrder: string[]) => {
    setSectionOrder(newOrder);
  };

  const handleTagClick = (tagName: string) => {
    setSelectedTag(tagName);
  };

  const handleSnippetSelect = (snippet: ContentSnippet) => {
    if (!selectedTag) return;
    
    const newMappings = new Map(tagMappings);
    newMappings.set(selectedTag, {
      tagName: selectedTag,
      snippetId: snippet.id,
      customContent: null,
    });
    setTagMappings(newMappings);
  };

  const handleCustomContentSet = (tagName: string, content: string) => {
    const newMappings = new Map(tagMappings);
    newMappings.set(tagName, {
      tagName,
      snippetId: null,
      customContent: content,
    });
    setTagMappings(newMappings);
  };

  const handleMappingRemove = (tagName: string) => {
    const newMappings = new Map(tagMappings);
    newMappings.delete(tagName);
    setTagMappings(newMappings);
  };

  const handleGenerate = () => {
    if (!selectedTemplate) return;
    setShowGenerateDialog(true);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="h-14 border-b flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-primary" data-testid="icon-app-logo" />
          <h1 className="text-lg font-semibold" data-testid="text-app-title">DocBuilder</h1>
          {selectedTemplate && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm text-muted-foreground" data-testid="text-template-name">
                {selectedTemplate.documentName}
              </span>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="default"
            onClick={() => setShowTemplateSelector(true)}
            data-testid="button-load-template"
          >
            <FileText className="w-4 h-4" />
            Load Template
          </Button>
          
          <Button
            variant="default"
            size="default"
            onClick={handleGenerate}
            disabled={!selectedTemplate || tagMappings.size === 0}
            data-testid="button-generate-document"
          >
            <Sparkles className="w-4 h-4" />
            Generate Document
          </Button>
          
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobilePanelOpen(isMobilePanelOpen ? null : 'structure')}
              data-testid="button-mobile-menu"
            >
              <Menu className="w-4 h-4" />
            </Button>
          </div>
          
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {!selectedTemplate ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md px-6">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" data-testid="icon-empty-state" />
              <h2 className="text-lg font-medium mb-2" data-testid="text-empty-title">No Template Loaded</h2>
              <p className="text-sm text-muted-foreground mb-6" data-testid="text-empty-description">
                Load a Google Docs template to start building your document. Templates use tagged sections like 
                <code className="mx-1 px-1 py-0.5 bg-muted rounded text-xs font-mono">&lt;&lt;section_name&gt;&gt;</code>
                to mark customizable content.
              </p>
              <Button
                variant="default"
                size="default"
                onClick={() => setShowTemplateSelector(true)}
                data-testid="button-load-template-empty"
              >
                <FileText className="w-4 h-4" />
                Load Template
              </Button>
            </div>
          </div>
        ) : (
          <div className="h-full hidden md:grid md:grid-cols-[320px,1fr,384px] gap-0">
            <div className="border-r overflow-hidden flex flex-col">
              <TemplateStructure
                template={selectedTemplate}
                sectionOrder={sectionOrder}
                onSectionReorder={handleSectionReorder}
                onTagClick={handleTagClick}
                selectedTag={selectedTag}
                tagMappings={tagMappings}
              />
            </div>
            
            <div className="overflow-hidden flex flex-col">
              <ContentLibrary
                snippets={snippets}
                categories={categories}
                onSnippetSelect={handleSnippetSelect}
                selectedTag={selectedTag}
              />
            </div>
            
            <div className="border-l overflow-hidden flex flex-col">
              <TagMappingPanel
                template={selectedTemplate}
                tagMappings={tagMappings}
                snippets={snippets}
                onTagClick={handleTagClick}
                onMappingRemove={handleMappingRemove}
                onCustomContentSet={handleCustomContentSet}
                selectedTag={selectedTag}
              />
            </div>
          </div>
        )}

        {selectedTemplate && isMobilePanelOpen && (
          <div className="md:hidden h-full overflow-auto">
            {isMobilePanelOpen === 'structure' && (
              <TemplateStructure
                template={selectedTemplate}
                sectionOrder={sectionOrder}
                onSectionReorder={handleSectionReorder}
                onTagClick={handleTagClick}
                selectedTag={selectedTag}
                tagMappings={tagMappings}
              />
            )}
            {isMobilePanelOpen === 'library' && (
              <ContentLibrary
                snippets={snippets}
                categories={categories}
                onSnippetSelect={handleSnippetSelect}
                selectedTag={selectedTag}
              />
            )}
            {isMobilePanelOpen === 'mapping' && (
              <TagMappingPanel
                template={selectedTemplate}
                tagMappings={tagMappings}
                snippets={snippets}
                onTagClick={handleTagClick}
                onMappingRemove={handleMappingRemove}
                onCustomContentSet={handleCustomContentSet}
                selectedTag={selectedTag}
              />
            )}
          </div>
        )}
      </main>

      <TemplateSelector
        open={showTemplateSelector}
        onOpenChange={setShowTemplateSelector}
        onTemplateSelect={handleTemplateSelect}
      />

      {selectedTemplate && (
        <GenerateDocumentDialog
          open={showGenerateDialog}
          onOpenChange={setShowGenerateDialog}
          template={selectedTemplate}
          tagMappings={Array.from(tagMappings.values())}
          sectionOrder={sectionOrder}
        />
      )}
    </div>
  );
}
