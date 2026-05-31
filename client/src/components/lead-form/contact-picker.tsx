import { useState } from "react";
import { BookUser, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
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
import { ContactFormDialog } from "@/components/contact-form-dialog";
import type { ContactWithCompanies, CompanyWithContacts } from "@shared/schema";

interface Props {
  onSelect: (contact: ContactWithCompanies) => void;
  linkedCompany?: CompanyWithContacts | null;
}

export function ContactPicker({ onSelect, linkedCompany }: Props) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingSelectAfterCreate, setPendingSelectAfterCreate] = useState(false);

  const { data: allContacts = [] } = useQuery<ContactWithCompanies[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: addressBookCompanies = [] } = useQuery<CompanyWithContacts[]>({
    queryKey: ["/api/companies"],
  });

  const upToDateCompany = linkedCompany
    ? addressBookCompanies.find((c) => c.id === linkedCompany.id) || linkedCompany
    : null;

  const companyContactIds = new Set(upToDateCompany?.contacts.map((c) => c.id) || []);
  const companyContacts = allContacts.filter((c) => companyContactIds.has(c.id));
  const otherContacts = allContacts.filter((c) => !companyContactIds.has(c.id));

  function handleCreateOpenChange(v: boolean) {
    setCreateOpen(v);
    if (!v && pendingSelectAfterCreate) {
      setPendingSelectAfterCreate(false);
      setTimeout(() => setOpen(true), 150);
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" data-testid="button-pick-contact">
            <BookUser className="w-3.5 h-3.5 mr-1.5" />
            Pick contact
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search contacts…" data-testid="input-contact-picker-search" />
            <CommandList>
              <CommandEmpty>No contacts found.</CommandEmpty>
              {companyContacts.length > 0 && (
                <CommandGroup heading={upToDateCompany?.name || "From company"}>
                  {companyContacts.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={`${c.fullName} ${c.email || ""}`}
                      onSelect={() => { onSelect(c); setOpen(false); }}
                      data-testid={`item-contact-${c.id}`}
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">{c.fullName}</span>
                        {c.title && <span className="text-xs text-muted-foreground truncate">{c.title}</span>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {otherContacts.length > 0 && (
                <CommandGroup heading={companyContacts.length > 0 ? "All contacts" : undefined}>
                  {otherContacts.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={`${c.fullName} ${c.companyName || ""} ${c.email || ""}`}
                      onSelect={() => { onSelect(c); setOpen(false); }}
                      data-testid={`item-contact-${c.id}`}
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">{c.fullName}</span>
                        {(c.companyName || c.title) && (
                          <span className="text-xs text-muted-foreground truncate">
                            {[c.title, c.companyName].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
          <div className="border-t p-1">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-medium hover-elevate"
              onClick={() => {
                setOpen(false);
                setPendingSelectAfterCreate(true);
                setCreateOpen(true);
              }}
              data-testid="button-new-contact-from-picker"
            >
              <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              New contact
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <ContactFormDialog
        open={createOpen}
        onOpenChange={handleCreateOpenChange}
        contact={null}
      />
    </>
  );
}
