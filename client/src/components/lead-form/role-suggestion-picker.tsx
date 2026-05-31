import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { COMPANY_ROLE_SUGGESTIONS } from "@shared/schema";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function RoleSuggestionPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  const suggestions = COMPANY_ROLE_SUGGESTIONS.filter(
    (s) => s.toLowerCase().includes(inputValue.toLowerCase()) && s !== value
  );

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                onChange(e.target.value);
                if (!open) setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="e.g. Contract Holder"
              className="pr-8"
              data-testid="input-company-role"
            />
            <ChevronsUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
          <Command>
            <CommandList>
              {suggestions.length === 0 && inputValue ? (
                <CommandEmpty className="py-2 px-3 text-xs text-muted-foreground">
                  Press Enter or type a custom role
                </CommandEmpty>
              ) : (
                <CommandGroup heading="Suggestions">
                  {COMPANY_ROLE_SUGGESTIONS.map((s) => (
                    <CommandItem
                      key={s}
                      value={s}
                      onSelect={() => {
                        setInputValue(s);
                        onChange(s);
                        setOpen(false);
                      }}
                    >
                      {s}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
