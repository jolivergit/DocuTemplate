import { useState } from "react";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateOnly, parseDateOnly } from "@/lib/date-only";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function WorkDateField({ label, value, onChange, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const selected = parseDateOnly(value);
  const display = selected ? format(selected, "MMM d, yyyy") : value || "Choose date";

  return <Popover open={open && !disabled} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" disabled={disabled}
        aria-label={`${label}${value ? `: ${display}` : ""}`}
        className={`h-9 w-full min-w-0 justify-between bg-background px-3 text-left text-sm font-normal ${value ? "" : "text-muted-foreground"}`}>
        <span className="truncate">{display}</span>
        <CalendarDays className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-auto p-0" aria-label={`${label} calendar`}>
      <Calendar mode="single" selected={selected} defaultMonth={selected} disabled={disabled} initialFocus
        onSelect={date => {
          if (disabled) return;
          onChange(date ? formatDateOnly(date) : "");
          setOpen(false);
        }} />
      {value && <div className="border-t p-2">
        <Button type="button" variant="ghost" size="sm" className="w-full" disabled={disabled}
          aria-label={`Clear ${label.toLowerCase()}`} onClick={() => {
            if (disabled) return;
            onChange("");
            setOpen(false);
          }}>Clear date</Button>
      </div>}
    </PopoverContent>
  </Popover>;
}
