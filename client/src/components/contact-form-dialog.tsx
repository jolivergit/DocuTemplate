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
  FormMessage,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, Plus, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertContactSchema, type ContactWithCompanies, type CompanyWithContacts } from "@shared/schema";
import { z } from "zod";

const formSchema = insertContactSchema.extend({
  fullName: z.string().min(1, "Name is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: ContactWithCompanies | null;
  initialCompanyIds?: string[];
}

export function ContactFormDialog({ open, onOpenChange, contact, initialCompanyIds }: Props) {
  const { toast } = useToast();
  const isEditing = !!contact;
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>(
    contact?.companies.map((c) => c.id) || initialCompanyIds || []
  );
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);

  const { data: allCompanies = [] } = useQuery<CompanyWithContacts[]>({
    queryKey: ["/api/companies"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: contact?.fullName || "",
      title: contact?.title || "",
      phone: contact?.phone || "",
      email: contact?.email || "",
      companyName: "",
      notes: contact?.notes || "",
    },
  });

  useEffect(() => {
    form.reset({
      fullName: contact?.fullName || "",
      title: contact?.title || "",
      phone: contact?.phone || "",
      email: contact?.email || "",
      companyName: "",
      notes: contact?.notes || "",
    });
    setSelectedCompanyIds(contact?.companies.map((c) => c.id) || initialCompanyIds || []);
  }, [contact?.id]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        fullName: values.fullName,
        title: values.title || null,
        phone: values.phone || null,
        email: values.email || null,
        companyName: null,
        notes: values.notes || null,
        companyIds: selectedCompanyIds,
      };
      if (isEditing) {
        return apiRequest("PATCH", `/api/contacts/${contact!.id}`, payload);
      }
      return apiRequest("POST", "/api/contacts", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: isEditing ? "Contact updated" : "Contact created" });
      onOpenChange(false);
      if (!isEditing) {
        form.reset();
        setSelectedCompanyIds([]);
      }
    },
    onError: (err: Error) => {
      toast({
        title: isEditing ? "Failed to update contact" : "Failed to create contact",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: FormValues) => mutation.mutate(values);

  // Re-apply initial state whenever the dialog opens in create mode
  useEffect(() => {
    if (open && !isEditing) {
      setSelectedCompanyIds(initialCompanyIds || []);
    }
  }, [open]);

  function handleOpen(v: boolean) {
    onOpenChange(v);
    if (!v) {
      // Restore to contact's companies when editing, or initialCompanyIds when creating
      setSelectedCompanyIds(contact?.companies.map((c) => c.id) || initialCompanyIds || []);
    }
  }

  const selectedCompanies = allCompanies.filter((c) => selectedCompanyIds.includes(c.id));
  const availableCompanies = allCompanies.filter((c) => !selectedCompanyIds.includes(c.id));

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md flex flex-col p-0 max-h-[90vh]">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle>{isEditing ? "Edit Contact" : "New Contact"}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <Form {...form}>
            <form id="contact-form" onSubmit={form.handleSubmit(onSubmit)} className="px-6 py-4 space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Jane Smith" data-testid="input-contact-full-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="Project Manager" data-testid="input-contact-title" />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} type="tel" placeholder="(555) 123-4567" data-testid="input-contact-phone" />
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
                        <Input {...field} value={field.value ?? ""} type="email" placeholder="jane@acme.com" data-testid="input-contact-email" />
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
                      <Textarea
                        {...field}
                        value={field.value ?? ""}
                        rows={2}
                        placeholder="Any additional notes..."
                        data-testid="input-contact-notes"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Linked Companies */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Linked Companies</p>
                  <Popover open={companyPickerOpen} onOpenChange={setCompanyPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid="button-link-company"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Link Company
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-60 p-0" align="end">
                      <Command>
                        <CommandInput placeholder="Search companies…" />
                        <CommandList>
                          <CommandEmpty>
                            {allCompanies.length === 0
                              ? "No companies in your address book yet"
                              : availableCompanies.length === 0
                              ? "All companies already linked"
                              : "No companies found"}
                          </CommandEmpty>
                          <CommandGroup>
                            {availableCompanies.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={c.name}
                                onSelect={() => {
                                  setSelectedCompanyIds((prev) => [...prev, c.id]);
                                  setCompanyPickerOpen(false);
                                }}
                                data-testid={`item-company-${c.id}`}
                              >
                                <Building2 className="w-3.5 h-3.5 mr-2 text-muted-foreground flex-shrink-0" />
                                <span className="truncate">{c.name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {selectedCompanies.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCompanies.map((c) => (
                      <Badge
                        key={c.id}
                        variant="secondary"
                        className="flex items-center gap-1 pr-1"
                        data-testid={`badge-linked-company-${c.id}`}
                      >
                        <Building2 className="w-3 h-3 flex-shrink-0" />
                        <span>{c.name}</span>
                        <button
                          type="button"
                          className="ml-0.5 rounded-sm opacity-70 hover:opacity-100"
                          onClick={() => setSelectedCompanyIds((prev) => prev.filter((id) => id !== c.id))}
                          data-testid={`button-unlink-company-${c.id}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No companies linked yet</p>
                )}
              </div>
            </form>
          </Form>
        </ScrollArea>

        {/* Sticky footer — always visible outside the scroll area */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpen(false)}
            data-testid="button-cancel-contact"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="contact-form"
            disabled={mutation.isPending}
            data-testid="button-submit-contact"
          >
            {mutation.isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Contact"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
