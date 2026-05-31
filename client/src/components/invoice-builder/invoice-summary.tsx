import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fmt } from "./types";

interface Props {
  feeSubtotal: number;
  asSubtotal: number;
  hoursSubtotal: number;
  expenseSubtotal: number;
  attachedHoursSubtotal: number;
  attachedExpensesSubtotal: number;
  grandTotal: number;
  notes: string;
  onNotesChange: (value: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function InvoiceSummary({
  feeSubtotal,
  asSubtotal,
  hoursSubtotal,
  expenseSubtotal,
  attachedHoursSubtotal,
  attachedExpensesSubtotal,
  grandTotal,
  notes,
  onNotesChange,
  onSubmit,
  isPending,
}: Props) {
  return (
    <>
      <div className="rounded-md border bg-card p-4 space-y-2">
        <Label className="text-sm font-semibold">Notes (optional)</Label>
        <Textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Internal notes for this invoice…"
          rows={2}
          data-testid="input-invoice-notes"
        />
      </div>

      <div className="rounded-md border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Invoice Summary</h3>
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Fee Services</span>
            <span>{fmt(feeSubtotal)}</span>
          </div>
          {asSubtotal > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Additional Services</span>
              <span>{fmt(asSubtotal)}</span>
            </div>
          )}
          {hoursSubtotal > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Additional Hours</span>
              <span>{fmt(hoursSubtotal)}</span>
            </div>
          )}
          {attachedHoursSubtotal > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Attached Hours</span>
              <span>{fmt(attachedHoursSubtotal)}</span>
            </div>
          )}
          {expenseSubtotal > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Expenses</span>
              <span>{fmt(expenseSubtotal)}</span>
            </div>
          )}
          {attachedExpensesSubtotal > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Attached Expenses</span>
              <span>{fmt(attachedExpensesSubtotal)}</span>
            </div>
          )}
        </div>
        <div className="flex justify-between items-center pt-2 border-t font-semibold">
          <span>Invoice Total</span>
          <span data-testid="text-invoice-summary-total">{fmt(grandTotal)}</span>
        </div>
        <Button
          className="w-full"
          onClick={onSubmit}
          disabled={isPending}
          data-testid="button-create-invoice"
        >
          {isPending ? "Creating…" : "Create Invoice"}
        </Button>
      </div>
    </>
  );
}
