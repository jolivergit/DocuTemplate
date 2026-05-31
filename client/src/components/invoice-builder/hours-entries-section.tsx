import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmt, type HoursInput } from "./types";

interface Props {
  hoursRows: HoursInput[];
  hoursSubtotal: number;
  onAdd: () => void;
  onUpdate: (id: string, field: keyof HoursInput, value: string) => void;
  onRemove: (id: string) => void;
}

export function HoursEntriesSection({ hoursRows, hoursSubtotal, onAdd, onUpdate, onRemove }: Props) {
  return (
    <div className="rounded-md border bg-card">
      <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Hours Entries</h3>
          <p className="text-xs text-muted-foreground">Optional additional time tracking</p>
        </div>
        <Button variant="outline" size="sm" onClick={onAdd} data-testid="button-add-hours">
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
                  onChange={(e) => onUpdate(h.id, "date", e.target.value)}
                  className="h-8 text-xs"
                  data-testid={`input-hours-date-${h.id}`}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input
                  value={h.description}
                  onChange={(e) => onUpdate(h.id, "description", e.target.value)}
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
                  onChange={(e) => onUpdate(h.id, "hours", e.target.value)}
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
                    onChange={(e) => onUpdate(h.id, "ratePerHour", e.target.value)}
                    className="h-8 pl-5 text-sm"
                    data-testid={`input-hours-rate-${h.id}`}
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="mt-5"
                onClick={() => onRemove(h.id)}
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
  );
}
