import { useEffect, useRef, useState, type FormEvent } from "react";
import { useIsMutating, useMutation } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, Building2, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useWorkspace } from "@/lib/workspace";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CreateFirmResponse = {
  workspace: { id: string; name: string; role: "Owner"; revision: 1 };
};

type FirmIntent = { name: string; requestId: string; workspaceId?: string; userId: string };

const intentStorageKey = "studio-pm-create-firm-intent";

function readSavedIntent(userId: string): FirmIntent | null {
  try {
    const raw = sessionStorage.getItem(intentStorageKey);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<FirmIntent>;
    if (value.userId !== userId || typeof value.name !== "string" || typeof value.requestId !== "string") return null;
    return {
      userId,
      name: value.name,
      requestId: value.requestId,
      ...(typeof value.workspaceId === "string" ? { workspaceId: value.workspaceId } : {}),
    };
  } catch {
    return null;
  }
}

function saveIntent(intent: FirmIntent | null) {
  try {
    if (intent) sessionStorage.setItem(intentStorageKey, JSON.stringify(intent));
    else sessionStorage.removeItem(intentStorageKey);
  } catch {
    // Recovery is best-effort; no sensitive data is stored here.
  }
}

export function CreateFirmDialog() {
  const workspace = useWorkspace();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const otherMutations = useIsMutating();
  const savedIntent = useRef<FirmIntent | null>(readSavedIntent(workspace.userId));
  const createLock = useRef(false);
  const openLock = useRef(false);
  const [open, setOpen] = useState(Boolean(savedIntent.current));
  const [name, setName] = useState(savedIntent.current?.name ?? "");
  const [requestId, setRequestId] = useState(savedIntent.current?.requestId ?? "");
  const [createdWorkspace, setCreatedWorkspace] = useState<FirmIntent | null>(
    savedIntent.current?.workspaceId ? savedIntent.current : null,
  );
  const [acknowledged, setAcknowledged] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const createMutation = useMutation({
    mutationFn: (intent: FirmIntent) =>
      apiRequest<CreateFirmResponse>("POST", "/api/workspaces", {
        name: intent.name,
        requestId: intent.requestId,
      }),
  });

  useEffect(() => {
    if (open && !requestId) {
      const id = crypto.randomUUID();
      setRequestId(id);
      saveIntent({ name, requestId: id, userId: workspace.userId });
    }
  }, [open, requestId, name]);

  const handleNameChange = (value: string) => {
    setName(value);
    setError("");
    const id = value.trim() === name.trim() && requestId ? requestId : crypto.randomUUID();
    setRequestId(id);
    const next = { name: value, requestId: id, userId: workspace.userId };
    savedIntent.current = next;
    saveIntent(next);
  };

  const finishOpening = () => {
    saveIntent(null);
    savedIntent.current = null;
    setCreatedWorkspace(null);
    setOpen(false);
    setLocation("/profile/firm");
    toast({
      title: "Firm opened",
      description: "Complete its profile in Firm settings, or invite your team at Team settings.",
    });
  };

  const openCreatedFirm = async (intent: FirmIntent) => {
    if (openLock.current) return;
    openLock.current = true;
    setOpening(true);
    setError("");
    try {
      const switched = await workspace.switchWorkspace(intent.workspaceId!, { confirmed: true });
      if (switched) {
        finishOpening();
      } else {
        setError("The firm was created, but could not be opened. Retry opening it without creating another firm.");
        saveIntent(intent);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The firm could not be opened. You can safely retry.");
      saveIntent(intent);
    } finally {
      openLock.current = false;
      setOpening(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (createLock.current || !acknowledged || !trimmedName || trimmedName.length > 100) return;

    createLock.current = true;
    setError("");
    const intent = {
      userId: workspace.userId,
      name: trimmedName,
      requestId: requestId || crypto.randomUUID(),
    };
    setRequestId(intent.requestId);
    saveIntent(intent);
    try {
      const result = await createMutation.mutateAsync(intent);
      const created = { ...intent, workspaceId: result.workspace.id };
      savedIntent.current = created;
      saveIntent(created);
      setCreatedWorkspace(created);
      await openCreatedFirm(created);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The firm could not be created. Try again.");
      saveIntent(intent);
    } finally {
      createLock.current = false;
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && (createLock.current || openLock.current)) return;
    setOpen(nextOpen);
    setError("");
    if (!nextOpen && !createdWorkspace) {
      saveIntent(null);
      savedIntent.current = null;
      setAcknowledged(false);
      setName("");
      setRequestId("");
    }
  };

  const busy = createMutation.isPending || otherMutations > 0 || opening || createLock.current || openLock.current;
  const trimmedName = name.trim();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2 h-8 w-full justify-start gap-2 text-xs"
        onClick={() => setOpen(true)}
        data-testid="button-create-firm"
      >
        <Building2 className="h-3.5 w-3.5" />
        Create firm
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[min(90dvh,42rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{createdWorkspace ? "Your firm is ready" : "Create a firm"}</DialogTitle>
            <DialogDescription>
              {createdWorkspace
                ? `${createdWorkspace.name} exists. Open it to continue in its separate workspace.`
                : "Set up another independent Studio PM workspace for a firm you run."}
            </DialogDescription>
          </DialogHeader>
          {createdWorkspace ? (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-3 text-sm leading-relaxed">
                Opening this firm switches workspaces. Any unsaved page edits will be discarded.
              </div>
              {error && <p role="alert" className="flex gap-2 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>Close</Button>
                <Button type="button" onClick={() => void openCreatedFirm(createdWorkspace)} disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                  {busy ? "Opening…" : "Open firm"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="new-firm-name" className="text-sm font-medium">Firm name</label>
                <Input
                  id="new-firm-name"
                  autoFocus
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => handleNameChange(event.target.value)}
                  placeholder="e.g. Northline Studio"
                  aria-describedby="firm-name-help"
                  disabled={createMutation.isPending}
                />
                <p id="firm-name-help" className="text-xs text-muted-foreground">1–100 characters. Leading and trailing spaces are removed.</p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                <p>This workspace is separate from companies in your client/vendor address book. No existing records or team members will be copied.</p>
                <p className="mt-2 font-medium text-foreground">Creating and opening the firm changes your workspace. Unsaved page edits will be discarded.</p>
              </div>
              <label className="flex cursor-pointer items-start gap-2 text-sm leading-relaxed">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 accent-primary"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                  disabled={busy}
                  required
                />
                <span>I understand that switching to the new firm will discard unsaved page edits.</span>
              </label>
              {error && <p role="alert" className="flex gap-2 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
              {createMutation.isPending && <p role="status" className="text-xs text-muted-foreground">Creating your firm… Keep this window open; retrying uses the same request safely.</p>}
              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>Cancel</Button>
                <Button type="submit" disabled={busy || !trimmedName || trimmedName.length > 100 || !acknowledged}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Building2 className="mr-2 h-4 w-4" />}
                  {createMutation.isPending ? "Creating…" : otherMutations > 0 ? "Saving changes…" : "Create and open"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
