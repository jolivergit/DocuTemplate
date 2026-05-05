import { useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Building2, ChevronDown, ChevronRight, BookUser } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  LEAD_STATUSES,
  LEAD_PROBABILITIES,
  COMPANY_ROLES,
  COMPANY_ROLE_LABELS,
  type LeadProbability,
  type LeadStatus,
  type LeadWithCompanies,
  type CompanyRole,
  type Contact,
} from "@shared/schema";

const companySchema = z.object({
  companyRole: z.enum(COMPANY_ROLES),
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

function buildDefaultCompanies(existing?: LeadWithCompanies["companies"]) {
  return COMPANY_ROLES.map((role) => {
    const found = existing?.find((c) => c.companyRole === role);
    return {
      companyRole: role,
      companyName: found?.companyName || "",
      addressLine1: found?.addressLine1 || "",
      addressLine2: found?.addressLine2 || "",
      city: found?.city || "",
      state: found?.state || "",
      zip: found?.zip || "",
      contactFullName: found?.contactFullName || "",
      contactTitle: found?.contactTitle || "",
      contactPhone: found?.contactPhone || "",
      contactEmail: found?.contactEmail || "",
    };
  });
}

function ContactPicker({
  onSelect,
}: {
  onSelect: (contact: Contact) => void;
}) {
  const [open, setOpen] = useState(false);

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  if (contacts.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="button-pick-contact"
        >
          <BookUser className="w-3.5 h-3.5 mr-1.5" />
          Pick from contacts
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

function CompanyFields({
  index,
  role,
  form,
}: {
  index: number;
  role: CompanyRole;
  form: UseFormReturn<FormValues>;
}) {
  const [open, setOpen] = useState(false);
  const companyName = form.watch(`companies.${index}.companyName`);
  const contactName = form.watch(`companies.${index}.contactFullName`);
  const hasData = companyName || contactName;

  function applyContact(contact: Contact) {
    form.setValue(`companies.${index}.contactFullName`, contact.fullName);
    form.setValue(`companies.${index}.contactTitle`, contact.title || "");
    form.setValue(`companies.${index}.contactPhone`, contact.phone || "");
    form.setValue(`companies.${index}.contactEmail`, contact.email || "");
    if (contact.companyName && !form.getValues(`companies.${index}.companyName`)) {
      form.setValue(`companies.${index}.companyName`, contact.companyName);
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between py-3 px-1 text-left hover-elevate rounded-md"
          data-testid={`button-toggle-company-${role}`}
        >
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div>
              <span className="text-sm font-medium">{COMPANY_ROLE_LABELS[role]}</span>
              {hasData && (
                <p className="text-xs text-muted-foreground">{companyName || contactName}</p>
              )}
            </div>
          </div>
          {open ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-6 pr-1 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <FormField
                control={form.control}
                name={`companies.${index}.companyName`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid={`input-company-name-${role}`} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="col-span-2">
              <FormField
                control={form.control}
                name={`companies.${index}.addressLine1`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 1</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid={`input-address1-${role}`} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="col-span-2">
              <FormField
                control={form.control}
                name={`companies.${index}.addressLine2`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 2</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid={`input-address2-${role}`} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name={`companies.${index}.city`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid={`input-city-${role}`} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-2">
              <FormField
                control={form.control}
                name={`companies.${index}.state`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid={`input-state-${role}`} />
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
                      <Input {...field} data-testid={`input-zip-${role}`} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Primary Contact</p>
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
                    <Input {...field} data-testid={`input-contact-name-${role}`} />
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
                    <Input {...field} data-testid={`input-contact-title-${role}`} />
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
                    <Input {...field} type="tel" data-testid={`input-contact-phone-${role}`} />
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
                    <Input {...field} type="email" data-testid={`input-contact-email-${role}`} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
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

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const companies = values.companies
        .map((c) => ({
          ...c,
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
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Associated Companies
                </h3>
                <div className="space-y-1">
                  {COMPANY_ROLES.map((role, index) => (
                    <CompanyFields key={role} index={index} role={role} form={form} />
                  ))}
                </div>
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
