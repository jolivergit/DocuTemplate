import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  SERVICE_CATEGORIES,
  DISCIPLINES,
  PROPOSAL_STATUSES,
  type ProposalWithPhases,
} from "@shared/schema";

type FeeType = "Fixed" | "Hourly";

interface FeeLineState {
  serviceCategory: string;
  discipline: string;
  feeType: FeeType;
  amount: string;
  sortOrder: number;
}

interface PhaseState {
  tempId: string;
  name: string;
  sortOrder: number;
  feeLines: FeeLineState[];
}

function buildDefaultFeeLines(): FeeLineState[] {
  const lines: FeeLineState[] = [];
  let idx = 0;
  for (const cat of SERVICE_CATEGORIES) {
    for (const disc of DISCIPLINES) {
      lines.push({ serviceCategory: cat, discipline: disc, feeType: "Fixed", amount: "", sortOrder: idx++ });
    }
  }
  return lines;
}

function buildDefaultPhase(sortOrder: number): PhaseState {
  return {
    tempId: `phase-${Date.now()}-${sortOrder}`,
    name: `Phase ${sortOrder + 1}`,
    sortOrder,
    feeLines: buildDefaultFeeLines(),
  };
}

function phaseTotal(phase: PhaseState): number {
  return phase.feeLines.reduce((sum, fl) => {
    if (fl.feeType === "Fixed" && fl.amount) {
      const n = parseFloat(fl.amount);
      return isNaN(n) ? sum : sum + n;
    }
    return sum;
  }, 0);
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: number;
  existing?: ProposalWithPhases;
  onSaved?: () => void;
}

export function ProposalFormDialog({ open, onOpenChange, leadId, existing, onSaved }: Props) {
  const { toast } = useToast();
  const isEdit = !!existing;

  const initPhases = (): PhaseState[] => {
    if (existing && existing.phases.length > 0) {
      return existing.phases.map((ph, i) => ({
        tempId: ph.id,
        name: ph.name,
        sortOrder: ph.sortOrder,
        feeLines: buildDefaultFeeLines().map((dl) => {
          const saved = ph.feeLines.find(
            (fl) => fl.serviceCategory === dl.serviceCategory && fl.discipline === dl.discipline
          );
          return saved
            ? { ...dl, feeType: saved.feeType as FeeType, amount: saved.amount || "" }
            : dl;
        }),
      }));
    }
    return [buildDefaultPhase(0)];
  };

  const [name, setName] = useState(existing?.name || "");
  const [description, setDescription] = useState(existing?.description || "");
  const [status, setStatus] = useState<string>(existing?.status || "Draft");
  const [phases, setPhases] = useState<PhaseState[]>(initPhases);
  const [openPhases, setOpenPhases] = useState<Set<string>>(new Set<string>([phases[0]?.tempId || ""]));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        status,
        phases: phases.map((ph) => ({
          name: ph.name,
          sortOrder: ph.sortOrder,
          feeLines: ph.feeLines
            .filter((fl) => fl.amount || fl.feeType === "Hourly")
            .map((fl) => ({ ...fl, amount: fl.amount || null })),
        })),
      };
      if (isEdit) {
        return apiRequest("PATCH", `/api/proposals/${existing.id}`, body);
      } else {
        return apiRequest("POST", `/api/leads/${leadId}/proposals`, body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "proposals"] });
      toast({ title: isEdit ? "Proposal updated" : "Proposal created" });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save proposal", description: err.message, variant: "destructive" });
    },
  });

  const addPhase = () => {
    const newPhase = buildDefaultPhase(phases.length);
    setPhases([...phases, newPhase]);
    setOpenPhases((prev) => new Set([...Array.from(prev), newPhase.tempId]));
  };

  const removePhase = (tempId: string) => {
    if (phases.length <= 1) return;
    setPhases(phases.filter((p) => p.tempId !== tempId).map((p, i) => ({ ...p, sortOrder: i })));
  };

  const updatePhaseName = (tempId: string, name: string) => {
    setPhases(phases.map((p) => (p.tempId === tempId ? { ...p, name } : p)));
  };

  const updateFeeLine = (tempId: string, serviceCategory: string, discipline: string, field: "feeType" | "amount", value: string) => {
    setPhases(
      phases.map((p) =>
        p.tempId === tempId
          ? {
              ...p,
              feeLines: p.feeLines.map((fl) =>
                fl.serviceCategory === serviceCategory && fl.discipline === discipline
                  ? { ...fl, [field]: value, ...(field === "feeType" && value === "Hourly" ? { amount: "" } : {}) }
                  : fl
              ),
            }
          : p
      )
    );
  };

  const togglePhase = (tempId: string) => {
    setOpenPhases((prev) => {
      const next = new Set(Array.from(prev));
      if (next.has(tempId)) next.delete(tempId);
      else next.add(tempId);
      return next;
    });
  };

  const grandTotal = phases.reduce((sum, ph) => sum + phaseTotal(ph), 0);

  const canSave = name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Proposal" : "New Proposal"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="proposal-name">Proposal Name</Label>
              <Input
                id="proposal-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Base Scope Proposal"
                data-testid="input-proposal-name"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="proposal-description">Description (optional)</Label>
              <Textarea
                id="proposal-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the scope of this proposal…"
                rows={2}
                data-testid="input-proposal-description"
              />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-proposal-status">
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

          {/* Fee breakdown */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold">Fee Breakdown</h3>
                {grandTotal > 0 && (
                  <p className="text-xs text-muted-foreground">Grand Total: {fmt(grandTotal)}</p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={addPhase} data-testid="button-add-phase">
                <Plus className="w-3.5 h-3.5" />
                Add Phase
              </Button>
            </div>

            <div className="space-y-3">
              {phases.map((phase) => {
                const isOpen = openPhases.has(phase.tempId);
                const total = phaseTotal(phase);
                return (
                  <div key={phase.tempId} className="rounded-md border">
                    <Collapsible open={isOpen} onOpenChange={() => togglePhase(phase.tempId)}>
                      <CollapsibleTrigger asChild>
                        <button className="w-full flex items-center justify-between p-3 text-left hover-elevate rounded-t-md">
                          <div className="flex items-center gap-3 flex-1 mr-2">
                            {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                            <Input
                              value={phase.name}
                              onChange={(e) => { e.stopPropagation(); updatePhaseName(phase.tempId, e.target.value); }}
                              onClick={(e) => e.stopPropagation()}
                              className="h-7 text-sm font-medium border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                              placeholder="Phase name"
                              data-testid={`input-phase-name-${phase.sortOrder}`}
                            />
                            {total > 0 && (
                              <Badge variant="secondary" className="text-xs ml-auto">{fmt(total)}</Badge>
                            )}
                          </div>
                          {phases.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); removePhase(phase.tempId); }}
                              data-testid={`button-remove-phase-${phase.sortOrder}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          )}
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t">
                          {SERVICE_CATEGORIES.map((cat, catIdx) => {
                            const catLines = phase.feeLines.filter((fl) => fl.serviceCategory === cat);
                            const catTotal = catLines.reduce((s, fl) => {
                              if (fl.feeType === "Fixed" && fl.amount) {
                                const n = parseFloat(fl.amount);
                                return isNaN(n) ? s : s + n;
                              }
                              return s;
                            }, 0);
                            return (
                              <div key={cat} className={catIdx > 0 ? "border-t" : ""}>
                                <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
                                  <span className="text-xs font-medium text-muted-foreground">{cat}</span>
                                  {catTotal > 0 && (
                                    <span className="text-xs text-muted-foreground">{fmt(catTotal)}</span>
                                  )}
                                </div>
                                <div className="divide-y">
                                  {catLines.map((fl) => (
                                    <div key={fl.discipline} className="grid grid-cols-[1fr_120px_140px] gap-3 items-center px-4 py-2">
                                      <span className="text-sm text-muted-foreground">{fl.discipline}</span>
                                      <Select
                                        value={fl.feeType}
                                        onValueChange={(v) => updateFeeLine(phase.tempId, cat, fl.discipline, "feeType", v)}
                                      >
                                        <SelectTrigger className="h-8 text-xs" data-testid={`select-feetype-${phase.sortOrder}-${cat}-${fl.discipline}`}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Fixed">Fixed</SelectItem>
                                          <SelectItem value="Hourly">Hourly</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      {fl.feeType === "Fixed" ? (
                                        <div className="relative">
                                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                                          <Input
                                            type="number"
                                            min="0"
                                            step="100"
                                            value={fl.amount}
                                            onChange={(e) => updateFeeLine(phase.tempId, cat, fl.discipline, "amount", e.target.value)}
                                            className="h-8 pl-5 text-sm"
                                            placeholder="0"
                                            data-testid={`input-fee-${phase.sortOrder}-${cat}-${fl.discipline}`}
                                          />
                                        </div>
                                      ) : (
                                        <span className="text-xs text-muted-foreground italic px-2">Billed at invoice</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!canSave || saveMutation.isPending}
            data-testid="button-save-proposal"
          >
            {saveMutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Proposal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
