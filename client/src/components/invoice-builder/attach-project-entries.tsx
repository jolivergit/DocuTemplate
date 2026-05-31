import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { fmt } from "./types";
import type { HoursEntry, ExpenseEntry } from "@shared/schema";

interface Props {
  unattachedHours: HoursEntry[];
  unattachedExpenses: ExpenseEntry[];
  selectedHoursIds: Set<string>;
  selectedExpenseIds: Set<string>;
  attachedHoursSubtotal: number;
  attachedExpensesSubtotal: number;
  onToggleHours: (id: string, checked: boolean) => void;
  onToggleExpense: (id: string, checked: boolean) => void;
}

export function AttachProjectEntries({
  unattachedHours,
  unattachedExpenses,
  selectedHoursIds,
  selectedExpenseIds,
  attachedHoursSubtotal,
  attachedExpensesSubtotal,
  onToggleHours,
  onToggleExpense,
}: Props) {
  const [open, setOpen] = useState(false);
  const totalUnattached = unattachedHours.length + unattachedExpenses.length;
  const totalSelected = selectedHoursIds.size + selectedExpenseIds.size;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-md border bg-card">
        <CollapsibleTrigger asChild>
          <button className="w-full px-4 py-3 flex items-center justify-between text-left hover-elevate rounded-md">
            <div>
              <p className="text-sm font-semibold">Attach Project Entries</p>
              <p className="text-xs text-muted-foreground">
                {totalUnattached === 0
                  ? "No unattached project entries"
                  : `${totalSelected} of ${totalUnattached} unattached entries selected`}
              </p>
            </div>
            {open ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t divide-y">
            {totalUnattached === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground text-center">No unattached project entries.</p>
            ) : (
              <>
                {unattachedHours.length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-muted/20">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hours</p>
                    </div>
                    {unattachedHours.map((h) => {
                      const amount = (parseFloat(h.hours) || 0) * (parseFloat(h.ratePerHour) || 0);
                      return (
                        <label
                          key={h.id}
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover-elevate"
                          data-testid={`attach-hours-${h.id}`}
                        >
                          <Checkbox
                            checked={selectedHoursIds.has(h.id)}
                            onCheckedChange={(val) => onToggleHours(h.id, !!val)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{h.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {h.date} · {h.hours} hrs @ ${h.ratePerHour}/hr
                            </p>
                          </div>
                          <span className="text-sm font-medium shrink-0">{fmt(amount)}</span>
                        </label>
                      );
                    })}
                  </>
                )}
                {unattachedExpenses.length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-muted/20">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expenses</p>
                    </div>
                    {unattachedExpenses.map((e) => {
                      const amount =
                        e.expenseType === "Mileage"
                          ? (parseFloat(e.milesTraveled || "0") || 0) * (parseFloat(e.ratePerMile || "0") || 0)
                          : parseFloat(e.amount || "0") || 0;
                      return (
                        <label
                          key={e.id}
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover-elevate"
                          data-testid={`attach-expense-${e.id}`}
                        >
                          <Checkbox
                            checked={selectedExpenseIds.has(e.id)}
                            onCheckedChange={(val) => onToggleExpense(e.id, !!val)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{e.expenseType}</p>
                            <p className="text-xs text-muted-foreground">
                              {e.date}
                              {e.expenseType === "Mileage"
                                ? ` · ${e.milesTraveled} mi @ $${e.ratePerMile}/mi`
                                : ""}
                            </p>
                          </div>
                          <span className="text-sm font-medium shrink-0">{fmt(amount)}</span>
                        </label>
                      );
                    })}
                  </>
                )}
                {attachedHoursSubtotal + attachedExpensesSubtotal > 0 && (
                  <div className="px-4 py-2.5 bg-muted/10 flex justify-between items-center">
                    <span className="text-sm font-medium">Selected Subtotal</span>
                    <span className="text-sm font-semibold">
                      {fmt(attachedHoursSubtotal + attachedExpensesSubtotal)}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
