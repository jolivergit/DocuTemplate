import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmt, type ExpenseInput } from "./types";
import { EXPENSE_TYPES } from "@shared/schema";

interface Props {
  expenseRows: ExpenseInput[];
  expenseSubtotal: number;
  onAdd: () => void;
  onUpdate: (id: string, field: keyof ExpenseInput, value: string) => void;
  onRemove: (id: string) => void;
}

export function ExpenseEntriesSection({ expenseRows, expenseSubtotal, onAdd, onUpdate, onRemove }: Props) {
  return (
    <div className="rounded-md border bg-card">
      <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Expense Entries</h3>
          <p className="text-xs text-muted-foreground">Mileage, parking, shipping, printing</p>
        </div>
        <Button variant="outline" size="sm" onClick={onAdd} data-testid="button-add-expense">
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
                      onChange={(ev) => onUpdate(e.id, "date", ev.target.value)}
                      className="h-8 text-xs"
                      data-testid={`input-expense-date-${e.id}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select value={e.expenseType} onValueChange={(v) => onUpdate(e.id, "expenseType", v)}>
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
                      onChange={(ev) => onUpdate(e.id, "billedDate", ev.target.value)}
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
                          onChange={(ev) => onUpdate(e.id, "milesTraveled", ev.target.value)}
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
                          onChange={(ev) => onUpdate(e.id, "ratePerMile", ev.target.value)}
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
                          onChange={(ev) => onUpdate(e.id, "amount", ev.target.value)}
                          className="h-8 pl-5 text-sm"
                          data-testid={`input-expense-amount-${e.id}`}
                        />
                      </div>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(e.id)}
                    data-testid={`button-remove-expense-${e.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
                {amount > 0 && (
                  <p className="text-xs text-muted-foreground text-right">
                    Amount: <span className="font-medium text-foreground">{fmt(amount)}</span>
                  </p>
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
  );
}
