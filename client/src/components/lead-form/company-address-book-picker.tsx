import { useState } from "react";
import { Link2, Plus } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CompanyWithContacts } from "@shared/schema";

interface Props {
  onSelect: (company: CompanyWithContacts) => void;
}

export function CompanyAddressBookPicker({ onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: addressBookCompanies = [] } = useQuery<CompanyWithContacts[]>({
    queryKey: ["/api/companies"],
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) =>
      apiRequest<CompanyWithContacts>("POST", "/api/companies", { name }),
    onSuccess: (company) => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      onSelect(company);
      setOpen(false);
      setSearch("");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create company", description: err.message, variant: "destructive" });
    },
  });

  const trimmed = search.trim();
  const filtered = addressBookCompanies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.city || "").toLowerCase().includes(search.toLowerCase())
  );
  const showCreate =
    trimmed.length > 0 &&
    !filtered.some((c) => c.name.toLowerCase() === trimmed.toLowerCase());

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" data-testid="button-pick-address-book-company">
          <Link2 className="w-3.5 h-3.5 mr-1.5" />
          Pick company
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or create company…"
            data-testid="input-company-picker-search"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {filtered.length === 0 && !showCreate && (
              <CommandEmpty>Type a name to create a new company.</CommandEmpty>
            )}
            {filtered.length > 0 && (
              <CommandGroup>
                {filtered.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => {
                      onSelect(c);
                      setOpen(false);
                      setSearch("");
                    }}
                    data-testid={`item-company-${c.id}`}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{c.name}</span>
                      {(c.city || c.state) && (
                        <span className="text-xs text-muted-foreground truncate">
                          {[c.city, c.state].filter(Boolean).join(", ")}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {showCreate && (
              <CommandGroup heading="Create new">
                <CommandItem
                  value={`__create__${trimmed}`}
                  onSelect={() => createMutation.mutate(trimmed)}
                  disabled={createMutation.isPending}
                  data-testid="item-create-company"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                  <span className="truncate">Create "{trimmed}"</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
