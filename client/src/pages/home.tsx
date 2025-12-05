import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Sparkles, LogOut, Menu, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { TemplateSelector } from "@/components/template-selector";
import { TagsPanel } from "@/components/tags-panel";
import { ContentLibrary } from "@/components/content-library";
import { GenerateDocumentDialog } from "@/components/generate-document-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ParsedTemplate, ContentSnippet, Category, TagMapping, User as UserType, Profile, ProfileFieldKey, TagType } from "@shared/schema";
import { SiGoogle } from "react-icons/si";

export default function Home() {
  const [selectedTemplate, setSelectedTemplate] = useState<ParsedTemplate | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedTagType, setSelectedTagType] = useState<TagType | null>(null);
  const [tagMappings, setTagMappings] = useState<Map<string, TagMapping>>(new Map());
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'tags' | 'content' | null>(null);

  const { data: user, isLoading: isLoadingUser } = useQuery<UserType | null>({
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

  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ['/api/profiles'],
    enabled: !!user,
  });

  const handleTemplateSelect = (template: ParsedTemplate) => {
    setSelectedTemplate(template);
    setShowTemplateSelector(false);
    setSectionOrder(template.sections.map(s => s.id));
    setTagMappings(new Map());
    setSelectedTag(null);
  };

  const handleSectionReorder = (newOrder: string[]) => {
    setSectionOrder(newOrder);
  };

  const handleTagClick = (tagName: string) => {
    setSelectedTag(tagName);
    // Find the tag type from the template
    const tag = selectedTemplate?.allTags.find(t => t.name === tagName);
    setSelectedTagType(tag?.tagType || null);
  };

  const handleSnippetSelect = (snippet: ContentSnippet) => {
    if (!selectedTag || !selectedTagType) return;
    
    const newMappings = new Map(tagMappings);
    newMappings.set(selectedTag, {
      tagName: selectedTag,
      tagType: selectedTagType,
      snippetId: snippet.id,
      customContent: null,
      profileId: null,
      profileField: null,
    });
    setTagMappings(newMappings);
    setSelectedTag(null);
    setSelectedTagType(null);
  };

  const handleProfileFieldSelect = (profileId: string, fieldKey: ProfileFieldKey) => {
    if (!selectedTag || !selectedTagType) return;
    
    const newMappings = new Map(tagMappings);
    newMappings.set(selectedTag, {
      tagName: selectedTag,
      tagType: selectedTagType,
      snippetId: null,
      customContent: null,
      profileId,
      profileField: fieldKey,
    });
    setTagMappings(newMappings);
    setSelectedTag(null);
    setSelectedTagType(null);
  };

  const handleCustomContentSet = (tagName: string, content: string) => {
    // Look up the tag type from the template
    const tag = selectedTemplate?.allTags.find(t => t.name === tagName);
    const tagType = tag?.tagType || 'content';
    
    const newMappings = new Map(tagMappings);
    newMappings.set(tagName, {
      tagName,
      tagType,
      snippetId: null,
      customContent: content,
      profileId: null,
      profileField: null,
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

  const handleLogin = () => {
    window.location.href = '/auth/google';
  };

  const handleLogout = () => {
    window.location.href = '/auth/logout';
  };

  const mappedCount = selectedTemplate ? selectedTemplate.allTags.filter(t => tagMappings.has(t.name)).length : 0;
  const canGenerate = selectedTemplate && mappedCount > 0;

  if (isLoadingUser) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground animate-pulse" data-testid="icon-loading" />
          <p className="text-sm text-muted-foreground" data-testid="text-loading">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <header className="h-14 border-b flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary" data-testid="icon-app-logo" />
            <h1 className="text-lg font-semibold" data-testid="text-app-title">DocBuilder</h1>
          </div>
          <ThemeToggle />
        </header>
        
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md px-6">
            <FileText className="w-16 h-16 mx-auto mb-6 text-primary" data-testid="icon-login-logo" />
            <h2 className="text-2xl font-semibold mb-3" data-testid="text-login-title">Welcome to DocBuilder</h2>
            <p className="text-sm text-muted-foreground mb-8" data-testid="text-login-description">
              Build Google Documents from customizable templates with ease. Sign in with your Google account 
              to access your Drive files and start creating.
            </p>
            <Button
              variant="default"
              size="default"
              onClick={handleLogin}
              className="gap-2"
              data-testid="button-google-login"
            >
              <SiGoogle className="w-4 h-4" />
              Sign in with Google
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="h-14 border-b flex items-center justify-between px-4 sm:px-6 flex-shrink-0 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="w-5 h-5 text-primary flex-shrink-0" data-testid="icon-app-logo" />
          <h1 className="text-lg font-semibold hidden sm:block" data-testid="text-app-title">DocBuilder</h1>
          {selectedTemplate && (
            <>
              <span className="text-muted-foreground hidden sm:block">/</span>
              <span className="text-sm text-muted-foreground truncate max-w-[150px] sm:max-w-[250px]" data-testid="text-template-name">
                {selectedTemplate.documentName}
              </span>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTemplateSelector(true)}
            className="hidden sm:flex"
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
            className="hidden sm:flex"
            data-testid="button-generate-document"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden md:inline">Generate</span>
          </Button>
          
          <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted">
            <Avatar className="h-6 w-6" data-testid="avatar-user">
              <AvatarImage src={user.picture || undefined} alt={user.name || 'User'} />
              <AvatarFallback>
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm hidden lg:inline" data-testid="text-user-name">
              {user.name || user.email}
            </span>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="Sign out"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
          
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
          <>
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
                      <TagsPanel
                        template={selectedTemplate}
                        sectionOrder={sectionOrder}
                        onSectionReorder={handleSectionReorder}
                        onTagClick={handleTagClick}
                        selectedTag={selectedTag}
                        tagMappings={tagMappings}
                        snippets={snippets}
                        profiles={profiles}
                        onMappingRemove={handleMappingRemove}
                        onCustomContentSet={handleCustomContentSet}
                      />
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
                        profiles={profiles}
                        onSnippetSelect={handleSnippetSelect}
                        onProfileFieldSelect={handleProfileFieldSelect}
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
                  <TagsPanel
                    template={selectedTemplate}
                    sectionOrder={sectionOrder}
                    onSectionReorder={handleSectionReorder}
                    onTagClick={handleTagClick}
                    selectedTag={selectedTag}
                    tagMappings={tagMappings}
                    snippets={snippets}
                    profiles={profiles}
                    onMappingRemove={handleMappingRemove}
                    onCustomContentSet={handleCustomContentSet}
                  />
                )}
                {mobilePanel === 'content' && (
                  <ContentLibrary
                    snippets={snippets}
                    categories={categories}
                    profiles={profiles}
                    onSnippetSelect={handleSnippetSelect}
                    onProfileFieldSelect={handleProfileFieldSelect}
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMobilePanel('tags')}
                          data-testid="button-mobile-tags"
                        >
                          View Tags
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMobilePanel('content')}
                          data-testid="button-mobile-content"
                        >
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTemplateSelector(true)}
                    data-testid="button-load-template-mobile"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleGenerate}
                    disabled={!canGenerate}
                    data-testid="button-generate-mobile"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate
                  </Button>
                </div>
              </div>
            </div>
          </>
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
