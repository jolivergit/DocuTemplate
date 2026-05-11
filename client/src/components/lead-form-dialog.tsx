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
import { Building2, ChevronDown, ChevronRight, BookUser, Plus, Trash2, ChevronsUpDown } from "lucide-react";
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
} from "@shared/schema";

const companySchema = z.object({
  companyRole: z.string().min(1, "Role is required"),
  companyName: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  contactFullName: z.string().optional(),
  contactTitle: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
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
    companyName: c.companyName || "",
    addressLine1: c.addressLine1 || "",
    addressLine2: c.addressLine2 || "",
    city: c.city || "",
    state: c.state || "",
    zip: c.zip || "",
    contactFullName: c.contactFullName || "",
    contactTitle: c.contactTitle || "",
    contactPhone: c.contactPhone || "",
    contactEmail: c.contactEmail || "",
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

function ContactPicker({ onSelect }: { onSelect: (contact: ContactWithCompanies) => void }) {
  const [open, setOpen] = useState(false);

  const { data: contacts = [] } = useQuery<ContactWithCompanies[]>({
    queryKey: ["/api/contacts"],
  });

  if (contacts.length === 0) return null;

  return (
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
            <CommandGroup>
              {contacts.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.fullName} ${c.companyName || ""} ${c.email || ""}`}
                  onSelect={() => {
                    onSelect(c);
                    setOpen(false);
                  }}
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
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
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
  const contactName = form.watch(`companies.${index}.contactFullName`);
  const role = form.watch(`companies.${index}.companyRole`);
  const hasData = !!(companyName || contactName);

  function applyContact(contact: ContactWithCompanies) {
    form.setValue(`companies.${index}.contactFullName`, contact.fullName);
    form.setValue(`companies.${index}.contactTitle`, contact.title || "");
    form.setValue(`companies.${index}.contactPhone`, contact.phone || "");
    form.setValue(`companies.${index}.contactEmail`, contact.email || "");
    if (contact.companyName && !form.getValues(`companies.${index}.companyName`)) {
      form.setValue(`companies.${index}.companyName`, contact.companyName);
    }
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
                    {companyName || contactName}
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

            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Contact</p>
              <ContactPicker onSelect={applyContact} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name={`companies.${index}.contactFullName`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid={`input-contact-name-${index}`} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`companies.${index}.contactTitle`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid={`input-contact-title-${index}`} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`companies.${index}.contactPhone`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} type="tel" data-testid={`input-contact-phone-${index}`} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`companies.${index}.contactEmail`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" data-testid={`input-contact-email-${index}`} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
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
      const companies = values.companies.map((c) => ({
        companyRole: c.companyRole,
        companyName: c.companyName || null,
        addressLine1: c.addressLine1 || null,
        addressLine2: c.addressLine2 || null,
        city: c.city || null,
        state: c.state || null,
        zip: c.zip || null,
        contactFullName: c.contactFullName || null,
        contactTitle: c.contactTitle || null,
        contactPhone: c.contactPhone || null,
        contactEmail: c.contactEmail || null,
      }));

      const payload = {
        projectName: values.projectName,
        description: values.description || null,
        squareFootage: values.squareFootage || null,
        probability: values.probability,
        potentialFee: values.potentialFee || null,
        status: values.status,
        companies,
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
      companyName: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      zip: "",
      contactFullName: "",
      contactTitle: "",
      contactPhone: "",
      contactEmail: "",
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

              <Separator />

              {/* Companies */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Associated Companies
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCompany}
                    data-testid="button-add-company"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add Company
                  </Button>
                </div>

                {fields.length === 0 ? (
                  <div className="rounded-md border border-dashed px-4 py-6 text-center">
                    <Building2 className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No companies added yet</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addCompany}
                      className="mt-3"
                      data-testid="button-add-first-company"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Company
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fields.map((field, index) => (
                      <CompanyEntry
                        key={field.id}
                        index={index}
                        form={form}
                        onRemove={() => remove(index)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-2 pt-2 pb-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  data-testid="button-cancel-form"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  data-testid="button-submit-lead"
                >
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
