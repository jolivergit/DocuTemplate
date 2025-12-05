import { useState, useEffect } from "react";
import { Plus, Search, Archive, Trash2, Settings, Variable, FileText, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichTextDisplay, stripHtmlToPlainText } from "@/components/ui/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AddContentDialog } from "@/components/add-content-dialog";
import { AddCategoryDialog } from "@/components/add-category-dialog";
import { ManageCategoriesDialog } from "@/components/manage-categories-dialog";
import { ManageFieldValuesDialog } from "@/components/manage-field-values-dialog";
import { FieldValueDialog } from "@/components/field-value-dialog";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ContentSnippet, Category, FieldValue, TagType } from "@shared/schema";

interface ContentLibraryProps {
  snippets: ContentSnippet[];
  categories: Category[];
  fieldValues: FieldValue[];
  onSnippetSelect: (snippet: ContentSnippet) => void;
  onFieldValueSelect: (fieldValue: FieldValue) => void;
  selectedTag: string | null;
  selectedTagType: TagType | null;
}

export function ContentLibrary({
  snippets,
  categories,
  fieldValues,
  onSnippetSelect,
  onFieldValueSelect,
  selectedTag,
  selectedTagType,
}: ContentLibraryProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showAddContent, setShowAddContent] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [showManageFieldValues, setShowManageFieldValues] = useState(false);
  const [showAddFieldValue, setShowAddFieldValue] = useState(false);
  const [fieldValueToEdit, setFieldValueToEdit] = useState<FieldValue | null>(null);
  const [snippetToDelete, setSnippetToDelete] = useState<ContentSnippet | null>(null);
  const [activeTab, setActiveTab] = useState<string>("snippets");

  useEffect(() => {
    if (selectedTagType === 'field') {
      setActiveTab('fields');
    } else if (selectedTagType === 'content') {
      setActiveTab('snippets');
    }
  }, [selectedTagType]);

  const deleteSnippetMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/content-snippets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/content-snippets'] });
      toast({
        title: "Content deleted",
        description: "The content snippet has been removed.",
      });
      setSnippetToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete content",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredSnippets = snippets.filter(snippet => {
    const plainContent = stripHtmlToPlainText(snippet.content);
    const matchesSearch = snippet.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         plainContent.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || snippet.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredFieldValues = fieldValues.filter(fieldValue => {
    const matchesSearch = fieldValue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fieldValue.value.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const getCategoryById = (id: string | null) => {
    if (!id) return null;
    return categories.find(c => c.id === id);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex-shrink-0 space-y-3">
        <div className="flex items-center justify-end gap-1 flex-wrap">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowManageFieldValues(true)}
            data-testid="button-manage-fields"
            title="Manage Fields"
          >
            <Variable className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowManageCategories(true)}
            data-testid="button-manage-categories"
            title="Manage Categories"
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddCategory(true)}
            data-testid="button-add-category"
          >
            <Plus className="w-3 h-3" />
            Category
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => activeTab === "fields" ? setShowAddFieldValue(true) : setShowAddContent(true)}
            data-testid="button-add-content"
          >
            <Plus className="w-3 h-3" />
            {activeTab === "fields" ? "Field" : "Content"}
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={activeTab === "fields" ? "Search fields..." : "Search content..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
            data-testid="input-search-content"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="snippets" data-testid="tab-snippets">
              <FileText className="w-3 h-3" />
              Content
            </TabsTrigger>
            <TabsTrigger value="fields" data-testid="tab-fields">
              <Variable className="w-3 h-3" />
              Fields
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === "snippets" && (
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="h-9" data-testid="select-category-filter">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map(category => (
                <SelectItem key={category.id} value={category.id} data-testid={`select-item-category-${category.id}`}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {selectedTag && (
        <div className="px-4 py-2 bg-accent/50 border-b flex-shrink-0">
          <p className="text-xs text-muted-foreground" data-testid="text-selected-tag-hint">
            Select {selectedTagType === 'field' ? 'a field' : 'content'} to map to{' '}
            <code className="font-mono font-medium text-foreground">
              {selectedTagType === 'field' ? `{{${selectedTag}}}` : `<<${selectedTag}>>`}
            </code>
          </p>
        </div>
      )}

      {activeTab === "snippets" ? (
        <>
          <ScrollArea className="flex-1">
            {filteredSnippets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
                <Archive className="w-12 h-12 mb-3 text-muted-foreground" data-testid="icon-empty-library" />
                <p className="text-sm font-medium mb-1" data-testid="text-no-content-title">No content snippets</p>
                <p className="text-xs text-muted-foreground mb-4" data-testid="text-no-content-description">
                  {searchQuery || selectedCategory !== "all" 
                    ? "Try adjusting your search or filters" 
                    : "Create reusable content snippets to populate your templates"}
                </p>
                {!searchQuery && selectedCategory === "all" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddContent(true)}
                    data-testid="button-add-content-empty"
                  >
                    <Plus className="w-3 h-3" />
                    Add Content
                  </Button>
                )}
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {filteredSnippets.map(snippet => {
                  const category = getCategoryById(snippet.categoryId);
                  const hasEmbeddedFields = snippet.embeddedFields && snippet.embeddedFields.length > 0;
                  
                  return (
                    <div
                      key={snippet.id}
                      className="w-full rounded-lg border text-left transition-all hover-elevate p-4"
                      data-testid={`card-snippet-${snippet.id}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-start gap-2 flex-wrap">
                          {category && (
                            <Badge
                              variant="secondary"
                              className="text-xs flex-shrink-0"
                              style={{
                                backgroundColor: `${category.color}20`,
                                color: category.color,
                                borderColor: `${category.color}40`,
                              }}
                              data-testid={`badge-category-${snippet.id}`}
                            >
                              {category.name}
                            </Badge>
                          )}
                          {hasEmbeddedFields && (
                            <Badge
                              variant="outline"
                              className="text-xs flex-shrink-0"
                              title={`Contains field tags: ${snippet.embeddedFields!.map(f => `{{${f}}}`).join(', ')}`}
                              data-testid={`badge-embedded-fields-${snippet.id}`}
                            >
                              <Variable className="w-3 h-3 mr-1" />
                              {snippet.embeddedFields!.length} field{snippet.embeddedFields!.length > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSnippetToDelete(snippet);
                          }}
                          data-testid={`button-delete-snippet-${snippet.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                      
                      <div
                        onClick={() => selectedTag && selectedTagType === 'content' && onSnippetSelect(snippet)}
                        className={`w-full text-left ${selectedTag && selectedTagType === 'content' ? 'cursor-pointer' : 'cursor-default'}`}
                        data-testid={`button-snippet-${snippet.id}`}
                      >
                        <h3 className="text-base font-medium mb-2 line-clamp-1" data-testid={`text-snippet-title-${snippet.id}`}>
                          {snippet.title}
                        </h3>
                        
                        <div className="text-sm text-muted-foreground line-clamp-2 mb-3" data-testid={`text-snippet-content-${snippet.id}`}>
                          <RichTextDisplay content={snippet.content} />
                        </div>
                        
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span data-testid={`text-snippet-usage-${snippet.id}`}>
                            Used {snippet.usageCount} times
                          </span>
                          <span data-testid={`text-snippet-date-${snippet.id}`}>
                            {new Date(snippet.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <div className="p-3 border-t flex-shrink-0">
            <p className="text-xs text-muted-foreground" data-testid="text-total-snippets">
              {filteredSnippets.length} of {snippets.length} snippets
            </p>
          </div>
        </>
      ) : (
        <>
          <ScrollArea className="flex-1">
            {filteredFieldValues.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
                <Variable className="w-12 h-12 mb-3 text-muted-foreground" data-testid="icon-empty-fields" />
                <p className="text-sm font-medium mb-1" data-testid="text-no-fields-title">No field values</p>
                <p className="text-xs text-muted-foreground mb-4" data-testid="text-no-fields-description">
                  {searchQuery 
                    ? "Try adjusting your search" 
                    : "Create field values to store reusable data for template tags"}
                </p>
                {!searchQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddFieldValue(true)}
                    data-testid="button-add-field-empty"
                  >
                    <Plus className="w-3 h-3" />
                    Add Field
                  </Button>
                )}
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {filteredFieldValues.map(fieldValue => (
                  <div
                    key={fieldValue.id}
                    className="w-full rounded-lg border text-left transition-all hover-elevate p-3"
                    data-testid={`card-field-value-${fieldValue.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={`flex-1 min-w-0 ${
                          selectedTag && selectedTagType === 'field' ? 'cursor-pointer' : 'cursor-default'
                        }`}
                        onClick={() => selectedTag && selectedTagType === 'field' && onFieldValueSelect(fieldValue)}
                      >
                        <code
                          className="text-sm font-mono bg-muted px-2 py-0.5 rounded mb-1 inline-block"
                          data-testid={`text-field-value-name-${fieldValue.id}`}
                        >
                          {fieldValue.name}
                        </code>
                        <p
                          className="text-sm text-muted-foreground line-clamp-2 mt-1"
                          data-testid={`text-field-value-value-${fieldValue.id}`}
                        >
                          {fieldValue.value}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFieldValueToEdit(fieldValue);
                        }}
                        data-testid={`button-edit-field-value-${fieldValue.id}`}
                      >
                        <Edit2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="p-3 border-t flex-shrink-0">
            <p className="text-xs text-muted-foreground" data-testid="text-total-fields">
              {filteredFieldValues.length} of {fieldValues.length} fields
            </p>
          </div>
        </>
      )}

      <AddContentDialog
        open={showAddContent}
        onOpenChange={setShowAddContent}
        categories={categories}
      />

      <AddCategoryDialog
        open={showAddCategory}
        onOpenChange={setShowAddCategory}
      />

      <ManageCategoriesDialog
        open={showManageCategories}
        onOpenChange={setShowManageCategories}
        categories={categories}
      />

      <ManageFieldValuesDialog
        open={showManageFieldValues}
        onOpenChange={setShowManageFieldValues}
      />

      <FieldValueDialog
        open={showAddFieldValue}
        onOpenChange={setShowAddFieldValue}
        fieldValue={null}
        prefilledName={selectedTag && selectedTagType === 'field' ? selectedTag : undefined}
      />

      <FieldValueDialog
        open={!!fieldValueToEdit}
        onOpenChange={(open) => !open && setFieldValueToEdit(null)}
        fieldValue={fieldValueToEdit}
      />

      <AlertDialog open={!!snippetToDelete} onOpenChange={(open) => !open && setSnippetToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-snippet">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Content Snippet</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{snippetToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-snippet">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => snippetToDelete && deleteSnippetMutation.mutate(snippetToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-snippet"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
