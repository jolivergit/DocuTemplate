import { useState } from "react";
import { Plus, Search, Archive, Trash2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ContentSnippet, Category } from "@shared/schema";

interface ContentLibraryProps {
  snippets: ContentSnippet[];
  categories: Category[];
  onSnippetSelect: (snippet: ContentSnippet) => void;
  selectedTag: string | null;
}

export function ContentLibrary({
  snippets,
  categories,
  onSnippetSelect,
  selectedTag,
}: ContentLibraryProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showAddContent, setShowAddContent] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [snippetToDelete, setSnippetToDelete] = useState<ContentSnippet | null>(null);

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
    const matchesSearch = snippet.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         snippet.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || snippet.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryById = (id: string | null) => {
    if (!id) return null;
    return categories.find(c => c.id === id);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex-shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground" data-testid="text-library-title">
            Content Library
          </h2>
          <div className="flex items-center gap-1">
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
              onClick={() => setShowAddContent(true)}
              data-testid="button-add-content"
            >
              <Plus className="w-3 h-3" />
              Content
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
            data-testid="input-search-content"
          />
        </div>

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
      </div>

      {selectedTag && (
        <div className="px-4 py-2 bg-accent/50 border-b flex-shrink-0">
          <p className="text-xs text-muted-foreground" data-testid="text-selected-tag-hint">
            Select content to map to <code className="font-mono font-medium text-foreground">&lt;&lt;{selectedTag}&gt;&gt;</code>
          </p>
        </div>
      )}

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
              
              return (
                <div
                  key={snippet.id}
                  className="w-full rounded-lg border text-left transition-all hover-elevate p-4"
                  data-testid={`card-snippet-${snippet.id}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-start gap-2">
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
                    onClick={() => selectedTag && onSnippetSelect(snippet)}
                    className={`w-full text-left ${selectedTag ? 'cursor-pointer' : 'cursor-default'}`}
                    data-testid={`button-snippet-${snippet.id}`}
                  >
                    <h3 className="text-base font-medium mb-2 line-clamp-1" data-testid={`text-snippet-title-${snippet.id}`}>
                      {snippet.title}
                    </h3>
                    
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3" data-testid={`text-snippet-content-${snippet.id}`}>
                      {snippet.content}
                    </p>
                    
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
