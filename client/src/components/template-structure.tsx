import { useState } from "react";
import { ChevronRight, ChevronDown, GripVertical, Hash } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import type { ParsedTemplate, TemplateSection, TagMapping } from "@shared/schema";

interface TemplateStructureProps {
  template: ParsedTemplate;
  sectionOrder: string[];
  onSectionReorder: (newOrder: string[]) => void;
  onTagClick: (tagName: string) => void;
  selectedTag: string | null;
  tagMappings: Map<string, TagMapping>;
}

// Non-sortable section component (used for child sections)
interface SectionNodeProps {
  section: TemplateSection;
  level: number;
  isExpanded: boolean;
  expandedSections: Set<string>;
  hasTags: boolean;
  selectedTag: string | null;
  tagMappings: Map<string, TagMapping>;
  onToggle: (id: string) => void;
  onTagClick: (tagName: string) => void;
}

function SectionNode({
  section,
  level,
  isExpanded,
  expandedSections,
  hasTags,
  selectedTag,
  tagMappings,
  onToggle,
  onTagClick,
}: SectionNodeProps) {
  const hasChildren = section.children && section.children.length > 0;
  const hasContent = hasTags || hasChildren;

  return (
    <div className="select-none" data-testid={`section-${section.id}`}>
      <div
        className={`flex items-center gap-2 py-2 px-3 rounded-md hover-elevate active-elevate-2 cursor-pointer transition-colors ${
          level > 0 ? 'ml-4' : ''
        }`}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
      >
        <button
          onClick={() => onToggle(section.id)}
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center"
          data-testid={`button-toggle-section-${section.id}`}
        >
          {hasContent && (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )
          )}
        </button>
        
        <span className="text-sm flex-1 min-w-0 truncate" data-testid={`text-section-title-${section.id}`}>
          {section.title || 'Untitled Section'}
        </span>
        
        {hasTags && (
          <Badge variant="secondary" className="text-xs" data-testid={`badge-tag-count-${section.id}`}>
            {section.tags.length}
          </Badge>
        )}
      </div>
      
      {isExpanded && (
        <div className="space-y-1 mt-1">
          {/* Render tags */}
          {hasTags && (
            <div className="space-y-1" style={{ paddingLeft: `${(level + 1) * 16 + 12}px` }}>
              {section.tags.map((tag, idx) => {
                const isMapped = tagMappings.has(tag.name);
                const isSelected = selectedTag === tag.name;
                
                return (
                  <button
                    key={`${tag.name}-${idx}`}
                    onClick={() => onTagClick(tag.name)}
                    className={`w-full flex items-center gap-2 py-1.5 px-3 rounded-md text-left transition-colors hover-elevate active-elevate-2 ${
                      isSelected ? 'bg-accent' : ''
                    }`}
                    data-testid={`button-tag-${tag.name}`}
                  >
                    <Hash className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <code className="text-xs font-mono flex-1 min-w-0 truncate" data-testid={`text-tag-name-${tag.name}`}>
                      &lt;&lt;{tag.name}&gt;&gt;
                    </code>
                    {isMapped && (
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" data-testid={`indicator-mapped-${tag.name}`} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
          
          {/* Render child sections recursively */}
          {hasChildren && (
            <div className="space-y-1">
              {section.children.map(childSection => (
                <SectionNode
                  key={childSection.id}
                  section={childSection}
                  level={level + 1}
                  isExpanded={expandedSections.has(childSection.id)}
                  expandedSections={expandedSections}
                  hasTags={childSection.tags.length > 0}
                  selectedTag={selectedTag}
                  tagMappings={tagMappings}
                  onToggle={onToggle}
                  onTagClick={onTagClick}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Sortable wrapper for top-level sections
interface SortableSectionProps {
  section: TemplateSection;
  level: number;
  isExpanded: boolean;
  expandedSections: Set<string>;
  hasTags: boolean;
  selectedTag: string | null;
  tagMappings: Map<string, TagMapping>;
  onToggle: (id: string) => void;
  onTagClick: (tagName: string) => void;
}

function SortableSection({
  section,
  level,
  isExpanded,
  expandedSections,
  hasTags,
  selectedTag,
  tagMappings,
  onToggle,
  onTagClick,
}: SortableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasChildren = section.children && section.children.length > 0;
  const hasContent = hasTags || hasChildren;

  return (
    <div ref={setNodeRef} style={style} className="select-none" data-testid={`section-${section.id}`}>
      <div
        className={`flex items-center gap-2 py-2 px-3 rounded-md hover-elevate active-elevate-2 cursor-pointer transition-colors ${
          level > 0 ? 'ml-4' : ''
        }`}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
      >
        <button
          onClick={() => onToggle(section.id)}
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center"
          data-testid={`button-toggle-section-${section.id}`}
        >
          {hasContent && (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )
          )}
        </button>
        
        <div {...attributes} {...listeners} className="flex-shrink-0 cursor-grab active:cursor-grabbing">
          <GripVertical className="w-4 h-4 text-muted-foreground" data-testid={`icon-drag-${section.id}`} />
        </div>
        
        <span className="text-sm flex-1 min-w-0 truncate" data-testid={`text-section-title-${section.id}`}>
          {section.title || 'Untitled Section'}
        </span>
        
        {hasTags && (
          <Badge variant="secondary" className="text-xs" data-testid={`badge-tag-count-${section.id}`}>
            {section.tags.length}
          </Badge>
        )}
      </div>
      
      {isExpanded && (
        <div className="space-y-1 mt-1">
          {/* Render tags */}
          {hasTags && (
            <div className="space-y-1" style={{ paddingLeft: `${(level + 1) * 16 + 12}px` }}>
              {section.tags.map((tag, idx) => {
                const isMapped = tagMappings.has(tag.name);
                const isSelected = selectedTag === tag.name;
                
                return (
                  <button
                    key={`${tag.name}-${idx}`}
                    onClick={() => onTagClick(tag.name)}
                    className={`w-full flex items-center gap-2 py-1.5 px-3 rounded-md text-left transition-colors hover-elevate active-elevate-2 ${
                      isSelected ? 'bg-accent' : ''
                    }`}
                    data-testid={`button-tag-${tag.name}`}
                  >
                    <Hash className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <code className="text-xs font-mono flex-1 min-w-0 truncate" data-testid={`text-tag-name-${tag.name}`}>
                      &lt;&lt;{tag.name}&gt;&gt;
                    </code>
                    {isMapped && (
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" data-testid={`indicator-mapped-${tag.name}`} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
          
          {/* Render child sections using non-sortable SectionNode */}
          {hasChildren && (
            <div className="space-y-1">
              {section.children.map(childSection => (
                <SectionNode
                  key={childSection.id}
                  section={childSection}
                  level={level + 1}
                  isExpanded={expandedSections.has(childSection.id)}
                  expandedSections={expandedSections}
                  hasTags={childSection.tags.length > 0}
                  selectedTag={selectedTag}
                  tagMappings={tagMappings}
                  onToggle={onToggle}
                  onTagClick={onTagClick}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TemplateStructure({
  template,
  sectionOrder,
  onSectionReorder,
  onTagClick,
  selectedTag,
  tagMappings,
}: TemplateStructureProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(template.sections.map(s => s.id)));

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = sectionOrder.indexOf(active.id as string);
      const newIndex = sectionOrder.indexOf(over.id as string);
      
      const newOrder = arrayMove(sectionOrder, oldIndex, newIndex);
      onSectionReorder(newOrder);
    }
  };

  const orderedSections = getOrderedSections();

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex-shrink-0">
        <h2 className="text-sm font-semibold mb-3 uppercase tracking-wide text-muted-foreground" data-testid="text-structure-title">
          Template Structure
        </h2>
        <Input
          placeholder="Search sections..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9"
          data-testid="input-search-sections"
        />
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
                  <SortableSection
                    key={section.id}
                    section={section}
                    level={0}
                    isExpanded={expandedSections.has(section.id)}
                    expandedSections={expandedSections}
                    hasTags={section.tags.length > 0}
                    selectedTag={selectedTag}
                    tagMappings={tagMappings}
                    onToggle={toggleSection}
                    onTagClick={onTagClick}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </ScrollArea>
      
      <div className="p-3 border-t flex-shrink-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span data-testid="text-total-sections">{orderedSections.length} sections</span>
          <span data-testid="text-total-tags">{template.allTags.length} tags</span>
        </div>
      </div>
    </div>
  );
}
