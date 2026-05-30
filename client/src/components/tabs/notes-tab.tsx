import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ProjectComment } from "@shared/schema";

export function NotesTab({ leadId }: { leadId: number }) {
  const { toast } = useToast();
  const [commentText, setCommentText] = useState("");

  const { data: comments = [], isLoading: commentsLoading } = useQuery<ProjectComment[]>({
    queryKey: ["/api/leads", leadId, "comments"],
    queryFn: async () => {
      const r = await fetch(`/api/leads/${leadId}/comments`);
      if (!r.ok) throw new Error("Failed to load comments");
      return r.json();
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/leads/${leadId}/comments`, { content: commentText.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "comments"] });
      setCommentText("");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add comment", description: err.message, variant: "destructive" });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => apiRequest("DELETE", `/api/leads/${leadId}/comments/${commentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "comments"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete comment", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="rounded-md border bg-card">
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Project Notes</h3>
      </div>

      <div className="p-4 space-y-2">
        <Textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Add a project note…"
          rows={2}
          data-testid="input-comment"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => addCommentMutation.mutate()}
            disabled={!commentText.trim() || addCommentMutation.isPending}
            data-testid="button-add-comment"
          >
            <Send className="w-3.5 h-3.5" />
            {addCommentMutation.isPending ? "Posting…" : "Post"}
          </Button>
        </div>
      </div>

      <Separator />

      {commentsLoading ? (
        <div className="p-4 space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : comments.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground text-center">No notes yet.</p>
      ) : (
        <div className="divide-y">
          {comments.map((c) => (
            <div key={c.id} className="px-4 py-3 space-y-1 group" data-testid={`comment-${c.id}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => deleteCommentMutation.mutate(c.id)}
                  data-testid={`button-delete-comment-${c.id}`}
                >
                  <Trash2 className="w-3 h-3 text-muted-foreground" />
                </Button>
              </div>
              <p className="text-sm whitespace-pre-wrap">{c.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
