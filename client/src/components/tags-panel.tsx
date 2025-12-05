import { useState } from "react";
import { ChevronRight, ChevronDown, Hash, Check, Circle, Edit2, X, GripVertical, Variable } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichTextEditor, RichTextDisplay } from "@/components/ui/rich-text-editor";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ParsedTemplate, TemplateSection, TagMapping, ContentSnippet, FieldValue, TagType } from "@shared/schema";
import { FileText } from "lucide-react";

interface TagsPanelProps {
  template: ParsedTemplate;
  sectionOrder: string[];
  onSectionReorder: (newOrder: string[]) => void;
  onTagClick: (tagName: string, tagType: TagType) => void;
  selectedTag: string | null;
  selectedTagType: TagType | null;
  tagMappings: Map<string, TagMapping>;
  snippets: ContentSnippet[];
  fieldValues: FieldValue[];
  onMappingRemove: (tagName: string, tagType: TagType) => void;
  onCustomContentSet: (tagName: string, tagType: TagType, content: string) => void;
  onFieldValueEdit?: (fieldValueId: string) => void;
}

interface TagItemProps {
  tagName: string;
  tagType: TagType;
  isSelected: boolean;
  isMapped: boolean;
  mappedContent: string | null;
  snippetTitle: string | null;
  fieldValueInfo: { fieldName: string; fieldValueId: string } | null;
  occurrenceCount?: number;
  onTagClick: (tagName: string, tagType: TagType) => void;
  onRemove: (tagName: string, tagType: TagType) => void;
  onCustomContentSet: (tagName: string, tagType: TagType, content: string) => void;
  onFieldValueEdit?: (fieldValueId: string) => void;
}

function TagItem({
  tagName,
  tagType,
  isSelected,
  isMapped,
  mappedContent,
  snippetTitle,
  fieldValueInfo,
  occurrenceCount,
  onTagClick,
  onRemove,
  onCustomContentSet,
  onFieldValueEdit,
}: TagItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(mappedContent || "");

  const handleSave = () => {
    onCustomContentSet(tagName, tagType, editContent);
    setIsEditing(false);
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditContent(mappedContent || "");
    setIsEditing(true);
  };

  const tagSyntax = tagType === 'field' ? `{{${tagName}}}` : `<<${tagName}>>`;
  const TagIcon = tagType === 'field' ? Variable : FileText;

  // Create unique testid suffix including tagType to prevent duplicates for same-named field/content tags
  const testIdSuffix = `${tagType}-${tagName}`;

  if (isEditing) {
    return (
      <div className="p-3 rounded-lg border bg-card space-y-2" data-testid={`tag-edit-${testIdSuffix}`}>
        <div className="flex items-center gap-2">
          <TagIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <code className="text-xs font-mono text-muted-foreground">
            {tagSyntax}
          </code>
        </div>
        <RichTextEditor
          content={editContent}
          onChange={setEditContent}
          placeholder="Enter custom content..."
          data-testid={`editor-custom-content-${testIdSuffix}`}
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} data-testid={`button-save-${testIdSuffix}`}>
            <Check className="w-3 h-3" />
            Save
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsEditing(false)}
            data-testid={`button-cancel-${testIdSuffix}`}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => onTagClick(tagName, tagType)}
      className={`w-full p-3 rounded-lg border text-left transition-all hover-elevate active-elevate-2 cursor-pointer ${
        isSelected ? 'border-primary bg-accent/50' : ''
      }`}
      data-testid={`button-tag-${testIdSuffix}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {isMapped ? (
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center" data-testid={`icon-mapped-${testIdSuffix}`}>
              <Check className="w-3 h-3 text-primary-foreground" />
            </div>
          ) : (
            <TagIcon className="w-5 h-5 text-muted-foreground" data-testid={`icon-unmapped-${testIdSuffix}`} />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <code className="text-sm font-mono" data-testid={`text-tag-name-${testIdSuffix}`}>
              {tagSyntax}
            </code>
            {occurrenceCount && occurrenceCount > 1 && (
              <span className="text-xs text-muted-foreground" data-testid={`text-occurrence-${testIdSuffix}`}>
                ×{occurrenceCount}
              </span>
            )}
            <Badge variant="outline" className="text-xs">
              {tagType === 'field' ? 'Field' : 'Content'}
            </Badge>
          </div>
          
          {isMapped ? (
            <div className="space-y-1">
              {snippetTitle && (
                <Badge variant="secondary" className="text-xs" data-testid={`badge-snippet-${testIdSuffix}`}>
                  {snippetTitle}
                </Badge>
              )}
              {fieldValueInfo && (
                <Badge variant="outline" className="text-xs" data-testid={`badge-field-${testIdSuffix}`}>
                  <Variable className="w-2.5 h-2.5 mr-1" />
                  {`{{${fieldValueInfo.fieldName}}}`}
                </Badge>
              )}
              <div className="text-xs text-muted-foreground line-clamp-2" data-testid={`text-content-preview-${testIdSuffix}`}>
                {fieldValueInfo ? (
                  <span>{mappedContent}</span>
                ) : (
                  <RichTextDisplay content={mappedContent || ""} />
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground" data-testid={`text-empty-hint-${testIdSuffix}`}>
              Click to select content
            </p>
          )}
        </div>

        {isMapped && !fieldValueInfo && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleStartEdit}
              data-testid={`button-edit-${testIdSuffix}`}
            >
              <Edit2 className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(tagName, tagType);
              }}
              data-testid={`button-remove-${testIdSuffix}`}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        {isMapped && fieldValueInfo && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {onFieldValueEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onFieldValueEdit(fieldValueInfo.fieldValueId);
                }}
                data-testid={`button-edit-field-${testIdSuffix}`}
              >
                <Edit2 className="w-3 h-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(tagName, tagType);
              }}
              data-testid={`button-remove-${testIdSuffix}`}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface SectionGroupProps {
  section: TemplateSection;
  sectionOrder: string[];
  allSections: TemplateSection[];
  expandedSections: Set<string>;
  selectedTag: string | null;
  selectedTagType: TagType | null;
  tagMappings: Map<string, TagMapping>;
  snippets: ContentSnippet[];
  fieldValues: FieldValue[];
  globalTagCounts: Map<string, number>;
  renderedTags: Set<string>;
  onToggle: (id: string) => void;
  onTagClick: (tagName: string, tagType: TagType) => void;
  onMappingRemove: (tagName: string, tagType: TagType) => void;
  onCustomContentSet: (tagName: string, tagType: TagType, content: string) => void;
  onFieldValueEdit?: (fieldValueId: string) => void;
  level?: number;
  isDraggable?: boolean;
}

function SectionGroup({
  section,
  expandedSections,
  selectedTag,
  selectedTagType,
  tagMappings,
  snippets,
  fieldValues,
  globalTagCounts,
  renderedTags,
  onToggle,
  onTagClick,
  onMappingRemove,
  onCustomContentSet,
  onFieldValueEdit,
  level = 0,
  isDraggable = false,
}: SectionGroupProps) {
  const hasChildren = section.children && section.children.length > 0;
  
  // Filter tags to only show those not yet rendered globally (keyed by name:type)
  const tagsToRender = section.tags.filter(tag => {
    const key = `${tag.name}:${tag.tagType}`;
    return !renderedTags.has(key);
  });
  // Mark these tags as rendered (mutating the set for cross-section dedup)
  tagsToRender.forEach(tag => {
    const key = `${tag.name}:${tag.tagType}`;
    renderedTags.add(key);
  });
  
  // Deduplicate within this section (for the same tag appearing multiple times in one section)
  const uniqueTagKeys = new Set(tagsToRender.map(t => `${t.name}:${t.tagType}`));
  const uniqueTagsInSection = Array.from(uniqueTagKeys).map(key => {
    const [name, tagType] = key.split(':');
    return tagsToRender.find(t => t.name === name && t.tagType === tagType)!;
  });
  
  const hasTags = uniqueTagsInSection.length > 0;
  const hasContent = hasTags || hasChildren;
  const isExpanded = expandedSections.has(section.id);
  
  const mappedCount = uniqueTagsInSection.filter(t => {
    const key = `${t.name}:${t.tagType}`;
    return tagMappings.has(key);
  }).length;
  const totalTags = uniqueTagsInSection.length;

  const getSnippetById = (id: string) => snippets.find(s => s.id === id);
  const getFieldValueById = (id: string) => fieldValues.find(f => f.id === id);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: section.id, disabled: !isDraggable });

  const style = isDraggable ? {
    transform: CSS.Transform.toString(transform),
    transition,
  } : {};

  return (
    <div 
      ref={isDraggable ? setNodeRef : undefined} 
      style={style} 
      className="select-none"
      data-testid={`section-group-${section.id}`}
    >
      <button
        onClick={() => onToggle(section.id)}
        className="w-full flex items-center gap-2 py-2 px-3 rounded-md hover-elevate active-elevate-2 transition-colors"
        style={{ paddingLeft: `${level * 16 + 12}px` }}
        data-testid={`button-section-${section.id}`}
      >
        {isDraggable && (
          <div {...attributes} {...listeners} className="flex-shrink-0 cursor-grab active:cursor-grabbing">
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
        
        <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
          {hasContent && (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )
          )}
        </div>
        
        <span className="text-sm flex-1 min-w-0 truncate text-left font-medium" data-testid={`text-section-title-${section.id}`}>
          {section.title || 'Untitled Section'}
        </span>
        
        {hasTags && (
          <Badge 
            variant={mappedCount === totalTags ? "default" : "secondary"} 
            className="text-xs"
            data-testid={`badge-progress-${section.id}`}
          >
            {mappedCount}/{totalTags}
          </Badge>
        )}
      </button>

      {isExpanded && hasContent && (
        <div className="space-y-2 mt-2" style={{ paddingLeft: `${(level + 1) * 16 + 12}px` }}>
          {uniqueTagsInSection.map((tag) => {
            const tagKey = `${tag.name}:${tag.tagType}`;
            const globalCount = globalTagCounts.get(tagKey) || 1;
            const mapping = tagMappings.get(tagKey);
            const snippet = mapping?.snippetId ? getSnippetById(mapping.snippetId) : null;
            const fieldValue = mapping?.fieldValueId ? getFieldValueById(mapping.fieldValueId) : null;
            
            let mappedContent: string | null = null;
            let fieldValueInfo: { fieldName: string; fieldValueId: string } | null = null;
            
            if (fieldValue) {
              mappedContent = fieldValue.value;
              fieldValueInfo = { fieldName: fieldValue.name, fieldValueId: fieldValue.id };
            } else if (snippet) {
              mappedContent = snippet.content;
            } else if (mapping?.customContent) {
              mappedContent = mapping.customContent;
            }
            
            return (
              <TagItem
                key={tagKey}
                tagName={tag.name}
                tagType={tag.tagType}
                isSelected={selectedTag === tag.name && selectedTagType === tag.tagType}
                isMapped={!!mapping}
                mappedContent={mappedContent}
                snippetTitle={snippet?.title || null}
                fieldValueInfo={fieldValueInfo}
                occurrenceCount={globalCount}
                onTagClick={onTagClick}
                onRemove={onMappingRemove}
                onCustomContentSet={onCustomContentSet}
                onFieldValueEdit={onFieldValueEdit}
              />
            );
          })}

          {hasChildren && section.children.map(child => (
            <SectionGroup
              key={child.id}
              section={child}
              sectionOrder={[]}
              allSections={[]}
              expandedSections={expandedSections}
              selectedTag={selectedTag}
              selectedTagType={selectedTagType}
              tagMappings={tagMappings}
              snippets={snippets}
              fieldValues={fieldValues}
              globalTagCounts={globalTagCounts}
              renderedTags={renderedTags}
              onToggle={onToggle}
              onTagClick={onTagClick}
              onMappingRemove={onMappingRemove}
              onCustomContentSet={onCustomContentSet}
              onFieldValueEdit={onFieldValueEdit}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TagsPanel({
  template,
  sectionOrder,
  onSectionReorder,
  onTagClick,
  selectedTag,
  selectedTagType,
  tagMappings,
  snippets,
  fieldValues,
  onMappingRemove,
  onCustomContentSet,
  onFieldValueEdit,
}: TagsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"document" | "fields">("document");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(template.sections.map(s => s.id))
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const getOrderedSections = () => {
    return sectionOrder
      .map(id => template.sections.find(s => s.id === id))
      .filter(Boolean) as TemplateSection[];
  };

  // Filter sections to only include content tags (for Document tab)
  // Preserves full section hierarchy but removes field tags from display
  const filterToContentTags = (sections: TemplateSection[]): TemplateSection[] => {
    const filterRecursive = (secs: TemplateSection[]): TemplateSection[] => {
      return secs.map(section => ({
        ...section,
        tags: section.tags.filter(tag => tag.tagType === 'content'),
        children: section.children ? filterRecursive(section.children) : [],
      }));
    };
    return filterRecursive(sections);
  };

  const filterSections = (sections: TemplateSection[], query: string): TemplateSection[] => {
    if (!query.trim()) return sections;
    
    const lowerQuery = query.toLowerCase();
    
    const sectionMatches = (section: TemplateSection): boolean => {
      const titleMatches = section.title?.toLowerCase().includes(lowerQuery) || false;
      const tagsMatch = section.tags.some(tag => tag.name.toLowerCase().includes(lowerQuery));
      const childrenMatch = section.children?.some(child => sectionMatches(child)) || false;
      return titleMatches || tagsMatch || childrenMatch;
    };
    
    const filterRecursive = (secs: TemplateSection[]): TemplateSection[] => {
      return secs
        .filter(section => sectionMatches(section))
        .map(section => ({
          ...section,
          children: section.children ? filterRecursive(section.children) : [],
        }));
    };
    
    return filterRecursive(sections);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = sectionOrder.indexOf(active.id as string);
      const newIndex = sectionOrder.indexOf(over.id as string);
      
      const newOrder = arrayMove(sectionOrder, oldIndex, newIndex);
      onSectionReorder(newOrder);
    }
  };

  const getSnippetById = (id: string) => snippets.find(s => s.id === id);
  const getFieldValueById = (id: string) => fieldValues.find(f => f.id === id);

  // For Document tab: filter to content tags only, preserving full section structure
  const contentOnlySections = filterToContentTags(getOrderedSections());
  const orderedSections = filterSections(contentOnlySections, searchQuery);
  
  // Calculate global tag counts keyed by name+type (used for occurrence display)
  // Key format: "tagName:tagType" to distinguish field and content tags
  const globalTagCounts = new Map<string, number>();
  template.allTags.forEach(tag => {
    const key = `${tag.name}:${tag.tagType}`;
    globalTagCounts.set(key, (globalTagCounts.get(key) || 0) + 1);
  });
  
  // Track which tags have been rendered (reset each render cycle)
  // Key format: "tagName:tagType"
  const renderedTagsForDocTab = new Set<string>();
  
  // Calculate unique tag count for overall progress (keyed by name+type)
  const uniqueTagKeys = new Set(template.allTags.map(t => `${t.name}:${t.tagType}`));
  const uniqueTotalTags = uniqueTagKeys.size;
  const mappedCount = Array.from(uniqueTagKeys).filter(key => {
    // Now using composite key for tagMappings lookup
    return tagMappings.has(key);
  }).length;
  const progress = uniqueTotalTags > 0 ? Math.round((mappedCount / uniqueTotalTags) * 100) : 0;

  // Get only field tags for the Fields tab, deduplicated with occurrence counts
  const fieldTags = template.allTags.filter(t => t.tagType === 'field');
  const fieldTagCounts = new Map<string, { tag: typeof fieldTags[0]; count: number }>();
  fieldTags.forEach(tag => {
    const existing = fieldTagCounts.get(tag.name);
    if (existing) {
      existing.count++;
    } else {
      fieldTagCounts.set(tag.name, { tag, count: 1 });
    }
  });
  const uniqueFieldTags = Array.from(fieldTagCounts.values());
  const filteredFieldTags = searchQuery.trim() 
    ? uniqueFieldTags.filter(t => t.tag.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : uniqueFieldTags;
  // Use composite key for field tags (all field tags)
  const fieldMappedCount = uniqueFieldTags.filter(t => 
    tagMappings.has(`${t.tag.name}:field`)
  ).length;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 space-y-3 flex-shrink-0">
        <Input
          placeholder="Search tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9"
          data-testid="input-search-tags"
        />
        
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
              data-testid="progress-bar"
            />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap" data-testid="text-progress">
            {mappedCount}/{uniqueTotalTags} filled
          </span>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "document" | "fields")} className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="document" data-testid="tab-document">
              <FileText className="w-3 h-3" />
              Document
            </TabsTrigger>
            <TabsTrigger value="fields" data-testid="tab-fields">
              <Variable className="w-3 h-3" />
              Fields
              {uniqueFieldTags.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">
                  {fieldMappedCount}/{uniqueFieldTags.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === "document" ? (
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {orderedSections.length === 0 ? (
              <div className="text-center py-8 px-4">
                <p className="text-sm text-muted-foreground" data-testid="text-no-sections">
                  No sections found in template
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={orderedSections.map(s => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {orderedSections.map(section => (
                    <SectionGroup
                      key={section.id}
                      section={section}
                      sectionOrder={sectionOrder}
                      allSections={orderedSections}
                      expandedSections={expandedSections}
                      selectedTag={selectedTag}
                      selectedTagType={selectedTagType}
                      tagMappings={tagMappings}
                      snippets={snippets}
                      fieldValues={fieldValues}
                      globalTagCounts={globalTagCounts}
                      renderedTags={renderedTagsForDocTab}
                      onToggle={toggleSection}
                      onTagClick={onTagClick}
                      onMappingRemove={onMappingRemove}
                      onCustomContentSet={onCustomContentSet}
                      onFieldValueEdit={onFieldValueEdit}
                      level={0}
                      isDraggable={true}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </ScrollArea>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {filteredFieldTags.length === 0 ? (
              <div className="text-center py-8 px-4">
                <Variable className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground" data-testid="text-no-fields">
                  {searchQuery ? "No field tags match your search" : "No field tags in template"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Field tags use the {"{{field_name}}"} syntax
                </p>
              </div>
            ) : (
              filteredFieldTags.map(({ tag, count }) => {
                const tagKey = `${tag.name}:${tag.tagType}`;
                const mapping = tagMappings.get(tagKey);
                const snippet = mapping?.snippetId ? getSnippetById(mapping.snippetId) : null;
                const fieldValue = mapping?.fieldValueId ? getFieldValueById(mapping.fieldValueId) : null;
                
                let mappedContent: string | null = null;
                let fieldValueInfo: { fieldName: string; fieldValueId: string } | null = null;
                
                if (fieldValue) {
                  mappedContent = fieldValue.value;
                  fieldValueInfo = { fieldName: fieldValue.name, fieldValueId: fieldValue.id };
                } else if (snippet) {
                  mappedContent = snippet.content;
                } else if (mapping?.customContent) {
                  mappedContent = mapping.customContent;
                }
                
                return (
                  <TagItem
                    key={tagKey}
                    tagName={tag.name}
                    tagType={tag.tagType}
                    isSelected={selectedTag === tag.name && selectedTagType === tag.tagType}
                    isMapped={!!mapping}
                    mappedContent={mappedContent}
                    snippetTitle={snippet?.title || null}
                    fieldValueInfo={fieldValueInfo}
                    occurrenceCount={count}
                    onTagClick={onTagClick}
                    onRemove={onMappingRemove}
                    onCustomContentSet={onCustomContentSet}
                    onFieldValueEdit={onFieldValueEdit}
                  />
                );
              })
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
