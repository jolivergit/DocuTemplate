import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  PHASE_TYPES,
  CONSULTANTS,
  PROPOSAL_STATUSES,
  type PhaseType,
  type ProposalWithPhases,
} from "@shared/schema";

type FeeType = "Fixed" | "Hourly";

interface ConsultantState {
  selected: boolean;
  feeType: FeeType;
  amount: string;
}

interface PhaseState {
  selected: boolean;
  consultants: Record<string, ConsultantState>;
}

type PhasesState = Record<string, PhaseState>;

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

function initConsultantsState(): Record<string, ConsultantState> {
  const state: Record<string, ConsultantState> = {};
  for (const c of CONSULTANTS) {
    state[c] = { selected: false, feeType: "Fixed", amount: "" };
  }
  return state;
}

function initPhasesState(existing?: ProposalWithPhases): PhasesState {
  const state: PhasesState = {};
  for (const pt of PHASE_TYPES) {
    state[pt] = { selected: false, consultants: initConsultantsState() };
  }
  if (existing) {
    for (const phase of existing.phases) {
      const pt = PHASE_TYPES.find((p) => p === phase.name);
      if (pt) {
        state[pt].selected = true;
        for (const fl of phase.feeLines) {
          const c = CONSULTANTS.find((c) => c === fl.consultant);
          if (c) {
            state[pt].consultants[c] = {
              selected: true,
              feeType: fl.feeType as FeeType,
              amount: fl.amount || "",
            };
          }
        }
      }
    }
  }
  return state;
}

function phaseSubtotal(phaseData: PhaseState): number {
  return CONSULTANTS.reduce((sum, c) => {
    const cs = phaseData.consultants[c];
    if (cs.selected && cs.feeType === "Fixed" && cs.amount) {
      const n = parseFloat(cs.amount);
      return isNaN(n) ? sum : sum + n;
    }
    return sum;
  }, 0);
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

  const [name, setName] = useState(existing?.name || "");
  const [description, setDescription] = useState(existing?.description || "");
  const [status, setStatus] = useState<string>(existing?.status || "Draft");
  const [phases, setPhases] = useState<PhasesState>(() => initPhasesState(existing));
  const [openPhases, setOpenPhases] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (existing) {
      for (const phase of existing.phases) {
        if (PHASE_TYPES.includes(phase.name as PhaseType)) initial.add(phase.name);
      }
    }
    return initial;
  });

  const togglePhaseSelected = (pt: string) => {
    setPhases((prev) => {
      const next = { ...prev, [pt]: { ...prev[pt], selected: !prev[pt].selected } };
      return next;
    });
    setOpenPhases((prev) => {
      const next = new Set(Array.from(prev));
      if (next.has(pt)) {
        // If deselecting, remove from open set
        if (phases[pt].selected) next.delete(pt);
      } else {
        // If selecting, auto-open
        if (!phases[pt].selected) next.add(pt);
      }
      return next;
    });
  };

  const togglePhaseOpen = (pt: string) => {
    setOpenPhases((prev) => {
      const next = new Set(Array.from(prev));
      if (next.has(pt)) next.delete(pt);
      else next.add(pt);
      return next;
    });
  };

  const toggleConsultant = (pt: string, c: string) => {
    setPhases((prev) => ({
      ...prev,
      [pt]: {
        ...prev[pt],
        consultants: {
          ...prev[pt].consultants,
          [c]: { ...prev[pt].consultants[c], selected: !prev[pt].consultants[c].selected },
        },
      },
    }));
  };

  const updateConsultantField = (pt: string, c: string, field: "feeType" | "amount", value: string) => {
    setPhases((prev) => ({
      ...prev,
      [pt]: {
        ...prev[pt],
        consultants: {
          ...prev[pt].consultants,
          [c]: {
            ...prev[pt].consultants[c],
            [field]: value,
            ...(field === "feeType" && value === "Hourly" ? { amount: "" } : {}),
          },
        },
      },
    }));
  };

  const selectedPhases = PHASE_TYPES.filter((pt) => phases[pt].selected);
  const grandTotal = selectedPhases.reduce((sum, pt) => sum + phaseSubtotal(phases[pt]), 0);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        status,
        phases: selectedPhases.map((pt, idx) => ({
          name: pt,
          sortOrder: idx,
          feeLines: CONSULTANTS.filter((c) => phases[pt].consultants[c].selected).map((c, cidx) => ({
            consultant: c,
            feeType: phases[pt].consultants[c].feeType,
            amount: phases[pt].consultants[c].amount || null,
            sortOrder: cidx,
          })),
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

  const canSave = name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
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
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">Fee Breakdown</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Select phases, then choose which consultants are involved in each.</p>
              </div>
              {grandTotal > 0 && (
                <span className="text-sm font-semibold">{fmt(grandTotal)}</span>
              )}
            </div>

            {/* Phase toggles */}
            <div className="flex flex-wrap gap-2 mb-4">
              {PHASE_TYPES.map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => togglePhaseSelected(pt)}
                  className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                    phases[pt].selected
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
                  }`}
                  data-testid={`toggle-phase-${pt.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  {pt}
                </button>
              ))}
            </div>

            {/* Selected phase panels */}
            {selectedPhases.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6 border rounded-md bg-muted/10">
                Select one or more phases above to build the fee breakdown.
              </p>
            )}
            <div className="space-y-2">
              {selectedPhases.map((pt) => {
                const phaseData = phases[pt];
                const isOpen = openPhases.has(pt);
                const subtotal = phaseSubtotal(phaseData);
                const selectedConsultantCount = CONSULTANTS.filter((c) => phaseData.consultants[c].selected).length;

                return (
                  <div key={pt} className="rounded-md border">
                    <Collapsible open={isOpen} onOpenChange={() => togglePhaseOpen(pt)}>
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="w-full flex items-center justify-between p-3 text-left hover-elevate rounded-md"
                        >
                          <div className="flex items-center gap-2">
                            {isOpen
                              ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                              : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            }
                            <span className="text-sm font-medium">{pt}</span>
                            {!isOpen && selectedConsultantCount > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {selectedConsultantCount} consultant{selectedConsultantCount !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {subtotal > 0 && (
                              <Badge variant="secondary" className="text-xs">{fmt(subtotal)}</Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePhaseSelected(pt);
                              }}
                              data-testid={`button-remove-phase-${pt.replace(/\s+/g, "-").toLowerCase()}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t divide-y">
                          {CONSULTANTS.map((c) => {
                            const cs = phaseData.consultants[c];
                            return (
                              <div
                                key={c}
                                className={`grid grid-cols-[auto_1fr_120px_140px] gap-3 items-center px-4 py-2.5 ${!cs.selected ? "opacity-50" : ""}`}
                              >
                                <Checkbox
                                  id={`${pt}-${c}`}
                                  checked={cs.selected}
                                  onCheckedChange={() => toggleConsultant(pt, c)}
                                  data-testid={`checkbox-consultant-${pt.replace(/\s+/g, "-").toLowerCase()}-${c.replace(/\s+/g, "-").toLowerCase()}`}
                                />
                                <label
                                  htmlFor={`${pt}-${c}`}
                                  className="text-sm cursor-pointer select-none"
                                >
                                  {c}
                                </label>
                                {cs.selected ? (
                                  <>
                                    <Select
                                      value={cs.feeType}
                                      onValueChange={(v) => updateConsultantField(pt, c, "feeType", v)}
                                    >
                                      <SelectTrigger
                                        className="h-8 text-xs"
                                        data-testid={`select-feetype-${pt.replace(/\s+/g, "-").toLowerCase()}-${c.replace(/\s+/g, "-").toLowerCase()}`}
                                      >
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Fixed">Fixed</SelectItem>
                                        <SelectItem value="Hourly">Hourly</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    {cs.feeType === "Fixed" ? (
                                      <div className="relative">
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                                        <Input
                                          type="number"
                                          min="0"
                                          step="100"
                                          value={cs.amount}
                                          onChange={(e) => updateConsultantField(pt, c, "amount", e.target.value)}
                                          className="h-8 pl-5 text-sm"
                                          placeholder="0"
                                          data-testid={`input-fee-${pt.replace(/\s+/g, "-").toLowerCase()}-${c.replace(/\s+/g, "-").toLowerCase()}`}
                                        />
                                      </div>
                                    ) : (
                                      <span className="text-xs text-muted-foreground italic px-2">Billed at invoice</span>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <div />
                                    <div />
                                  </>
                                )}
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
