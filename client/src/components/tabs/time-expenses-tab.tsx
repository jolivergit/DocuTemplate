import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus,
  Edit,
  Trash2,
  Clock,
  Receipt,
  CalendarIcon,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency as formatCurrencyDecimal } from "@/lib/utils";
import type { HoursEntry, ExpenseEntry, Invoice } from "@shared/schema";
import { EXPENSE_TYPES } from "@shared/schema";

const MILEAGE_RATE_DEFAULT = "0.67";

function calcExpenseAmount(e: ExpenseEntry): number {
  if (e.expenseType === "Mileage") {
    return (parseFloat(e.milesTraveled || "0") || 0) * (parseFloat(e.ratePerMile || "0") || 0);
  }
  return parseFloat(e.amount || "0") || 0;
}

function DatePickerInput({
  value,
  onChange,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(value + "T12:00:00") : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex h-8 rounded-md border border-input overflow-hidden focus-within:ring-1 focus-within:ring-ring">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="YYYY-MM-DD"
          className="h-full flex-1 min-w-0 border-0 rounded-none shadow-none focus-visible:ring-0 text-xs"
          data-testid={testId}
        />
        <PopoverTrigger asChild>
          <button
            type="button"
            tabIndex={-1}
            className="h-full w-8 shrink-0 border-l flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(day) => {
            if (day) {
              const iso = [
                day.getFullYear(),
                String(day.getMonth() + 1).padStart(2, "0"),
                String(day.getDate()).padStart(2, "0"),
              ].join("-");
              onChange(iso);
            }
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export function TimeExpensesTab({ leadId }: { leadId: number }) {
  const { toast } = useToast();

  const { data: allHours = [], isLoading: hoursLoading } = useQuery<HoursEntry[]>({
    queryKey: ["/api/leads", leadId, "hours"],
    queryFn: async () => {
      const r = await fetch(`/api/leads/${leadId}/hours`);
      if (!r.ok) throw new Error("Failed to load hours");
      return r.json();
    },
  });

  const { data: allExpenses = [], isLoading: expensesLoading } = useQuery<ExpenseEntry[]>({
    queryKey: ["/api/leads", leadId, "expenses"],
    queryFn: async () => {
      const r = await fetch(`/api/leads/${leadId}/expenses`);
      if (!r.ok) throw new Error("Failed to load expenses");
      return r.json();
    },
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/leads", leadId, "invoices"],
    queryFn: async () => {
      const r = await fetch(`/api/leads/${leadId}/invoices`);
      if (!r.ok) throw new Error("Failed to load invoices");
      return r.json();
    },
  });

  const invoiceMap = new Map(invoices.map((inv) => [inv.id, inv.invoiceNumber]));

  // Hours form state (add)
  const [showHoursForm, setShowHoursForm] = useState(false);
  const [hDate, setHDate] = useState("");
  const [hDesc, setHDesc] = useState("");
  const [hHours, setHHours] = useState("");
  const [hRate, setHRate] = useState("");

  // Hours edit state
  const [editingHoursId, setEditingHoursId] = useState<string | null>(null);
  const [ehDate, setEhDate] = useState("");
  const [ehDesc, setEhDesc] = useState("");
  const [ehHours, setEhHours] = useState("");
  const [ehRate, setEhRate] = useState("");

  // Expense form state (add)
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [eDate, setEDate] = useState("");
  const [eType, setEType] = useState<string>("Parking");
  const [eMiles, setEMiles] = useState("");
  const [eRatePerMile, setERatePerMile] = useState(MILEAGE_RATE_DEFAULT);
  const [eAmount, setEAmount] = useState("");

  // Expense edit state
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [eeDate, setEeDate] = useState("");
  const [eeType, setEeType] = useState<string>("Parking");
  const [eeMiles, setEeMiles] = useState("");
  const [eeRatePerMile, setEeRatePerMile] = useState(MILEAGE_RATE_DEFAULT);
  const [eeAmount, setEeAmount] = useState("");

  function startEditHours(h: HoursEntry) {
    setEditingHoursId(h.id);
    setEhDate(h.date);
    setEhDesc(h.description);
    setEhHours(h.hours);
    setEhRate(h.ratePerHour);
  }

  function startEditExpense(e: ExpenseEntry) {
    setEditingExpenseId(e.id);
    setEeDate(e.date);
    setEeType(e.expenseType);
    setEeMiles(e.milesTraveled || "");
    setEeRatePerMile(e.ratePerMile || MILEAGE_RATE_DEFAULT);
    setEeAmount(e.amount || "");
  }

  const addHoursMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/leads/${leadId}/hours`, {
        date: hDate,
        description: hDesc,
        hours: hHours,
        ratePerHour: hRate,
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "hours"] });
      setShowHoursForm(false);
      setHDate(""); setHDesc(""); setHHours(""); setHRate("");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add hours", description: err.message, variant: "destructive" });
    },
  });

  const addExpenseMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string | undefined> = { date: eDate, expenseType: eType };
      if (eType === "Mileage") {
        body.milesTraveled = eMiles;
        body.ratePerMile = eRatePerMile;
      } else {
        body.amount = eAmount;
      }
      const r = await apiRequest("POST", `/api/leads/${leadId}/expenses`, body);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "expenses"] });
      setShowExpenseForm(false);
      setEDate(""); setEType("Parking"); setEMiles(""); setERatePerMile(MILEAGE_RATE_DEFAULT); setEAmount("");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add expense", description: err.message, variant: "destructive" });
    },
  });

  const updateHoursMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("PATCH", `/api/hours/${id}`, {
        date: ehDate,
        description: ehDesc,
        hours: ehHours,
        ratePerHour: ehRate,
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "hours"] });
      setEditingHoursId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update hours entry", description: err.message, variant: "destructive" });
    },
  });

  const deleteHoursMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hours/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "hours"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete entry", description: err.message, variant: "destructive" });
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      const body: Record<string, string | undefined> = { date: eeDate, expenseType: eeType };
      if (eeType === "Mileage") {
        body.milesTraveled = eeMiles;
        body.ratePerMile = eeRatePerMile;
      } else {
        body.amount = eeAmount;
      }
      const r = await apiRequest("PATCH", `/api/expenses/${id}`, body);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "expenses"] });
      setEditingExpenseId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update expense entry", description: err.message, variant: "destructive" });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "expenses"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete entry", description: err.message, variant: "destructive" });
    },
  });

  const hoursTotal = allHours.reduce((sum, h) => sum + (parseFloat(h.hours) || 0) * (parseFloat(h.ratePerHour) || 0), 0);
  const expensesTotal = allExpenses.reduce((sum, e) => sum + calcExpenseAmount(e), 0);

  return (
    <div className="space-y-4">
      {/* Hours */}
      <div className="rounded-md border bg-card">
        <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Hours</h3>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowHoursForm(true)} data-testid="button-add-hours-entry">
            <Plus className="w-3.5 h-3.5" />
            Add
          </Button>
        </div>

        {showHoursForm && (
          <div className="px-4 py-3 border-b bg-muted/20 space-y-3">
            <div className="grid grid-cols-[120px_1fr_80px_90px] gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <DatePickerInput value={hDate} onChange={setHDate} testId="input-te-hours-date" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input value={hDesc} onChange={(e) => setHDesc(e.target.value)} placeholder="Task description" className="h-8 text-sm" data-testid="input-te-hours-desc" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hours</Label>
                <Input type="number" min="0" step="0.5" value={hHours} onChange={(e) => setHHours(e.target.value)} className="h-8 text-sm" data-testid="input-te-hours-hrs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rate/hr</Label>
                <Input type="number" min="0" step="5" value={hRate} onChange={(e) => setHRate(e.target.value)} placeholder="0.00" className="h-8 text-sm" data-testid="input-te-hours-rate" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowHoursForm(false)}>Cancel</Button>
              <Button
                size="sm"
                onClick={() => addHoursMutation.mutate()}
                disabled={!hDate || !hDesc || !hHours || !hRate || addHoursMutation.isPending}
                data-testid="button-save-hours-entry"
              >
                {addHoursMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        )}

        {hoursLoading ? (
          <div className="p-4 space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
        ) : allHours.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted-foreground text-center">No hours entries yet.</p>
        ) : (
          <div className="divide-y">
            {allHours.map((h) => {
              const amount = (parseFloat(h.hours) || 0) * (parseFloat(h.ratePerHour) || 0);
              const invoiceNum = h.invoiceId ? invoiceMap.get(h.invoiceId) : null;
              const isEditing = editingHoursId === h.id;

              if (isEditing) {
                return (
                  <div key={h.id} className="px-4 py-3 bg-muted/10 space-y-2" data-testid={`row-hours-edit-${h.id}`}>
                    <div className="grid grid-cols-[120px_1fr_80px_90px] gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Date</Label>
                        <DatePickerInput value={ehDate} onChange={setEhDate} testId={`input-edit-hours-date-${h.id}`} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Input value={ehDesc} onChange={(e) => setEhDesc(e.target.value)} className="h-8 text-sm" data-testid={`input-edit-hours-desc-${h.id}`} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Hours</Label>
                        <Input type="number" min="0" step="0.5" value={ehHours} onChange={(e) => setEhHours(e.target.value)} className="h-8 text-sm" data-testid={`input-edit-hours-hrs-${h.id}`} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Rate/hr</Label>
                        <Input type="number" min="0" step="5" value={ehRate} onChange={(e) => setEhRate(e.target.value)} className="h-8 text-sm" data-testid={`input-edit-hours-rate-${h.id}`} />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => setEditingHoursId(null)}>Cancel</Button>
                      <Button
                        size="sm"
                        onClick={() => updateHoursMutation.mutate(h.id)}
                        disabled={!ehDate || !ehDesc || !ehHours || !ehRate || updateHoursMutation.isPending}
                        data-testid={`button-save-edit-hours-${h.id}`}
                      >
                        {updateHoursMutation.isPending ? "Saving…" : "Save"}
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={h.id} className="px-4 py-3 flex items-center justify-between gap-3 group" data-testid={`row-hours-${h.id}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{h.description}</p>
                        {invoiceNum != null ? (
                          <Badge variant="secondary" className="text-xs shrink-0">Invoice #{invoiceNum}</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs shrink-0 text-muted-foreground">Unattached</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{h.date} · {h.hours} hrs @ ${h.ratePerHour}/hr</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium">{formatCurrencyDecimal(amount)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startEditHours(h)}
                      data-testid={`button-edit-hours-${h.id}`}
                    >
                      <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteHoursMutation.mutate(h.id)}
                      disabled={deleteHoursMutation.isPending}
                      data-testid={`button-delete-hours-${h.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {allHours.length > 0 && (
          <div className="px-4 py-2.5 border-t flex justify-between items-center bg-muted/10">
            <span className="text-xs text-muted-foreground font-medium">Total</span>
            <span className="text-sm font-semibold">{formatCurrencyDecimal(hoursTotal)}</span>
          </div>
        )}
      </div>

      {/* Expenses */}
      <div className="rounded-md border bg-card">
        <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Expenses</h3>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowExpenseForm(true)} data-testid="button-add-expense-entry">
            <Plus className="w-3.5 h-3.5" />
            Add
          </Button>
        </div>

        {showExpenseForm && (
          <div className="px-4 py-3 border-b bg-muted/20 space-y-3">
            <div className="grid grid-cols-[120px_140px_1fr] gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <DatePickerInput value={eDate} onChange={setEDate} testId="input-te-expense-date" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={eType} onValueChange={setEType}>
                  <SelectTrigger className="h-8 text-sm" data-testid="select-te-expense-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {eType === "Mileage" ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Miles</Label>
                      <Input type="number" min="0" step="1" value={eMiles} onChange={(e) => setEMiles(e.target.value)} className="h-8 text-sm" data-testid="input-te-expense-miles" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">$/Mile</Label>
                      <Input type="number" min="0" step="0.01" value={eRatePerMile} onChange={(e) => setERatePerMile(e.target.value)} className="h-8 text-sm" data-testid="input-te-expense-rate" />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">Amount ($)</Label>
                  <Input type="number" min="0" step="0.01" value={eAmount} onChange={(e) => setEAmount(e.target.value)} placeholder="0.00" className="h-8 text-sm" data-testid="input-te-expense-amount" />
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowExpenseForm(false)}>Cancel</Button>
              <Button
                size="sm"
                onClick={() => addExpenseMutation.mutate()}
                disabled={!eDate || addExpenseMutation.isPending}
                data-testid="button-save-expense-entry"
              >
                {addExpenseMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        )}

        {expensesLoading ? (
          <div className="p-4 space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
        ) : allExpenses.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted-foreground text-center">No expense entries yet.</p>
        ) : (
          <div className="divide-y">
            {allExpenses.map((e) => {
              const amount = calcExpenseAmount(e);
              const invoiceNum = e.invoiceId ? invoiceMap.get(e.invoiceId) : null;
              const isEditing = editingExpenseId === e.id;
              const detail = e.expenseType === "Mileage"
                ? `${e.milesTraveled} mi @ $${e.ratePerMile}/mi`
                : formatCurrencyDecimal(parseFloat(e.amount || "0") || 0);

              if (isEditing) {
                return (
                  <div key={e.id} className="px-4 py-3 bg-muted/10 space-y-2" data-testid={`row-expense-edit-${e.id}`}>
                    <div className="grid grid-cols-[120px_140px_1fr] gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Date</Label>
                        <DatePickerInput value={eeDate} onChange={setEeDate} testId={`input-edit-expense-date-${e.id}`} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <Select value={eeType} onValueChange={setEeType}>
                          <SelectTrigger className="h-8 text-sm" data-testid={`select-edit-expense-type-${e.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EXPENSE_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {eeType === "Mileage" ? (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Miles</Label>
                            <Input type="number" min="0" step="1" value={eeMiles} onChange={(ev) => setEeMiles(ev.target.value)} className="h-8 text-sm" data-testid={`input-edit-expense-miles-${e.id}`} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">$/Mile</Label>
                            <Input type="number" min="0" step="0.01" value={eeRatePerMile} onChange={(ev) => setEeRatePerMile(ev.target.value)} className="h-8 text-sm" data-testid={`input-edit-expense-rate-${e.id}`} />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Label className="text-xs">Amount ($)</Label>
                          <Input type="number" min="0" step="0.01" value={eeAmount} onChange={(ev) => setEeAmount(ev.target.value)} className="h-8 text-sm" data-testid={`input-edit-expense-amount-${e.id}`} />
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => setEditingExpenseId(null)}>Cancel</Button>
                      <Button
                        size="sm"
                        onClick={() => updateExpenseMutation.mutate(e.id)}
                        disabled={!eeDate || updateExpenseMutation.isPending}
                        data-testid={`button-save-edit-expense-${e.id}`}
                      >
                        {updateExpenseMutation.isPending ? "Saving…" : "Save"}
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={e.id} className="px-4 py-3 flex items-center justify-between gap-3" data-testid={`row-expense-${e.id}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{e.expenseType}</p>
                      {invoiceNum != null ? (
                        <Badge variant="secondary" className="text-xs shrink-0">Invoice #{invoiceNum}</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs shrink-0 text-muted-foreground">Unattached</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{e.date} · {detail}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium">{formatCurrencyDecimal(amount)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startEditExpense(e)}
                      data-testid={`button-edit-expense-${e.id}`}
                    >
                      <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteExpenseMutation.mutate(e.id)}
                      disabled={deleteExpenseMutation.isPending}
                      data-testid={`button-delete-expense-${e.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {allExpenses.length > 0 && (
          <div className="px-4 py-2.5 border-t flex justify-between items-center bg-muted/10">
            <span className="text-xs text-muted-foreground font-medium">Total</span>
            <span className="text-sm font-semibold">{formatCurrencyDecimal(expensesTotal)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
