import { useState } from "react";
import { ChevronRight, ChevronDown, Hash, Check, Circle, Edit2, X, GripVertical, Building2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import type { ParsedTemplate, TemplateSection, TagMapping, ContentSnippet, Profile, TagType } from "@shared/schema";
import { PROFILE_FIELDS } from "@shared/schema";
import { FileText } from "lucide-react";

interface TagsPanelProps {
  template: ParsedTemplate;
  sectionOrder: string[];
  onSectionReorder: (newOrder: string[]) => void;
  onTagClick: (tagName: string) => void;
  selectedTag: string | null;
  tagMappings: Map<string, TagMapping>;
  snippets: ContentSnippet[];
  profiles: Profile[];
  onMappingRemove: (tagName: string) => void;
  onCustomContentSet: (tagName: string, content: string) => void;
}

interface TagItemProps {
  tagName: string;
  tagType: TagType;
  isSelected: boolean;
  isMapped: boolean;
  mappedContent: string | null;
  snippetTitle: string | null;
  profileInfo: { profileName: string; fieldLabel: string } | null;
  onTagClick: (tagName: string) => void;
  onRemove: (tagName: string) => void;
  onCustomContentSet: (tagName: string, content: string) => void;
}

function TagItem({
  tagName,
  tagType,
  isSelected,
  isMapped,
  mappedContent,
  snippetTitle,
  profileInfo,
  onTagClick,
  onRemove,
  onCustomContentSet,
}: TagItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(mappedContent || "");

  const handleSave = () => {
    onCustomContentSet(tagName, editContent);
    setIsEditing(false);
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditContent(mappedContent || "");
    setIsEditing(true);
  };

  const tagSyntax = tagType === 'field' ? `{{${tagName}}}` : `<<${tagName}>>`;
  const TagIcon = tagType === 'field' ? Building2 : FileText;

  if (isEditing) {
    return (
      <div className="p-3 rounded-lg border bg-card space-y-2" data-testid={`tag-edit-${tagName}`}>
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
          data-testid={`editor-custom-content-${tagName}`}
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} data-testid={`button-save-${tagName}`}>
            <Check className="w-3 h-3" />
            Save
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsEditing(false)}
            data-testid={`button-cancel-${tagName}`}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => onTagClick(tagName)}
      className={`w-full p-3 rounded-lg border text-left transition-all hover-elevate active-elevate-2 ${
        isSelected ? 'border-primary bg-accent/50' : ''
      }`}
      data-testid={`button-tag-${tagName}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {isMapped ? (
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center" data-testid={`icon-mapped-${tagName}`}>
              <Check className="w-3 h-3 text-primary-foreground" />
            </div>
          ) : (
            <TagIcon className="w-5 h-5 text-muted-foreground" data-testid={`icon-unmapped-${tagName}`} />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <code className="text-sm font-mono" data-testid={`text-tag-name-${tagName}`}>
              {tagSyntax}
            </code>
            <Badge variant="outline" className="text-xs">
              {tagType === 'field' ? 'Field' : 'Content'}
            </Badge>
          </div>
          
          {isMapped ? (
            <div className="space-y-1">
              {snippetTitle && (
                <Badge variant="secondary" className="text-xs" data-testid={`badge-snippet-${tagName}`}>
                  {snippetTitle}
                </Badge>
              )}
              {profileInfo && (
                <Badge variant="outline" className="text-xs" data-testid={`badge-profile-${tagName}`}>
                  <Building2 className="w-2.5 h-2.5 mr-1" />
                  {profileInfo.profileName}: {profileInfo.fieldLabel}
                </Badge>
              )}
              <div className="text-xs text-muted-foreground line-clamp-2" data-testid={`text-content-preview-${tagName}`}>
                {profileInfo ? (
                  <span>{mappedContent}</span>
                ) : (
                  <RichTextDisplay content={mappedContent || ""} />
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground" data-testid={`text-empty-hint-${tagName}`}>
              Click to select content
            </p>
          )}
        </div>

        {isMapped && !profileInfo && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleStartEdit}
              data-testid={`button-edit-${tagName}`}
            >
              <Edit2 className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(tagName);
              }}
              data-testid={`button-remove-${tagName}`}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        {isMapped && profileInfo && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(tagName);
              }}
              data-testid={`button-remove-${tagName}`}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>
    </button>
  );
}

interface SectionGroupProps {
  section: TemplateSection;
  sectionOrder: string[];
  allSections: TemplateSection[];
  expandedSections: Set<string>;
  selectedTag: string | null;
  tagMappings: Map<string, TagMapping>;
  snippets: ContentSnippet[];
  profiles: Profile[];
  onToggle: (id: string) => void;
  onTagClick: (tagName: string) => void;
  onMappingRemove: (tagName: string) => void;
  onCustomContentSet: (tagName: string, content: string) => void;
  level?: number;
  isDraggable?: boolean;
}

function SectionGroup({
  section,
  expandedSections,
  selectedTag,
  tagMappings,
  snippets,
  profiles,
  onToggle,
  onTagClick,
  onMappingRemove,
  onCustomContentSet,
  level = 0,
  isDraggable = false,
}: SectionGroupProps) {
  const hasTags = section.tags.length > 0;
  const hasChildren = section.children && section.children.length > 0;
  const hasContent = hasTags || hasChildren;
  const isExpanded = expandedSections.has(section.id);

  const mappedCount = section.tags.filter(t => tagMappings.has(t.name)).length;
  const totalTags = section.tags.length;

  const getSnippetById = (id: string) => snippets.find(s => s.id === id);
  const getProfileById = (id: string) => profiles.find(p => p.id === id);

  const getProfileFieldValue = (profile: Profile, fieldKey: string): string | null => {
    switch (fieldKey) {
      case 'name': return profile.name;
      case 'contactName': return profile.contactName;
      case 'contactTitle': return profile.contactTitle;
      case 'addressLine1': return profile.addressLine1;
      case 'addressLine2': return profile.addressLine2;
      case 'city': return profile.city;
      case 'state': return profile.state;
      case 'zip': return profile.zip;
      case 'phone': return profile.phone;
      case 'email': return profile.email;
      case 'fullAddress': {
        const parts = [];
        if (profile.addressLine1) parts.push(profile.addressLine1);
        if (profile.addressLine2) parts.push(profile.addressLine2);
        const cityStateZip = [profile.city, profile.state, profile.zip].filter(Boolean).join(', ');
        if (cityStateZip) parts.push(cityStateZip);
        return parts.join(', ') || null;
      }
      case 'cityStateZip': {
        const parts = [profile.city, profile.state, profile.zip].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : null;
      }
      default: return null;
    }
  };

  const getProfileFieldLabel = (fieldKey: string): string => {
    const field = PROFILE_FIELDS.find(f => f.key === fieldKey);
    return field?.label || fieldKey;
  };

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
          {section.tags.map((tag, idx) => {
            const mapping = tagMappings.get(tag.name);
            const snippet = mapping?.snippetId ? getSnippetById(mapping.snippetId) : null;
            const profile = mapping?.profileId ? getProfileById(mapping.profileId) : null;
            
            let mappedContent: string | null = null;
            let profileInfo: { profileName: string; fieldLabel: string } | null = null;
            
            if (profile && mapping?.profileField) {
              mappedContent = getProfileFieldValue(profile, mapping.profileField);
              profileInfo = {
                profileName: profile.name,
                fieldLabel: getProfileFieldLabel(mapping.profileField),
              };
            } else if (snippet) {
              mappedContent = snippet.content;
            } else if (mapping?.customContent) {
              mappedContent = mapping.customContent;
            }
            
            return (
              <TagItem
                key={`${tag.name}-${idx}`}
                tagName={tag.name}
                tagType={tag.tagType}
                isSelected={selectedTag === tag.name}
                isMapped={!!mapping}
                mappedContent={mappedContent}
                snippetTitle={snippet?.title || null}
                profileInfo={profileInfo}
                onTagClick={onTagClick}
                onRemove={onMappingRemove}
                onCustomContentSet={onCustomContentSet}
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
              tagMappings={tagMappings}
              snippets={snippets}
              profiles={profiles}
              onToggle={onToggle}
              onTagClick={onTagClick}
              onMappingRemove={onMappingRemove}
              onCustomContentSet={onCustomContentSet}
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
  tagMappings,
  snippets,
  profiles,
  onMappingRemove,
  onCustomContentSet,
}: TagsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
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

  const orderedSections = filterSections(getOrderedSections(), searchQuery);
  const mappedCount = template.allTags.filter(t => tagMappings.has(t.name)).length;
  const totalTags = template.allTags.length;
  const progress = totalTags > 0 ? Math.round((mappedCount / totalTags) * 100) : 0;

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
            {mappedCount}/{totalTags} filled
          </span>
        </div>
      </div>

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
                    tagMappings={tagMappings}
                    snippets={snippets}
                    profiles={profiles}
                    onToggle={toggleSection}
                    onTagClick={onTagClick}
                    onMappingRemove={onMappingRemove}
                    onCustomContentSet={onCustomContentSet}
                    level={0}
                    isDraggable={true}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
