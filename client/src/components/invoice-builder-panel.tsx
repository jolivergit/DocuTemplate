import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { EXPENSE_TYPES, type ProposalWithPhases } from "@shared/schema";

function fmt(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return "$0";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(num);
}

function calcEarned(baseFee: string | null | undefined, pct: string): number {
  if (!baseFee) return 0;
  const base = parseFloat(baseFee);
  const p = parseFloat(pct);
  if (isNaN(base) || isNaN(p)) return 0;
  return base * p / 100;
}

interface SnapshotInput {
  proposalFeeLineId: string;
  serviceCategory: string;
  discipline: string;
  feeType: string;
  baseFee: string | null;
  percentComplete: string;
  hoursWorked: string;
  ratePerHour: string;
}

interface HoursInput {
  id: string;
  date: string;
  description: string;
  hours: string;
  ratePerHour: string;
}

interface ExpenseInput {
  id: string;
  date: string;
  expenseType: string;
  billedDate: string;
  milesTraveled: string;
  ratePerMile: string;
  amount: string;
}

const MILEAGE_RATE = "0.67";

function buildSnapshotInputs(proposal: ProposalWithPhases): SnapshotInput[] {
  const inputs: SnapshotInput[] = [];
  for (const phase of proposal.phases) {
    for (const fl of phase.feeLines) {
      inputs.push({
        proposalFeeLineId: fl.id,
        serviceCategory: fl.serviceCategory,
        discipline: fl.discipline,
        feeType: fl.feeType,
        baseFee: fl.amount,
        percentComplete: "0",
        hoursWorked: "0",
        ratePerHour: "0",
      });
    }
  }
  return inputs;
}

function makeHoursRow(): HoursInput {
  return { id: crypto.randomUUID(), date: "", description: "", hours: "", ratePerHour: "" };
}

function makeExpenseRow(): ExpenseInput {
  return { id: crypto.randomUUID(), date: "", expenseType: "Parking", billedDate: "", milesTraveled: "", ratePerMile: MILEAGE_RATE, amount: "" };
}

interface Props {
  leadId: number;
  proposal: ProposalWithPhases;
  onBack: () => void;
  onCreated: (invoiceId: string) => void;
}

export function InvoiceBuilderPanel({ leadId, proposal, onBack, onCreated }: Props) {
  const { toast } = useToast();

  const [snapshots, setSnapshots] = useState<SnapshotInput[]>(() => buildSnapshotInputs(proposal));
  const [hoursRows, setHoursRows] = useState<HoursInput[]>([]);
  const [expenseRows, setExpenseRows] = useState<ExpenseInput[]>([]);
  const [notes, setNotes] = useState("");

  const updateSnapshot = (feeLineId: string, field: keyof SnapshotInput, value: string) => {
    setSnapshots((prev) =>
      prev.map((s) => (s.proposalFeeLineId === feeLineId ? { ...s, [field]: value } : s))
    );
  };

  const updateHours = (id: string, field: keyof HoursInput, value: string) => {
    setHoursRows((prev) => prev.map((h) => (h.id === id ? { ...h, [field]: value } : h)));
  };

  const updateExpense = (id: string, field: keyof ExpenseInput, value: string) => {
    setExpenseRows((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  // Totals
  const feeSubtotal = snapshots.reduce((sum, s) => {
    if (s.feeType === "Fixed") {
      return sum + Math.max(0, calcEarned(s.baseFee, s.percentComplete));
    } else {
      const h = parseFloat(s.hoursWorked) || 0;
      const r = parseFloat(s.ratePerHour) || 0;
      return sum + h * r;
    }
  }, 0);

  const hoursSubtotal = hoursRows.reduce((sum, h) => {
    return sum + (parseFloat(h.hours) || 0) * (parseFloat(h.ratePerHour) || 0);
  }, 0);

  const expenseSubtotal = expenseRows.reduce((sum, e) => {
    if (e.expenseType === "Mileage") {
      return sum + (parseFloat(e.milesTraveled) || 0) * (parseFloat(e.ratePerMile) || 0);
    }
    return sum + (parseFloat(e.amount) || 0);
  }, 0);

  const grandTotal = feeSubtotal + hoursSubtotal + expenseSubtotal;

  const createMutation = useMutation({
    mutationFn: async () => {
      const feeLineInputs = snapshots.map((s) => ({
        proposalFeeLineId: s.proposalFeeLineId,
        percentComplete: s.feeType === "Fixed" ? s.percentComplete : undefined,
        hoursWorked: s.feeType === "Hourly" ? s.hoursWorked : undefined,
        ratePerHour: s.feeType === "Hourly" ? s.ratePerHour : undefined,
      }));
      const hoursInputs = hoursRows
        .filter((h) => h.hours && h.ratePerHour)
        .map((h) => ({
          date: h.date || new Date().toISOString().slice(0, 10),
          description: h.description || "Hours",
          hours: h.hours,
          ratePerHour: h.ratePerHour,
        }));
      const expenseInputs = expenseRows
        .filter((e) => e.date)
        .map((e) => ({
          date: e.date,
          expenseType: e.expenseType,
          billedDate: e.billedDate || undefined,
          milesTraveled: e.expenseType === "Mileage" ? e.milesTraveled : undefined,
          ratePerMile: e.expenseType === "Mileage" ? e.ratePerMile : undefined,
          amount: e.expenseType !== "Mileage" ? e.amount : undefined,
        }));

      const res = await apiRequest("POST", `/api/leads/${leadId}/invoices`, {
        proposalId: proposal.id,
        feeLineInputs,
        hoursInputs,
        expenseInputs,
        notes: notes.trim() || undefined,
      });
      return res.json();
    },
    onSuccess: (data: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "invoices"] });
      toast({ title: "Invoice created" });
      onCreated(data.id);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create invoice", description: err.message, variant: "destructive" });
    },
  });

  // Group fee lines by phase
  const phaseGroups = proposal.phases.map((phase) => ({
    phase,
    snapshots: snapshots.filter((s) =>
      phase.feeLines.some((fl) => fl.id === s.proposalFeeLineId)
    ),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-from-builder">
          <ArrowLeft className="w-4 h-4" />
          Project
        </Button>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Invoice Total</p>
          <p className="text-xl font-semibold" data-testid="text-invoice-total">{fmt(grandTotal)}</p>
        </div>
      </div>

      <div className="rounded-md border bg-card p-4 space-y-1">
        <p className="text-sm font-medium">New Invoice</p>
        <p className="text-xs text-muted-foreground">Based on: <span className="font-medium">{proposal.name}</span></p>
      </div>

      {/* Fee breakdown */}
      <div className="rounded-md border bg-card">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Fee Lines</h3>
          <p className="text-xs text-muted-foreground">Enter percent complete for fixed-fee lines, or hours & rate for hourly lines</p>
        </div>
        <div className="divide-y">
          {phaseGroups.map(({ phase, snapshots: phaseSnaps }) => (
            <div key={phase.id}>
              <div className="px-4 py-2 bg-muted/20 flex items-center justify-between">
                <span className="text-sm font-medium">{phase.name}</span>
              </div>
              <div className="divide-y">
                {phaseSnaps.map((s) => {
                  const earned = s.feeType === "Fixed"
                    ? calcEarned(s.baseFee, s.percentComplete)
                    : (parseFloat(s.hoursWorked) || 0) * (parseFloat(s.ratePerHour) || 0);
                  return (
                    <div key={s.proposalFeeLineId} className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium">{s.discipline}</span>
                        <span className="text-xs text-muted-foreground">{s.serviceCategory}</span>
                        <Badge variant="secondary" className="text-xs ml-auto">{s.feeType}</Badge>
                        {s.feeType === "Fixed" && s.baseFee && (
                          <span className="text-xs text-muted-foreground">Base: {fmt(s.baseFee)}</span>
                        )}
                      </div>
                      {s.feeType === "Fixed" ? (
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs whitespace-nowrap">% Complete</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="5"
                              value={s.percentComplete}
                              onChange={(e) => updateSnapshot(s.proposalFeeLineId, "percentComplete", e.target.value)}
                              className="h-8 w-20 text-sm"
                              data-testid={`input-pct-${s.proposalFeeLineId}`}
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                          {earned > 0 && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span>Earned:</span>
                              <span className="font-medium text-foreground">{fmt(earned)}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs">Hours</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.5"
                              value={s.hoursWorked}
                              onChange={(e) => updateSnapshot(s.proposalFeeLineId, "hoursWorked", e.target.value)}
                              className="h-8 w-20 text-sm"
                              data-testid={`input-hours-${s.proposalFeeLineId}`}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs">Rate</Label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                              <Input
                                type="number"
                                min="0"
                                step="5"
                                value={s.ratePerHour}
                                onChange={(e) => updateSnapshot(s.proposalFeeLineId, "ratePerHour", e.target.value)}
                                className="h-8 w-24 pl-5 text-sm"
                                data-testid={`input-rate-${s.proposalFeeLineId}`}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">/hr</span>
                          </div>
                          {earned > 0 && (
                            <span className="text-xs font-medium">{fmt(earned)}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t flex justify-between items-center bg-muted/10">
          <span className="text-sm font-medium">Fee Subtotal</span>
          <span className="text-sm font-semibold">{fmt(feeSubtotal)}</span>
        </div>
      </div>

      {/* Hours entries */}
      <div className="rounded-md border bg-card">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Hours Entries</h3>
            <p className="text-xs text-muted-foreground">Optional additional time tracking</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHoursRows([...hoursRows, makeHoursRow()])}
            data-testid="button-add-hours"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Entry
          </Button>
        </div>
        {hoursRows.length === 0 ? (
          <p className="px-4 py-4 text-xs text-muted-foreground">No hours entries added.</p>
        ) : (
          <div className="divide-y">
            {hoursRows.map((h) => (
              <div key={h.id} className="grid grid-cols-[100px_1fr_80px_90px_36px] gap-2 items-start px-4 py-3">
                <div className="space-y-1">
                  <Label className="text-xs">Date</Label>
                  <Input
                    type="date"
                    value={h.date}
                    onChange={(e) => updateHours(h.id, "date", e.target.value)}
                    className="h-8 text-xs"
                    data-testid={`input-hours-date-${h.id}`}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={h.description}
                    onChange={(e) => updateHours(h.id, "description", e.target.value)}
                    placeholder="Task / project"
                    className="h-8 text-sm"
                    data-testid={`input-hours-desc-${h.id}`}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hours</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={h.hours}
                    onChange={(e) => updateHours(h.id, "hours", e.target.value)}
                    className="h-8 text-sm"
                    data-testid={`input-hours-hrs-${h.id}`}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Rate/hr</Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="5"
                      value={h.ratePerHour}
                      onChange={(e) => updateHours(h.id, "ratePerHour", e.target.value)}
                      className="h-8 pl-5 text-sm"
                      data-testid={`input-hours-rate-${h.id}`}
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="mt-5"
                  onClick={() => setHoursRows(hoursRows.filter((r) => r.id !== h.id))}
                  data-testid={`button-remove-hours-${h.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {hoursSubtotal > 0 && (
          <div className="px-4 py-3 border-t flex justify-between items-center bg-muted/10">
            <span className="text-sm font-medium">Hours Subtotal</span>
            <span className="text-sm font-semibold">{fmt(hoursSubtotal)}</span>
          </div>
        )}
      </div>

      {/* Expense entries */}
      <div className="rounded-md border bg-card">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Expense Entries</h3>
            <p className="text-xs text-muted-foreground">Mileage, parking, shipping, printing</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpenseRows([...expenseRows, makeExpenseRow()])}
            data-testid="button-add-expense"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Expense
          </Button>
        </div>
        {expenseRows.length === 0 ? (
          <p className="px-4 py-4 text-xs text-muted-foreground">No expenses added.</p>
        ) : (
          <div className="divide-y">
            {expenseRows.map((e) => {
              const isMileage = e.expenseType === "Mileage";
              const amount = isMileage
                ? (parseFloat(e.milesTraveled) || 0) * (parseFloat(e.ratePerMile) || 0)
                : parseFloat(e.amount) || 0;
              return (
                <div key={e.id} className="px-4 py-3 space-y-2">
                  <div className="grid grid-cols-[100px_130px_100px_1fr_36px] gap-2 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs">Date</Label>
                      <Input
                        type="date"
                        value={e.date}
                        onChange={(ev) => updateExpense(e.id, "date", ev.target.value)}
                        className="h-8 text-xs"
                        data-testid={`input-expense-date-${e.id}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Select value={e.expenseType} onValueChange={(v) => updateExpense(e.id, "expenseType", v)}>
                        <SelectTrigger className="h-8 text-sm" data-testid={`select-expense-type-${e.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EXPENSE_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Billed Date</Label>
                      <Input
                        type="date"
                        value={e.billedDate}
                        onChange={(ev) => updateExpense(e.id, "billedDate", ev.target.value)}
                        className="h-8 text-xs"
                        data-testid={`input-expense-billed-${e.id}`}
                      />
                    </div>
                    {isMileage ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Miles</Label>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={e.milesTraveled}
                            onChange={(ev) => updateExpense(e.id, "milesTraveled", ev.target.value)}
                            className="h-8 text-sm"
                            data-testid={`input-expense-miles-${e.id}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">$/Mile</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={e.ratePerMile}
                            onChange={(ev) => updateExpense(e.id, "ratePerMile", ev.target.value)}
                            className="h-8 text-sm"
                            data-testid={`input-expense-rate-${e.id}`}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Label className="text-xs">Amount</Label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={e.amount}
                            onChange={(ev) => updateExpense(e.id, "amount", ev.target.value)}
                            className="h-8 pl-5 text-sm"
                            data-testid={`input-expense-amount-${e.id}`}
                          />
                        </div>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setExpenseRows(expenseRows.filter((r) => r.id !== e.id))}
                      data-testid={`button-remove-expense-${e.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                  {amount > 0 && (
                    <p className="text-xs text-muted-foreground text-right">Amount: <span className="font-medium text-foreground">{fmt(amount)}</span></p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {expenseSubtotal > 0 && (
          <div className="px-4 py-3 border-t flex justify-between items-center bg-muted/10">
            <span className="text-sm font-medium">Expense Subtotal</span>
            <span className="text-sm font-semibold">{fmt(expenseSubtotal)}</span>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="rounded-md border bg-card p-4 space-y-2">
        <Label className="text-sm font-semibold">Notes (optional)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Internal notes for this invoice…"
          rows={2}
          data-testid="input-invoice-notes"
        />
      </div>

      {/* Summary + submit */}
      <div className="rounded-md border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Invoice Summary</h3>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fee Lines</span>
            <span>{fmt(feeSubtotal)}</span>
          </div>
          {hoursSubtotal > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hours</span>
              <span>{fmt(hoursSubtotal)}</span>
            </div>
          )}
          {expenseSubtotal > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expenses</span>
              <span>{fmt(expenseSubtotal)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{fmt(grandTotal)}</span>
          </div>
        </div>
        <Button
          className="w-full"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          data-testid="button-create-invoice"
        >
          {createMutation.isPending ? "Creating…" : "Create Invoice"}
        </Button>
      </div>
    </div>
  );
}
