import { useState, useEffect } from "react";
import { Plus, Search, Archive, Trash2, Settings, Building2, FileText, MapPin, Phone, Mail, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AddContentDialog } from "@/components/add-content-dialog";
import { AddCategoryDialog } from "@/components/add-category-dialog";
import { ManageCategoriesDialog } from "@/components/manage-categories-dialog";
import { ManageProfilesDialog } from "@/components/manage-profiles-dialog";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ContentSnippet, Category, Profile, ProfileFieldKey, TagType } from "@shared/schema";
import { PROFILE_FIELDS } from "@shared/schema";

interface ContentLibraryProps {
  snippets: ContentSnippet[];
  categories: Category[];
  profiles: Profile[];
  onSnippetSelect: (snippet: ContentSnippet) => void;
  onProfileFieldSelect: (profileId: string, fieldKey: ProfileFieldKey) => void;
  selectedTag: string | null;
  selectedTagType: TagType | null;
}

export function ContentLibrary({
  snippets,
  categories,
  profiles,
  onSnippetSelect,
  onProfileFieldSelect,
  selectedTag,
  selectedTagType,
}: ContentLibraryProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showAddContent, setShowAddContent] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [showManageProfiles, setShowManageProfiles] = useState(false);
  const [snippetToDelete, setSnippetToDelete] = useState<ContentSnippet | null>(null);
  const [expandedProfiles, setExpandedProfiles] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>("snippets");

  // Auto-switch tab based on selected tag type
  useEffect(() => {
    if (selectedTagType === 'field') {
      setActiveTab('profiles');
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

  const filteredProfiles = profiles.filter(profile => {
    const matchesSearch = profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (profile.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (profile.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    return matchesSearch;
  });

  const getCategoryById = (id: string | null) => {
    if (!id) return null;
    return categories.find(c => c.id === id);
  };

  const toggleProfileExpanded = (profileId: string) => {
    const newExpanded = new Set(expandedProfiles);
    if (newExpanded.has(profileId)) {
      newExpanded.delete(profileId);
    } else {
      newExpanded.add(profileId);
    }
    setExpandedProfiles(newExpanded);
  };

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

  const formatAddress = (profile: Profile) => {
    const parts = [];
    if (profile.addressLine1) parts.push(profile.addressLine1);
    if (profile.addressLine2) parts.push(profile.addressLine2);
    const cityStateZip = [profile.city, profile.state, profile.zip].filter(Boolean).join(', ');
    if (cityStateZip) parts.push(cityStateZip);
    return parts.join(' ');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex-shrink-0 space-y-3">
        <div className="flex items-center justify-end gap-1 flex-wrap">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowManageProfiles(true)}
            data-testid="button-manage-profiles"
            title="Manage Profiles"
          >
            <Building2 className="w-4 h-4" />
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
            onClick={() => setShowAddContent(true)}
            data-testid="button-add-content"
          >
            <Plus className="w-3 h-3" />
            Content
          </Button>
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="snippets" data-testid="tab-snippets">
              <FileText className="w-3 h-3" />
              Content
            </TabsTrigger>
            <TabsTrigger value="profiles" data-testid="tab-profiles">
              <Building2 className="w-3 h-3" />
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
            Select content to map to <code className="font-mono font-medium text-foreground">&lt;&lt;{selectedTag}&gt;&gt;</code>
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
            {filteredProfiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
                <Building2 className="w-12 h-12 mb-3 text-muted-foreground" data-testid="icon-empty-profiles" />
                <p className="text-sm font-medium mb-1" data-testid="text-no-profiles-title">No profiles</p>
                <p className="text-xs text-muted-foreground mb-4" data-testid="text-no-profiles-description">
                  {searchQuery 
                    ? "Try adjusting your search" 
                    : "Create profiles to store company and client information"}
                </p>
                {!searchQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowManageProfiles(true)}
                    data-testid="button-add-profile-empty"
                  >
                    <Plus className="w-3 h-3" />
                    Add Profile
                  </Button>
                )}
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {filteredProfiles.map(profile => (
                  <Collapsible
                    key={profile.id}
                    open={expandedProfiles.has(profile.id)}
                    onOpenChange={() => toggleProfileExpanded(profile.id)}
                  >
                    <div
                      className="rounded-lg border transition-all hover-elevate"
                      data-testid={`card-profile-${profile.id}`}
                    >
                      <CollapsibleTrigger className="w-full p-4 text-left">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-base mb-1" data-testid={`text-profile-name-${profile.id}`}>
                              {profile.name}
                            </h3>
                            {(profile.contactName || profile.contactTitle) && (
                              <p className="text-sm text-muted-foreground mb-1">
                                {[profile.contactName, profile.contactTitle].filter(Boolean).join(', ')}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              {(profile.addressLine1 || profile.city || profile.state) && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {formatAddress(profile) || 'No address'}
                                </span>
                              )}
                              {profile.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {profile.phone}
                                </span>
                              )}
                              {profile.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {profile.email}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight 
                            className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ${
                              expandedProfiles.has(profile.id) ? 'rotate-90' : ''
                            }`}
                          />
                        </div>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <div className="px-4 pb-4 border-t pt-3">
                          <p className="text-xs text-muted-foreground mb-2">
                            {selectedTag 
                              ? "Click a field to map it to the selected tag"
                              : "Select a tag first, then choose a profile field"}
                          </p>
                          <div className="grid grid-cols-1 gap-1">
                            {PROFILE_FIELDS.map(field => {
                              const value = getProfileFieldValue(profile, field.key);
                              if (!value) return null;
                              
                              return (
                                <button
                                  key={field.key}
                                  onClick={() => selectedTag && onProfileFieldSelect(profile.id, field.key)}
                                  className={`flex items-center justify-between p-2 rounded-md text-left text-sm transition-all ${
                                    selectedTag 
                                      ? 'hover:bg-accent cursor-pointer' 
                                      : 'cursor-default opacity-60'
                                  }`}
                                  disabled={!selectedTag}
                                  data-testid={`button-profile-field-${profile.id}-${field.key}`}
                                >
                                  <span className="text-xs text-muted-foreground w-28 flex-shrink-0">
                                    {field.label}
                                  </span>
                                  <span className="flex-1 truncate font-medium">
                                    {value}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="p-3 border-t flex-shrink-0">
            <p className="text-xs text-muted-foreground" data-testid="text-total-profiles">
              {filteredProfiles.length} of {profiles.length} profiles
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

      <ManageProfilesDialog
        open={showManageProfiles}
        onOpenChange={setShowManageProfiles}
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
