import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Building2, ChevronDown, ChevronRight, BookUser, Plus, Trash2, ChevronsUpDown, Link2, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  LEAD_STATUSES,
  LEAD_PROBABILITIES,
  COMPANY_ROLE_SUGGESTIONS,
  type LeadProbability,
  type LeadStatus,
  type LeadWithCompanies,
  type ContactWithCompanies,
  type CompanyWithContacts,
} from "@shared/schema";
import { ContactFormDialog } from "@/components/contact-form-dialog";

const companySchema = z.object({
  companyRole: z.string().min(1, "Role is required"),
  companyId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  companyName: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
});

const formSchema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  squareFootage: z.string().optional(),
  probability: z.enum(LEAD_PROBABILITIES),
  potentialFee: z.string().optional(),
  status: z.enum(LEAD_STATUSES),
  companies: z.array(companySchema),
});

type FormValues = z.infer<typeof formSchema>;

function buildDefaultCompanies(existing?: LeadWithCompanies["companies"]): FormValues["companies"] {
  if (!existing || existing.length === 0) return [];
  return existing.map((c) => ({
    companyRole: c.companyRole,
    companyId: c.companyId || null,
    contactId: c.contactId || null,
    companyName: c.companyName || "",
    addressLine1: c.addressLine1 || "",
    addressLine2: c.addressLine2 || "",
    city: c.city || "",
    state: c.state || "",
    zip: c.zip || "",
  }));
}

function RoleSuggestionPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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

function CompanyAddressBookPicker({
  onSelect,
}: {
  onSelect: (company: CompanyWithContacts) => void;
}) {
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
  const filtered = addressBookCompanies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.city || "").toLowerCase().includes(search.toLowerCase())
  );
  const showCreate = trimmed.length > 0 &&
    !filtered.some((c) => c.name.toLowerCase() === trimmed.toLowerCase());

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
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

function ContactPicker({
  onSelect,
  linkedCompany,
}: {
  onSelect: (contact: ContactWithCompanies) => void;
  linkedCompany?: CompanyWithContacts | null;
}) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingSelectAfterCreate, setPendingSelectAfterCreate] = useState(false);

  const { data: allContacts = [] } = useQuery<ContactWithCompanies[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: addressBookCompanies = [] } = useQuery<CompanyWithContacts[]>({
    queryKey: ["/api/companies"],
  });

  // If a company is linked, find its up-to-date record for its contacts list
  const upToDateCompany = linkedCompany
    ? (addressBookCompanies.find((c) => c.id === linkedCompany.id) || linkedCompany)
    : null;

  const companyContactIds = new Set(upToDateCompany?.contacts.map((c) => c.id) || []);
  const companyContacts = allContacts.filter((c) => companyContactIds.has(c.id));
  const otherContacts = allContacts.filter((c) => !companyContactIds.has(c.id));

  // After creating a new contact the query will refresh; auto-open the picker so user can pick it
  function handleCreateOpenChange(v: boolean) {
    setCreateOpen(v);
    if (!v && pendingSelectAfterCreate) {
      setPendingSelectAfterCreate(false);
      // brief delay so query cache can populate before reopening
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
          {/* New Contact shortcut — always visible */}
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

function CompanyEntry({
  index,
  form,
  onRemove,
}: {
  index: number;
  form: ReturnType<typeof useForm<FormValues>>;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const companyName = form.watch(`companies.${index}.companyName`);
  const contactId = form.watch(`companies.${index}.contactId`);
  const role = form.watch(`companies.${index}.companyRole`);
  const linkedCompanyId = form.watch(`companies.${index}.companyId`);

  const { data: addressBookCompanies = [] } = useQuery<CompanyWithContacts[]>({
    queryKey: ["/api/companies"],
  });
  const { data: allContacts = [] } = useQuery<ContactWithCompanies[]>({
    queryKey: ["/api/contacts"],
  });

  const linkedCompany = linkedCompanyId
    ? (addressBookCompanies.find((c) => c.id === linkedCompanyId) || null)
    : null;
  const selectedContact = contactId
    ? (allContacts.find((c) => c.id === contactId) || null)
    : null;

  const hasData = !!(companyName || selectedContact);

  function applyCompany(company: CompanyWithContacts) {
    form.setValue(`companies.${index}.companyId`, company.id);
    form.setValue(`companies.${index}.companyName`, company.name);
    form.setValue(`companies.${index}.addressLine1`, company.addressLine1 || "");
    form.setValue(`companies.${index}.addressLine2`, company.addressLine2 || "");
    form.setValue(`companies.${index}.city`, company.city || "");
    form.setValue(`companies.${index}.state`, company.state || "");
    form.setValue(`companies.${index}.zip`, company.zip || "");
  }

  function clearCompanyLink() {
    form.setValue(`companies.${index}.companyId`, null);
  }

  function applyContact(contact: ContactWithCompanies) {
    form.setValue(`companies.${index}.contactId`, contact.id);
    if (contact.companyName && !form.getValues(`companies.${index}.companyName`)) {
      form.setValue(`companies.${index}.companyName`, contact.companyName);
    }
  }

  function clearContact() {
    form.setValue(`companies.${index}.contactId`, null);
  }

  return (
    <div className="rounded-md border" data-testid={`company-entry-${index}`}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-3 py-3 px-3 text-left hover-elevate rounded-md"
            data-testid={`button-toggle-company-${index}`}
          >
            <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{role || <span className="text-muted-foreground">New Company</span>}</span>
                {hasData && (
                  <Badge variant="secondary" className="text-xs">
                    {companyName || selectedContact?.fullName}
                  </Badge>
                )}
                {linkedCompanyId && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Link2 className="w-2.5 h-2.5" />
                    Linked
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {open ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 space-y-3 border-t">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name={`companies.${index}.companyRole`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role *</FormLabel>
                      <FormControl>
                        <RoleSuggestionPicker value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex-shrink-0 mt-5">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={onRemove}
                  data-testid={`button-remove-company-${index}`}
                  title="Remove company"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Company address-book link row */}
            <div className="flex items-center gap-2">
              <CompanyAddressBookPicker onSelect={applyCompany} />
              {linkedCompanyId && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={clearCompanyLink}
                  data-testid={`button-clear-company-link-${index}`}
                  title="Remove address book link"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Clear link
                </Button>
              )}
            </div>

            <FormField
              control={form.control}
              name={`companies.${index}.companyName`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid={`input-company-name-${index}`} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`companies.${index}.addressLine1`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 1</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid={`input-address1-${index}`} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`companies.${index}.addressLine2`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 2</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid={`input-address2-${index}`} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <FormField
                  control={form.control}
                  name={`companies.${index}.city`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid={`input-city-${index}`} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name={`companies.${index}.state`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid={`input-state-${index}`} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`companies.${index}.zip`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zip</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid={`input-zip-${index}`} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Contact — address book picker only */}
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">Contact</p>
              <div className="flex items-center gap-2">
                <ContactPicker onSelect={applyContact} linkedCompany={linkedCompany} />
                {contactId && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={clearContact}
                    data-testid={`button-clear-contact-${index}`}
                    title="Remove contact link"
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {selectedContact ? (
              <div className="rounded-md bg-muted/40 px-3 py-2 space-y-0.5" data-testid={`contact-preview-${index}`}>
                <p className="text-sm font-medium">{selectedContact.fullName}</p>
                {selectedContact.title && (
                  <p className="text-xs text-muted-foreground">{selectedContact.title}</p>
                )}
                {selectedContact.phone && (
                  <p className="text-xs text-muted-foreground">{selectedContact.phone}</p>
                )}
                {selectedContact.email && (
                  <p className="text-xs text-muted-foreground">{selectedContact.email}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No contact selected. Pick one from the address book.</p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: LeadWithCompanies | null;
}

export function LeadFormDialog({ open, onOpenChange, lead }: Props) {
  const { toast } = useToast();
  const isEditing = !!lead;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      projectName: lead?.projectName || "",
      description: lead?.description || "",
      squareFootage: lead?.squareFootage ? String(lead.squareFootage) : "",
      probability: (LEAD_PROBABILITIES.includes(lead?.probability as LeadProbability) ? lead!.probability as LeadProbability : "LOW"),
      potentialFee: lead?.potentialFee ? String(lead.potentialFee) : "",
      status: (LEAD_STATUSES.includes(lead?.status as LeadStatus) ? lead!.status as LeadStatus : "Lead"),
      companies: buildDefaultCompanies(lead?.companies),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "companies",
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const companiesPayload = values.companies.map((c) => ({
        companyRole: c.companyRole,
        companyId: c.companyId || null,
        contactId: c.contactId || null,
        companyName: c.companyName || null,
        addressLine1: c.addressLine1 || null,
        addressLine2: c.addressLine2 || null,
        city: c.city || null,
        state: c.state || null,
        zip: c.zip || null,
      }));

      const payload = {
        projectName: values.projectName,
        description: values.description || null,
        squareFootage: values.squareFootage || null,
        probability: values.probability,
        potentialFee: values.potentialFee || null,
        status: values.status,
        companies: companiesPayload,
      };

      if (isEditing) {
        return apiRequest("PATCH", `/api/leads/${lead!.id}`, payload);
      }
      return apiRequest("POST", "/api/leads", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      if (isEditing) {
        queryClient.invalidateQueries({ queryKey: ["/api/leads", lead!.id] });
      }
      toast({ title: isEditing ? "Project updated" : "Project created" });
      onOpenChange(false);
      if (!isEditing) form.reset();
    },
    onError: (err: Error) => {
      toast({
        title: isEditing ? "Failed to update project" : "Failed to create project",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: FormValues) => mutation.mutate(values);

  function addCompany() {
    append({
      companyRole: "",
      companyId: null,
      contactId: null,
      companyName: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      zip: "",
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle>{isEditing ? "Edit Project" : "New Project"}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="px-6 py-4 space-y-6">
              {/* Core lead fields */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Project Details
                </h3>
                <FormField
                  control={form.control}
                  name="projectName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. Office Renovation – Acme Corp" data-testid="input-project-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} placeholder="Brief description of the project..." data-testid="input-description" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="squareFootage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Square Footage</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="0" data-testid="input-square-footage" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="potentialFee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Potential Fee ($)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="0.00" data-testid="input-potential-fee" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="probability"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Probability</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-probability">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {LEAD_PROBABILITIES.map((p) => (
                              <SelectItem key={p} value={p} data-testid={`select-prob-${p}`}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {LEAD_STATUSES.map((s) => (
                              <SelectItem key={s} value={s} data-testid={`select-status-${s}`}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Companies section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Companies
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCompany}
                    data-testid="button-add-company"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Add Company
                  </Button>
                </div>

                {fields.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4 border rounded-md">
                    No companies added yet. Click "Add Company" to get started.
                  </p>
                )}

                {fields.map((field, index) => (
                  <CompanyEntry
                    key={field.id}
                    index={index}
                    form={form}
                    onRemove={() => remove(index)}
                  />
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2 pb-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { onOpenChange(false); if (!isEditing) form.reset(); }}
                  data-testid="button-cancel-lead"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-lead">
                  {mutation.isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Project"}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
