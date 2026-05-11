import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
} from "@/components/ui/form";
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
import { User, Plus, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ContactFormDialog } from "@/components/contact-form-dialog";
import { useToast } from "@/hooks/use-toast";
import { insertCompanySchema, type CompanyWithContacts, type ContactWithCompanies } from "@shared/schema";
import { z } from "zod";

const formSchema = insertCompanySchema.extend({
  name: z.string().min(1, "Company name is required"),
});
type FormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  company?: CompanyWithContacts | null;
  onCreated?: (company: CompanyWithContacts) => void;
}

export function CompanyFormDialog({ open, onOpenChange, company, onCreated }: Props) {
  const { toast } = useToast();
  const isEditing = !!company;

  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(
    company?.contacts.map((c) => c.id) || []
  );
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [contactCreateOpen, setContactCreateOpen] = useState(false);

  const { data: allContacts = [] } = useQuery<ContactWithCompanies[]>({
    queryKey: ["/api/contacts"],
  });

  const selectedContacts = allContacts.filter((c) => selectedContactIds.includes(c.id));
  const availableContacts = allContacts.filter((c) => !selectedContactIds.includes(c.id));

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: company?.name || "",
      addressLine1: company?.addressLine1 || "",
      addressLine2: company?.addressLine2 || "",
      city: company?.city || "",
      state: company?.state || "",
      zip: company?.zip || "",
      phone: company?.phone || "",
      email: company?.email || "",
      website: company?.website || "",
      notes: company?.notes || "",
    },
  });

  useEffect(() => {
    form.reset({
      name: company?.name || "",
      addressLine1: company?.addressLine1 || "",
      addressLine2: company?.addressLine2 || "",
      city: company?.city || "",
      state: company?.state || "",
      zip: company?.zip || "",
      phone: company?.phone || "",
      email: company?.email || "",
      website: company?.website || "",
      notes: company?.notes || "",
    });
    setSelectedContactIds(company?.contacts.map((c) => c.id) || []);
  }, [company?.id]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        name: values.name,
        addressLine1: values.addressLine1 || null,
        addressLine2: values.addressLine2 || null,
        city: values.city || null,
        state: values.state || null,
        zip: values.zip || null,
        phone: values.phone || null,
        email: values.email || null,
        website: values.website || null,
        notes: values.notes || null,
        contactIds: selectedContactIds,
      };
      if (isEditing) {
        return apiRequest("PATCH", `/api/companies/${company!.id}`, payload);
      }
      return apiRequest("POST", "/api/companies", payload);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: isEditing ? "Company updated" : "Company created" });
      onOpenChange(false);
      if (!isEditing) {
        form.reset();
        setSelectedContactIds([]);
        onCreated?.(result as CompanyWithContacts);
      }
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save company", description: err.message, variant: "destructive" });
    },
  });

  const onSubmit = (values: FormValues) => mutation.mutate(values);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { form.reset(); setSelectedContactIds(company?.contacts.map((c) => c.id) || []); } }}>
      <DialogContent className="max-w-lg max-h-[calc(100vh-4rem)] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Company" : "New Company"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 min-h-0 space-y-4 px-1">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Acme Corp" data-testid="input-company-name" />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Address</p>
              <FormField
                control={form.control}
                name="addressLine1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 1</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} data-testid="input-address1" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="addressLine2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 2</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} data-testid="input-address2" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} data-testid="input-city" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} data-testid="input-state" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="zip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zip</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} data-testid="input-zip" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact Info</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} type="tel" data-testid="input-phone" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} type="email" data-testid="input-email" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="https://..." data-testid="input-website" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} rows={2} data-testid="input-notes" />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Linked Contacts */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Linked Contacts</p>
                <Popover open={contactPickerOpen} onOpenChange={setContactPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid="button-link-contact"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Link Contact
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-60 p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Search contacts…" />
                      <CommandList>
                        <CommandEmpty>
                          {allContacts.length === 0
                            ? "No contacts in your address book yet"
                            : availableContacts.length === 0
                            ? "All contacts already linked"
                            : "No contacts found"}
                        </CommandEmpty>
                        <CommandGroup>
                          {availableContacts.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={c.fullName}
                              onSelect={() => {
                                setSelectedContactIds((prev) => [...prev, c.id]);
                                setContactPickerOpen(false);
                              }}
                              data-testid={`item-contact-${c.id}`}
                            >
                              <User className="w-3.5 h-3.5 mr-2 text-muted-foreground flex-shrink-0" />
                              <span className="truncate">{c.fullName}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                    {/* Outside CommandList so it is never filtered by search */}
                    <div className="border-t p-1">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-medium hover-elevate"
                        onClick={() => { setContactPickerOpen(false); setContactCreateOpen(true); }}
                        data-testid="button-create-contact-inline"
                      >
                        <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                        Create new contact
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
                <ContactFormDialog
                  open={contactCreateOpen}
                  onOpenChange={setContactCreateOpen}
                  initialCompanyIds={company?.id ? [company.id] : []}
                  onCreated={(c) => setSelectedContactIds((prev) => [...prev, c.id])}
                />
              </div>

              {selectedContacts.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedContacts.map((c) => (
                    <Badge
                      key={c.id}
                      variant="secondary"
                      className="flex items-center gap-1 pr-1"
                      data-testid={`badge-linked-contact-${c.id}`}
                    >
                      <User className="w-3 h-3 flex-shrink-0" />
                      <span>{c.fullName}</span>
                      <button
                        type="button"
                        className="ml-0.5 rounded-sm opacity-70 hover:opacity-100"
                        onClick={() => setSelectedContactIds((prev) => prev.filter((id) => id !== c.id))}
                        data-testid={`button-unlink-contact-${c.id}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No contacts linked yet</p>
              )}
            </div>

          </div>
          <div className="flex justify-end gap-2 pt-4 border-t mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-company">
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-company">
              {mutation.isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Company"}
            </Button>
          </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
