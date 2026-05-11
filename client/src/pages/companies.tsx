import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Search, Building2, Plus, Pencil, Trash2, Phone, Mail, Globe,
  MapPin, Users, ChevronDown, ChevronRight, Unlink, UserPlus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ContactFormDialog } from "@/components/contact-form-dialog";
import {
  insertCompanySchema,
  type CompanyWithContacts,
  type ContactWithCompanies,
} from "@shared/schema";

const formSchema = insertCompanySchema.extend({
  name: z.string().min(1, "Company name is required"),
});
type FormValues = z.infer<typeof formSchema>;

function CompanyFormDialog({
  open,
  onOpenChange,
  company,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  company?: CompanyWithContacts | null;
}) {
  const { toast } = useToast();
  const isEditing = !!company;

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
      };
      if (isEditing) {
        return apiRequest("PATCH", `/api/companies/${company!.id}`, payload);
      }
      return apiRequest("POST", "/api/companies", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: isEditing ? "Company updated" : "Company created" });
      onOpenChange(false);
      if (!isEditing) form.reset();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save company", description: err.message, variant: "destructive" });
    },
  });

  const onSubmit = (values: FormValues) => mutation.mutate(values);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) form.reset(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Company" : "New Company"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

            <div className="flex justify-end gap-2 pt-1">
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

function LinkContactPicker({
  companyId,
  linkedContactIds,
}: {
  companyId: string;
  linkedContactIds: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();

  const { data: allContacts = [] } = useQuery<ContactWithCompanies[]>({
    queryKey: ["/api/contacts"],
    enabled: open,
  });

  const linkMutation = useMutation({
    mutationFn: async (contactId: string) =>
      apiRequest("POST", `/api/companies/${companyId}/contacts/${contactId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Contact linked" });
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to link contact", description: err.message, variant: "destructive" });
    },
  });

  const available = allContacts.filter((c) => !linkedContactIds.has(c.id));

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" data-testid={`button-link-contact-${companyId}`}>
            <UserPlus className="w-3.5 h-3.5 mr-1.5" />
            Link Contact
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search contacts…" data-testid="input-link-contact-search" />
            <CommandList>
              <CommandEmpty>
                {allContacts.length === 0 ? "No contacts in address book." : "No unlinked contacts found."}
              </CommandEmpty>
              <CommandGroup>
                {available.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.fullName} ${c.email || ""} ${c.companyName || ""}`}
                    onSelect={() => linkMutation.mutate(c.id)}
                    disabled={linkMutation.isPending}
                    data-testid={`item-link-contact-${c.id}`}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{c.fullName}</span>
                      {(c.title || c.email) && (
                        <span className="text-xs text-muted-foreground truncate">
                          {[c.title, c.email].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup>
                <CommandItem
                  value="__create_new_contact__"
                  onSelect={() => { setOpen(false); setCreateOpen(true); }}
                  data-testid={`button-create-contact-${companyId}`}
                >
                  <Plus className="w-3.5 h-3.5 mr-2 flex-shrink-0" />
                  <span className="font-medium">Create new contact</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <ContactFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialCompanyIds={[companyId]}
      />
    </>
  );
}

function CompanyCard({
  company,
  onEdit,
  onDelete,
}: {
  company: CompanyWithContacts;
  onEdit: (c: CompanyWithContacts) => void;
  onDelete: (c: CompanyWithContacts) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  const unlinkMutation = useMutation({
    mutationFn: async ({ companyId, contactId }: { companyId: string; contactId: string }) =>
      apiRequest("DELETE", `/api/companies/${companyId}/contacts/${contactId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Contact unlinked" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to unlink contact", description: err.message, variant: "destructive" });
    },
  });

  const location = [company.city, company.state].filter(Boolean).join(", ");
  const linkedContactIds = new Set(company.contacts.map((c) => c.id));

  return (
    <div className="rounded-md border bg-card" data-testid={`card-company-${company.id}`}>
      <div className="p-4 flex items-start gap-4">
        <div className="flex-shrink-0 mt-0.5">
          <Building2 className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" data-testid={`text-company-name-${company.id}`}>
              {company.name}
            </span>
            {company.contacts.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                <Users className="w-3 h-3 mr-1" />
                {company.contacts.length} contact{company.contacts.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          {location && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              {location}
            </p>
          )}
          <div className="flex flex-wrap gap-3 pt-0.5">
            {company.phone && (
              <a href={`tel:${company.phone}`} className="flex items-center gap-1 text-xs text-primary" data-testid={`link-company-phone-${company.id}`}>
                <Phone className="w-3 h-3" />{company.phone}
              </a>
            )}
            {company.email && (
              <a href={`mailto:${company.email}`} className="flex items-center gap-1 text-xs text-primary" data-testid={`link-company-email-${company.id}`}>
                <Mail className="w-3 h-3" />{company.email}
              </a>
            )}
            {company.website && (
              <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary" data-testid={`link-company-website-${company.id}`}>
                <Globe className="w-3 h-3" />{company.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
            data-testid={`button-expand-company-${company.id}`}
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onEdit(company)} data-testid={`button-edit-company-${company.id}`}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onDelete(company)} data-testid={`button-delete-company-${company.id}`}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Linked Contacts</p>
            <LinkContactPicker companyId={company.id} linkedContactIds={linkedContactIds} />
          </div>
          {company.contacts.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">No contacts linked yet.</p>
          ) : (
            company.contacts.map((contact) => (
              <div key={contact.id} className="flex items-center justify-between gap-2 py-1">
                <div className="min-w-0">
                  <span className="text-sm font-medium">{contact.fullName}</span>
                  {(contact.title || contact.email) && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {[contact.title, contact.email].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => unlinkMutation.mutate({ companyId: company.id, contactId: contact.id })}
                  disabled={unlinkMutation.isPending}
                  data-testid={`button-unlink-contact-${contact.id}`}
                  title="Unlink contact"
                >
                  <Unlink className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function CompaniesPage() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyWithContacts | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<CompanyWithContacts | null>(null);
  const { toast } = useToast();

  const { data: allCompanies = [], isLoading } = useQuery<CompanyWithContacts[]>({
    queryKey: ["/api/companies"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/companies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Company deleted" });
      setDeletingCompany(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete company", description: err.message, variant: "destructive" });
    },
  });

  const q = search.toLowerCase();
  const filtered = allCompanies.filter((c) =>
    c.name.toLowerCase().includes(q) ||
    (c.city || "").toLowerCase().includes(q) ||
    (c.state || "").toLowerCase().includes(q) ||
    (c.email || "").toLowerCase().includes(q) ||
    (c.phone || "").toLowerCase().includes(q)
  );

  function openCreate() {
    setEditingCompany(null);
    setFormOpen(true);
  }

  function openEdit(company: CompanyWithContacts) {
    setEditingCompany(company);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 flex-wrap flex-shrink-0 bg-background">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Companies</h1>
          <p className="text-sm text-muted-foreground">Your company address book</p>
        </div>
        <Button onClick={openCreate} data-testid="button-new-company">
          <Plus className="w-4 h-4 mr-2" />
          New Company
        </Button>
      </div>

      <div className="px-6 py-3 border-b flex-shrink-0 bg-background">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search companies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-companies"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-md" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
            <Building2 className="w-12 h-12 mb-4 text-muted-foreground" />
            <h3 className="text-sm font-medium mb-1" data-testid="text-no-companies-title">
              {search ? "No matching companies" : "No companies yet"}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              {search ? "Try adjusting your search" : "Add companies to your address book"}
            </p>
            {!search && (
              <Button size="sm" onClick={openCreate} data-testid="button-new-company-empty">
                <Plus className="w-4 h-4 mr-2" />
                New Company
              </Button>
            )}
          </div>
        ) : (
          <div className="p-6 space-y-3">
            {filtered.map((company) => (
              <CompanyCard
                key={company.id}
                company={company}
                onEdit={openEdit}
                onDelete={setDeletingCompany}
              />
            ))}
          </div>
        )}
      </div>

      {!isLoading && allCompanies.length > 0 && (
        <div className="border-t px-6 py-2 flex-shrink-0 bg-background">
          <p className="text-xs text-muted-foreground" data-testid="text-companies-count">
            {filtered.length} of {allCompanies.length} companies
          </p>
        </div>
      )}

      <CompanyFormDialog
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditingCompany(null); }}
        company={editingCompany}
      />

      <AlertDialog open={!!deletingCompany} onOpenChange={(v) => !v && setDeletingCompany(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingCompany?.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-company">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCompany && deleteMutation.mutate(deletingCompany.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-company"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
