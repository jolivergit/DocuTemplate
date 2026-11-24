import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrencyWhole } from "@/lib/utils";
import { PROPOSAL_STATUSES, type ProposalWithPhases } from "@shared/schema";

interface LineItemRow {
  id: string;
  description: string;
  amount: string;
}

function makeRow(): LineItemRow {
  return { id: crypto.randomUUID(), description: "", amount: "" };
}

function comparableItems(items: Array<{ description: string; amount: string | null }>) {
  return JSON.stringify(items.filter(item => item.description.trim())
    .map(item => ({ description: item.description.trim(), amount: item.amount || "" })));
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: number;
  existing?: ProposalWithPhases;
  onSaved?: () => void;
  inline?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}

export function AdditionalServicesFormDialog({ open, onOpenChange, leadId, existing, onSaved, inline = false, onDirtyChange }: Props) {
  const { toast } = useToast();
  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name || "");
  const [description, setDescription] = useState(existing?.description || "");
  const [status, setStatus] = useState<string>(existing?.status || "Draft");
  const [lineItems, setLineItems] = useState<LineItemRow[]>(() => {
    if (existing && existing.additionalLineItems && existing.additionalLineItems.length > 0) {
      return existing.additionalLineItems.map((item) => ({
        id: item.id,
        description: item.description,
        amount: item.amount || "",
      }));
    }
    return [makeRow()];
  });
  const [formError, setFormError] = useState("");
  const initializedForOpen = useRef(false);
  const initial = useRef({ name: existing?.name || "", description: existing?.description || "", status: existing?.status || "Draft", lineItems: comparableItems(existing?.additionalLineItems || []) });
  useEffect(() => {
    if (!open) { initializedForOpen.current = false; return; }
    if (initializedForOpen.current) return;
    const rows = existing?.additionalLineItems?.length
      ? existing.additionalLineItems.map(item => ({ id: item.id, description: item.description, amount: item.amount || "" }))
      : [makeRow()];
    const values = { name: existing?.name || "", description: existing?.description || "", status: existing?.status || "Draft" };
    setName(values.name); setDescription(values.description); setStatus(values.status);
    setLineItems(rows); setFormError("");
    initial.current = { ...values, lineItems: comparableItems(rows) };
    initializedForOpen.current = true;
  }, [open, existing]);
  const lineItemsChanged = comparableItems(lineItems) !== initial.current.lineItems;
  const dirty = open && initializedForOpen.current && (name !== initial.current.name || description !== initial.current.description || status !== initial.current.status || lineItemsChanged);
  const dirtyCallback = useRef(onDirtyChange);
  dirtyCallback.current = onDirtyChange;
  const addRow = () => setLineItems((prev) => [...prev, makeRow()]);

  const removeRow = (id: string) => {
    setLineItems((prev) => {
      const next = prev.filter((r) => r.id !== id);
      return next.length === 0 ? [makeRow()] : next;
    });
  };

  const updateRow = (id: string, field: "description" | "amount", value: string) => {
    setLineItems((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const grandTotal = lineItems.reduce((sum, r) => {
    const n = parseFloat(r.amount);
    return isNaN(n) ? sum : sum + n;
  }, 0);

  const saveMutation = useMutation({
    mutationKey: ["project-proposal-save", leadId],
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        status,
        proposalType: "Additional Services",
        ...(!isEdit ? { phases: [] } : {}),
        ...(!isEdit || lineItemsChanged ? { additionalLineItems: lineItems
          .filter((r) => r.description.trim())
          .map((r, idx) => ({
            description: r.description.trim(),
            amount: r.amount ? r.amount : null,
            sortOrder: idx,
          })) } : {}),
      };
      if (isEdit) {
        return apiRequest("PATCH", `/api/proposals/${existing!.id}`, body);
      } else {
        return apiRequest("POST", `/api/leads/${leadId}/proposals`, body);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "proposals"] });
      toast({ title: isEdit ? "Additional Services proposal updated" : "Additional Services proposal created" });
      onSaved?.();
      dirtyCallback.current?.(false);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      setFormError(err.message);
      toast({ title: "Failed to save proposal", description: err.message, variant: "destructive" });
    },
  });
  const closeForm = (next: boolean) => {
    if (!next && (saveMutation.isPending || queryClient.isMutating({ mutationKey: ["project-proposal-save", leadId] }))) return;
    if (!next && dirty && !window.confirm("Discard unsaved Additional Services proposal edits?")) return;
    dirtyCallback.current?.(false);
    onOpenChange(next);
  };
  useEffect(() => { dirtyCallback.current?.(dirty || saveMutation.isPending); }, [dirty, saveMutation.isPending]);

  const canSave = name.trim().length > 0;

  const content = <>
        {inline ? <div className="mb-4"><h2 className="text-base font-semibold">{isEdit ? "Edit Additional Services proposal" : "New Additional Services proposal"}</h2></div> : <DialogHeader><DialogTitle>{isEdit ? "Edit Additional Services Proposal" : "New Additional Services Proposal"}</DialogTitle></DialogHeader>}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {/* Basic info */}
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="as-name">Proposal Name</Label>
              <Input
                id="as-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Add Services — Phase 2 Scope"
                data-testid="input-as-proposal-name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="as-description">Description (optional)</Label>
              <Textarea
                id="as-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the additional scope…"
                rows={2}
                data-testid="input-as-proposal-description"
              />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-as-proposal-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROPOSAL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold">Line Items</h3>
              </div>
              <div className="flex items-center gap-3">
                {grandTotal > 0 && (
                  <span className="text-sm font-semibold">{formatCurrencyWhole(grandTotal)}</span>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addRow}
                  data-testid="button-add-as-line-item"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Item
                </Button>
              </div>
            </div>

            <div className="rounded-md border overflow-hidden">
              <div className="grid grid-cols-[1fr_130px_36px] gap-0 bg-muted/30 border-b">
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground">Description</div>
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground">Amount</div>
                <div />
              </div>
              <div className="divide-y">
                {lineItems.map((row, idx) => (
                  <div key={row.id} className="grid grid-cols-[1fr_130px_36px] gap-0 items-center">
                    <div className="px-3 py-2">
                      <Input
                        value={row.description}
                        onChange={(e) => updateRow(row.id, "description", e.target.value)}
                        placeholder={`Scope item ${idx + 1}`}
                        className="h-8 text-sm border-0 shadow-none focus-visible:ring-0 p-0"
                        data-testid={`input-as-desc-${idx}`}
                      />
                    </div>
                    <div className="px-3 py-2">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                        <Input
                          type="number"
                          min="0"
                          step="100"
                          value={row.amount}
                          onChange={(e) => updateRow(row.id, "amount", e.target.value)}
                          placeholder="0"
                          className="h-8 pl-5 text-sm"
                          data-testid={`input-as-amount-${idx}`}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(row.id)}
                        data-testid={`button-remove-as-item-${idx}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {grandTotal > 0 && (
                <div className="px-3 py-2.5 bg-muted/10 border-t flex justify-between items-center">
                  <span className="text-xs font-medium text-muted-foreground">Total</span>
                  <span className="text-sm font-semibold">{formatCurrencyWhole(grandTotal)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={`flex justify-end gap-2 border-t pt-4 ${inline ? "mt-4" : ""}`}>
          <Button variant="outline" onClick={() => closeForm(false)}>Cancel</Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!canSave || saveMutation.isPending}
            data-testid="button-save-as-proposal"
          >
            {saveMutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Proposal"}
          </Button>
        </div>
        {formError && <p role="alert" className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">The proposal was not saved. {formError} Your edits remain here.</p>}
  </>;
  if (inline && !open) return null;
  return inline ? <section className="rounded-lg border bg-card p-4 sm:p-6" data-testid="inline-additional-services-form">{content}</section> : <Dialog open={open} onOpenChange={closeForm}><DialogContent className="max-w-2xl max-h-[90dvh] flex flex-col">{content}</DialogContent></Dialog>;
}
