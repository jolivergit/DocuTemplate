import { useState } from "react";
import { Hash, X, Edit2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RichTextEditor, RichTextDisplay, stripHtmlToPlainText } from "@/components/ui/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import type { ParsedTemplate, TagMapping, ContentSnippet } from "@shared/schema";

interface TagMappingPanelProps {
  template: ParsedTemplate;
  tagMappings: Map<string, TagMapping>;
  snippets: ContentSnippet[];
  onTagClick: (tagName: string) => void;
  onMappingRemove: (tagName: string) => void;
  onCustomContentSet: (tagName: string, content: string) => void;
  selectedTag: string | null;
}

export function TagMappingPanel({
  template,
  tagMappings,
  snippets,
  onTagClick,
  onMappingRemove,
  onCustomContentSet,
  selectedTag,
}: TagMappingPanelProps) {
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const getSnippetById = (id: string) => {
    return snippets.find(s => s.id === id);
  };

  const handleEditStart = (tagName: string) => {
    const mapping = tagMappings.get(tagName);
    if (mapping) {
      const snippet = mapping.snippetId ? getSnippetById(mapping.snippetId) : null;
      setEditContent(mapping.customContent || snippet?.content || "");
      setEditingTag(tagName);
    }
  };

  const handleEditSave = () => {
    if (editingTag) {
      onCustomContentSet(editingTag, editContent);
      setEditingTag(null);
      setEditContent("");
    }
  };

  const handleEditCancel = () => {
    setEditingTag(null);
    setEditContent("");
  };

  const mappedTags = Array.from(tagMappings.values());
  const unmappedTags = template.allTags.filter(tag => !tagMappings.has(tag.name));

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex-shrink-0">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground" data-testid="text-mapping-title">
          Tag Mappings
        </h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {mappedTags.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3" data-testid="text-mapped-section">
                Mapped ({mappedTags.length})
              </h3>
              
              {mappedTags.map(mapping => {
                const snippet = mapping.snippetId ? getSnippetById(mapping.snippetId) : null;
                const isEditing = editingTag === mapping.tagName;
                const isSelected = selectedTag === mapping.tagName;
                
                return (
                  <div
                    key={mapping.tagName}
                    className={`p-3 rounded-lg border ${
                      isSelected ? 'border-primary' : ''
                    }`}
                    data-testid={`mapping-${mapping.tagName}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <button
                        onClick={() => onTagClick(mapping.tagName)}
                        className="flex items-center gap-1 flex-1 min-w-0"
                        data-testid={`button-mapped-tag-${mapping.tagName}`}
                      >
                        <Hash className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <code className="text-xs font-mono truncate" data-testid={`text-mapped-tag-name-${mapping.tagName}`}>
                          &lt;&lt;{mapping.tagName}&gt;&gt;
                        </code>
                      </button>
                      
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!isEditing && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleEditStart(mapping.tagName)}
                            data-testid={`button-edit-${mapping.tagName}`}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onMappingRemove(mapping.tagName)}
                          data-testid={`button-remove-${mapping.tagName}`}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-2">
                        <RichTextEditor
                          content={editContent}
                          onChange={setEditContent}
                          placeholder="Enter custom content..."
                          data-testid={`editor-edit-${mapping.tagName}`}
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={handleEditSave}
                            data-testid={`button-save-edit-${mapping.tagName}`}
                          >
                            <Check className="w-3 h-3" />
                            Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleEditCancel}
                            data-testid={`button-cancel-edit-${mapping.tagName}`}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {snippet && (
                          <Badge variant="secondary" className="text-xs mb-2" data-testid={`badge-snippet-title-${mapping.tagName}`}>
                            {snippet.title}
                          </Badge>
                        )}
                        <div className="text-sm text-muted-foreground line-clamp-3" data-testid={`text-mapping-content-${mapping.tagName}`}>
                          <RichTextDisplay content={mapping.customContent || snippet?.content || "No content"} />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {unmappedTags.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3" data-testid="text-unmapped-section">
                Unmapped ({unmappedTags.length})
              </h3>
              
              {unmappedTags.map((tag, idx) => {
                const isSelected = selectedTag === tag.name;
                
                return (
                  <button
                    key={`${tag.name}-${idx}`}
                    onClick={() => onTagClick(tag.name)}
                    className={`w-full p-3 rounded-lg border text-left hover-elevate active-elevate-2 transition-colors ${
                      isSelected ? 'border-primary' : ''
                    }`}
                    data-testid={`button-unmapped-tag-${tag.name}`}
                  >
                    <div className="flex items-center gap-1">
                      <Hash className="w-3 h-3 text-muted-foreground" />
                      <code className="text-xs font-mono" data-testid={`text-unmapped-tag-name-${tag.name}`}>
                        &lt;&lt;{tag.name}&gt;&gt;
                      </code>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {mappedTags.length === 0 && unmappedTags.length === 0 && (
            <div className="text-center py-8 px-4">
              <p className="text-sm text-muted-foreground" data-testid="text-no-tags">
                No tags found in template
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t flex-shrink-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span data-testid="text-mapped-count">{mappedTags.length} mapped</span>
          <span data-testid="text-unmapped-count">{unmappedTags.length} unmapped</span>
        </div>
      </div>
    </div>
  );
}
