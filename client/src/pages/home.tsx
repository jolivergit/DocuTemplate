import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { TemplateSelector } from "@/components/template-selector";
import { TagsPanel } from "@/components/tags-panel";
import { ContentLibrary } from "@/components/content-library";
import { GenerateDocumentDialog, type ReturnContext } from "@/components/generate-document-dialog";
import { FieldValueDialog } from "@/components/field-value-dialog";
import type { ParsedTemplate, ContentSnippet, Category, TagMapping, User as UserType, FieldValue, TagType } from "@shared/schema";

export default function Home() {
  const search = useSearch();
  const returnContext = useMemo<ReturnContext | null>(() => {
    const params = new URLSearchParams(search);
    const type = params.get("returnTo");
    const id = params.get("returnToId");
    if (type === "proposal" && id) return { type: "proposal", id };
    return null;
  }, [search]);

  const [selectedTemplate, setSelectedTemplate] = useState<ParsedTemplate | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedTagType, setSelectedTagType] = useState<TagType | null>(null);
  const [tagMappings, setTagMappings] = useState<Map<string, TagMapping>>(new Map());
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'tags' | 'content' | null>(null);
  const [fieldValueToEdit, setFieldValueToEdit] = useState<FieldValue | null>(null);
  const [customFieldTags, setCustomFieldTags] = useState<string[]>([]);

  const { data: user } = useQuery<UserType | null>({
    queryKey: ['/auth/user'],
    retry: false,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    enabled: !!user,
  });

  const { data: snippets = [] } = useQuery<ContentSnippet[]>({
    queryKey: ['/api/content-snippets'],
    enabled: !!user,
  });

  const { data: fieldValues = [] } = useQuery<FieldValue[]>({
    queryKey: ['/api/field-values'],
    enabled: !!user,
  });

  const handleTemplateSelect = (template: ParsedTemplate) => {
    setSelectedTemplate(template);
    setShowTemplateSelector(false);
    setSectionOrder(template.sections.map(s => s.id));
    setTagMappings(new Map());
    setSelectedTag(null);
    setSelectedTagType(null);
    setCustomFieldTags([]);
  };

  const handleAddCustomField = (fieldName: string) => {
    const existsInTemplate = selectedTemplate?.allTags.some(
      t => t.name === fieldName && t.tagType === 'field'
    );
    if (!customFieldTags.includes(fieldName) && !existsInTemplate) {
      setCustomFieldTags([...customFieldTags, fieldName]);
    }
  };

  const getEnhancedTemplate = (): ParsedTemplate | null => {
    if (!selectedTemplate) return null;
    const customTags = customFieldTags.map(name => ({
      type: 'custom',
      name,
      tagType: 'field' as TagType,
      startIndex: -1,
      endIndex: -1,
    }));
    return {
      ...selectedTemplate,
      allTags: [...selectedTemplate.allTags, ...customTags],
    };
  };

  const enhancedTemplate = getEnhancedTemplate();

  const handleSectionReorder = (newOrder: string[]) => {
    setSectionOrder(newOrder);
  };

  const makeTagKey = (name: string, type: string) => `${name}:${type}`;

  const handleTagClick = (tagName: string, tagType: TagType) => {
    setSelectedTag(tagName);
    setSelectedTagType(tagType);
  };

  const handleSnippetSelect = (snippet: ContentSnippet) => {
    if (!selectedTag || !selectedTagType) return;
    const newMappings = new Map(tagMappings);
    newMappings.set(makeTagKey(selectedTag, selectedTagType), {
      tagName: selectedTag,
      tagType: selectedTagType,
      snippetId: snippet.id,
      customContent: null,
      fieldValueId: null,
    });
    setTagMappings(newMappings);
    setSelectedTag(null);
    setSelectedTagType(null);
  };

  const handleFieldValueSelect = (fieldValue: FieldValue) => {
    if (!selectedTag || !selectedTagType) return;
    const newMappings = new Map(tagMappings);
    newMappings.set(makeTagKey(selectedTag, selectedTagType), {
      tagName: selectedTag,
      tagType: selectedTagType,
      snippetId: null,
      customContent: null,
      fieldValueId: fieldValue.id,
    });
    setTagMappings(newMappings);
    setSelectedTag(null);
    setSelectedTagType(null);
  };

  const handleCustomContentSet = (tagName: string, tagType: TagType, content: string) => {
    const newMappings = new Map(tagMappings);
    newMappings.set(makeTagKey(tagName, tagType), {
      tagName,
      tagType,
      snippetId: null,
      customContent: content,
      fieldValueId: null,
    });
    setTagMappings(newMappings);
  };

  const handleMappingRemove = (tagName: string, tagType: TagType) => {
    const newMappings = new Map(tagMappings);
    newMappings.delete(makeTagKey(tagName, tagType));
    setTagMappings(newMappings);
  };

  const handleSectionHeaderSet = (tagName: string, tagType: TagType, header: string, level: string) => {
    const key = makeTagKey(tagName, tagType);
    const existing = tagMappings.get(key);
    if (!existing) return;
    const newMappings = new Map(tagMappings);
    newMappings.set(key, {
      ...existing,
      sectionHeader: header || null,
      sectionHeaderLevel: level || null,
    });
    setTagMappings(newMappings);
  };

  const handleFieldValueEdit = (fieldValueId: string) => {
    const fieldValue = fieldValues.find(fv => fv.id === fieldValueId);
    if (fieldValue) {
      setFieldValueToEdit(fieldValue);
    }
  };

  const handleGenerate = () => {
    if (!selectedTemplate) return;
    setShowGenerateDialog(true);
  };

  const mappedCount = selectedTemplate ? selectedTemplate.allTags.filter(t => {
    const key = makeTagKey(t.name, t.tagType);
    return tagMappings.has(key);
  }).length : 0;
  const canGenerate = selectedTemplate && mappedCount > 0;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Doc builder sub-header */}
      <div className="h-14 border-b flex items-center justify-between px-4 flex-shrink-0 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Doc Builder</h2>
          {selectedTemplate && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm text-muted-foreground truncate max-w-[150px] sm:max-w-[250px]" data-testid="text-template-name">
                {selectedTemplate.documentName}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTemplateSelector(true)}
            data-testid="button-load-template"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden md:inline">Load Template</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleGenerate}
            disabled={!canGenerate}
            data-testid="button-generate-document"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden md:inline">Generate</span>
          </Button>
        </div>
      </div>

      <main className="flex-1 overflow-hidden">
        {/* Desktop: Two-panel resizable layout */}
        <div className="h-full hidden md:flex">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={50} minSize={25} className="bg-card">
              <div className="flex flex-col h-full border-r">
                <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Template Tags
                  </h2>
                </div>
                <div className="flex-1 overflow-hidden">
                  {enhancedTemplate ? (
                    <TagsPanel
                      template={enhancedTemplate}
                      sectionOrder={sectionOrder}
                      onSectionReorder={handleSectionReorder}
                      onTagClick={handleTagClick}
                      selectedTag={selectedTag}
                      selectedTagType={selectedTagType}
                      tagMappings={tagMappings}
                      snippets={snippets}
                      fieldValues={fieldValues}
                      onMappingRemove={handleMappingRemove}
                      onCustomContentSet={handleCustomContentSet}
                      onFieldValueEdit={handleFieldValueEdit}
                      onSectionHeaderSet={handleSectionHeaderSet}
                      onAddCustomField={handleAddCustomField}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center p-6">
                      <div className="text-center max-w-xs">
                        <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" data-testid="icon-empty-tags" />
                        <h3 className="text-sm font-medium mb-2" data-testid="text-empty-tags-title">No Template Loaded</h3>
                        <p className="text-xs text-muted-foreground mb-4" data-testid="text-empty-tags-description">
                          Load a template to see its tags and start mapping content.
                        </p>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setShowTemplateSelector(true)}
                          data-testid="button-load-template-empty"
                        >
                          <FileText className="w-4 h-4" />
                          Load Template
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle className="bg-border hover:bg-primary/20 transition-colors" />

            <ResizablePanel defaultSize={50} minSize={25} className="bg-card">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Content Library
                  </h2>
                </div>
                <div className="flex-1 overflow-hidden">
                  <ContentLibrary
                    snippets={snippets}
                    categories={categories}
                    fieldValues={fieldValues}
                    onSnippetSelect={handleSnippetSelect}
                    onFieldValueSelect={handleFieldValueSelect}
                    selectedTag={selectedTag}
                    selectedTagType={selectedTagType}
                  />
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Mobile: Bottom navigation with panels */}
        <div className="md:hidden h-full flex flex-col">
          <div className="flex-1 overflow-hidden">
            {mobilePanel === 'tags' && (
              enhancedTemplate ? (
                <TagsPanel
                  template={enhancedTemplate}
                  sectionOrder={sectionOrder}
                  onSectionReorder={handleSectionReorder}
                  onTagClick={handleTagClick}
                  selectedTag={selectedTag}
                  selectedTagType={selectedTagType}
                  tagMappings={tagMappings}
                  snippets={snippets}
                  fieldValues={fieldValues}
                  onMappingRemove={handleMappingRemove}
                  onCustomContentSet={handleCustomContentSet}
                  onFieldValueEdit={handleFieldValueEdit}
                  onSectionHeaderSet={handleSectionHeaderSet}
                  onAddCustomField={handleAddCustomField}
                />
              ) : (
                <div className="h-full flex items-center justify-center p-6">
                  <div className="text-center max-w-xs">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium mb-2">No Template Loaded</h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Load a template to see its tags.
                    </p>
                  </div>
                </div>
              )
            )}
            {mobilePanel === 'content' && (
              <ContentLibrary
                snippets={snippets}
                categories={categories}
                fieldValues={fieldValues}
                onSnippetSelect={handleSnippetSelect}
                onFieldValueSelect={handleFieldValueSelect}
                selectedTag={selectedTag}
                selectedTagType={selectedTagType}
              />
            )}
            {!mobilePanel && (
              <div className="h-full flex items-center justify-center p-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-4" data-testid="text-mobile-hint">
                    Use the buttons below to view template tags or your content library
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => setMobilePanel('tags')} data-testid="button-mobile-tags">
                      View Tags
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setMobilePanel('content')} data-testid="button-mobile-content">
                      View Content
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mobile bottom bar */}
          <div className="border-t p-3 flex items-center justify-between gap-2 flex-shrink-0 bg-card">
            <div className="flex items-center gap-2">
              <Button
                variant={mobilePanel === 'tags' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMobilePanel(mobilePanel === 'tags' ? null : 'tags')}
                data-testid="button-toggle-tags"
              >
                Tags
              </Button>
              <Button
                variant={mobilePanel === 'content' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMobilePanel(mobilePanel === 'content' ? null : 'content')}
                data-testid="button-toggle-content"
              >
                Content
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowTemplateSelector(true)} data-testid="button-load-template-mobile">
                <FileText className="w-4 h-4" />
              </Button>
              <Button variant="default" size="sm" onClick={handleGenerate} disabled={!canGenerate} data-testid="button-generate-mobile">
                <Sparkles className="w-4 h-4" />
                Generate
              </Button>
            </div>
          </div>
        </div>
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
          returnContext={returnContext}
        />
      )}

      <FieldValueDialog
        open={!!fieldValueToEdit}
        onOpenChange={(open) => !open && setFieldValueToEdit(null)}
        fieldValue={fieldValueToEdit}
      />
    </div>
  );
}
