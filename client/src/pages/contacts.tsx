import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, Users, Mail, Phone, Building2, Plus, Pencil, Trash2, User, LinkIcon, ChevronRight, ChevronDown, Unlink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ContactFormDialog } from "@/components/contact-form-dialog";
import { CompanyFormDialog } from "@/components/company-form-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ContactWithCompanies, CompanyWithContacts, LeadWithCompanies } from "@shared/schema";

interface ProjectContactEntry {
  source: "project";
  contactFullName: string;
  contactTitle: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  companyName: string | null;
  companyRole: string;
  projectId: number;
  projectName: string;
}

interface StandaloneContactEntry {
  source: "standalone";
  contact: ContactWithCompanies;
}

type ContactEntry = ProjectContactEntry | StandaloneContactEntry;

function LinkCompanyPicker({ contactId, linkedCompanyIds }: { contactId: string; linkedCompanyIds: Set<string> }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();

  const { data: allCompanies = [] } = useQuery<CompanyWithContacts[]>({
    queryKey: ["/api/companies"],
    enabled: open,
  });

  const linkMutation = useMutation({
    mutationFn: async (companyId: string) =>
      apiRequest("POST", `/api/companies/${companyId}/contacts/${contactId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Company linked" });
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to link company", description: err.message, variant: "destructive" });
    },
  });

  const available = allCompanies.filter((c) => !linkedCompanyIds.has(c.id));

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" data-testid={`button-link-company-${contactId}`}>
            <LinkIcon className="w-3.5 h-3.5 mr-1.5" />
            Link Company
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search companies…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                {allCompanies.length === 0
                  ? "No companies in address book."
                  : available.length === 0
                  ? "All companies already linked."
                  : "No companies found."}
              </CommandEmpty>
              <CommandGroup>
                {available.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.name}
                    onSelect={() => { linkMutation.mutate(c.id); setSearch(""); }}
                    disabled={linkMutation.isPending}
                    data-testid={`item-link-company-${c.id}`}
                  >
                    <Building2 className="w-3.5 h-3.5 mr-2 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{c.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          {/* Rendered outside CommandList so it is never filtered by search */}
          <div className="border-t p-1">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-medium hover-elevate"
              onClick={() => { setOpen(false); setCreateOpen(true); }}
              data-testid={`button-create-company-${contactId}`}
            >
              <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              Create new company
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <CompanyFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

function StandaloneContactCard({
  c,
  index,
  onEdit,
  onDelete,
}: {
  c: ContactWithCompanies;
  index: number;
  onEdit: (c: ContactWithCompanies) => void;
  onDelete: (c: ContactWithCompanies) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  const unlinkMutation = useMutation({
    mutationFn: async (companyId: string) =>
      apiRequest("DELETE", `/api/companies/${companyId}/contacts/${c.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Company unlinked" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to unlink", description: err.message, variant: "destructive" });
    },
  });

  const linkedCompanyIds = new Set(c.companies.map((co) => co.id));

  return (
    <div className="rounded-md border bg-card" data-testid={`card-contact-${index}`}>
      <div className="p-4 flex items-start gap-4">
        <div className="flex-shrink-0 mt-0.5">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" data-testid={`text-contact-name-${index}`}>
              {c.fullName}
            </span>
            {c.title && (
              <span className="text-xs text-muted-foreground">{c.title}</span>
            )}
            {c.companies.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                <Building2 className="w-3 h-3 mr-1" />
                {c.companies.length} {c.companies.length === 1 ? "company" : "companies"}
              </Badge>
            )}
          </div>

          {c.companyName && (
            <p className="text-sm text-muted-foreground" data-testid={`text-contact-company-${index}`}>
              {c.companyName}
            </p>
          )}

          <div className="flex flex-wrap gap-4 pt-0.5">
            {c.email && (
              <a
                href={`mailto:${c.email}`}
                className="flex items-center gap-1.5 text-xs text-primary"
                data-testid={`link-contact-email-${index}`}
              >
                <Mail className="w-3.5 h-3.5" />
                {c.email}
              </a>
            )}
            {c.phone && (
              <a
                href={`tel:${c.phone}`}
                className="flex items-center gap-1.5 text-xs text-primary"
                data-testid={`link-contact-phone-${index}`}
              >
                <Phone className="w-3.5 h-3.5" />
                {c.phone}
              </a>
            )}
          </div>

          {c.notes && (
            <p className="text-xs text-muted-foreground line-clamp-2">{c.notes}</p>
          )}
        </div>

        <div className="flex-shrink-0 flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
            data-testid={`button-expand-contact-${index}`}
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onEdit(c)}
            data-testid={`button-edit-contact-${index}`}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(c)}
            data-testid={`button-delete-contact-${index}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Linked Companies</p>
            <LinkCompanyPicker contactId={c.id} linkedCompanyIds={linkedCompanyIds} />
          </div>
          {c.companies.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">No companies linked yet.</p>
          ) : (
            c.companies.map((co) => (
              <div key={co.id} className="flex items-center justify-between gap-2 py-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium truncate">{co.name}</span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => unlinkMutation.mutate(co.id)}
                  disabled={unlinkMutation.isPending}
                  data-testid={`button-unlink-company-${co.id}`}
                  title="Unlink company"
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

export default function ContactsPage() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactWithCompanies | null>(null);
  const [deletingContact, setDeletingContact] = useState<ContactWithCompanies | null>(null);
  const { toast } = useToast();

  const { data: standaloneContacts = [], isLoading: loadingContacts } = useQuery<ContactWithCompanies[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: leads = [], isLoading: loadingLeads } = useQuery<LeadWithCompanies[]>({
    queryKey: ["/api/leads"],
  });

  const isLoading = loadingContacts || loadingLeads;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/contacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Contact deleted" });
      setDeletingContact(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete contact", description: err.message, variant: "destructive" });
    },
  });

  // Build project-derived contacts (de-duped by email if they match a standalone contact)
  const standaloneEmails = new Set(
    standaloneContacts
      .map((c) => c.email?.toLowerCase())
      .filter(Boolean) as string[]
  );

  const projectEntries: ProjectContactEntry[] = [];
  const seenProjectKeys = new Set<string>();

  for (const lead of leads) {
    for (const company of lead.companies) {
      if (!company.contactFullName && !company.companyName) continue;

      const emailKey = company.contactEmail?.toLowerCase();
      if (emailKey && standaloneEmails.has(emailKey)) continue;

      const dedupeKey = emailKey
        ? emailKey
        : `${company.contactFullName || ""}::${company.companyName || ""}::${lead.id}`;

      if (seenProjectKeys.has(dedupeKey)) continue;
      seenProjectKeys.add(dedupeKey);

      projectEntries.push({
        source: "project",
        contactFullName: company.contactFullName || "",
        contactTitle: company.contactTitle,
        contactPhone: company.contactPhone,
        contactEmail: company.contactEmail,
        companyName: company.companyName,
        companyRole: company.companyRole,
        projectId: lead.id,
        projectName: lead.projectName,
      });
    }
  }

  const allEntries: ContactEntry[] = [
    ...standaloneContacts.map((c): StandaloneContactEntry => ({ source: "standalone", contact: c })),
    ...projectEntries,
  ];

  const q = search.toLowerCase();
  const filtered = allEntries.filter((entry) => {
    if (entry.source === "standalone") {
      const c = entry.contact;
      return (
        c.fullName.toLowerCase().includes(q) ||
        (c.companyName || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.title || "").toLowerCase().includes(q) ||
        c.companies.some((co) => co.name.toLowerCase().includes(q))
      );
    } else {
      return (
        entry.contactFullName.toLowerCase().includes(q) ||
        (entry.companyName || "").toLowerCase().includes(q) ||
        (entry.contactEmail || "").toLowerCase().includes(q) ||
        (entry.contactPhone || "").toLowerCase().includes(q) ||
        entry.projectName.toLowerCase().includes(q)
      );
    }
  });

  function openCreate() {
    setEditingContact(null);
    setFormOpen(true);
  }

  function openEdit(contact: ContactWithCompanies) {
    setEditingContact(contact);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-6 py-3 border-b flex items-center gap-3 flex-wrap flex-shrink-0 bg-background">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-contacts"
          />
        </div>
        <Button onClick={openCreate} data-testid="button-new-contact">
          <Plus className="w-4 h-4" />
          New Contact
        </Button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-md" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
            <Users className="w-12 h-12 mb-4 text-muted-foreground" data-testid="icon-empty-contacts" />
            <h3 className="text-sm font-medium mb-1" data-testid="text-no-contacts-title">
              {search ? "No matching contacts" : "No contacts yet"}
            </h3>
            <p className="text-xs text-muted-foreground mb-4" data-testid="text-no-contacts-description">
              {search
                ? "Try adjusting your search"
                : "Create standalone contacts or add company info to your projects"}
            </p>
            {!search && (
              <Button size="sm" onClick={openCreate} data-testid="button-new-contact-empty">
                <Plus className="w-4 h-4 mr-2" />
                New Contact
              </Button>
            )}
          </div>
        ) : (
          <div className="p-6 space-y-3">
            {filtered.map((entry, i) => {
              if (entry.source === "standalone") {
                return (
                  <StandaloneContactCard
                    key={`standalone-${entry.contact.id}`}
                    c={entry.contact}
                    index={i}
                    onEdit={openEdit}
                    onDelete={setDeletingContact}
                  />
                );
              } else {
                return (
                  <div
                    key={`project-${i}`}
                    className="rounded-md border bg-card p-4 flex items-start gap-4"
                    data-testid={`card-contact-${i}`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {entry.contactFullName && (
                          <span className="text-sm font-semibold" data-testid={`text-contact-name-${i}`}>
                            {entry.contactFullName}
                          </span>
                        )}
                        {entry.contactTitle && (
                          <span className="text-xs text-muted-foreground">{entry.contactTitle}</span>
                        )}
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-contact-role-${i}`}>
                          {entry.companyRole}
                        </Badge>
                      </div>

                      {entry.companyName && (
                        <p className="text-sm text-muted-foreground" data-testid={`text-contact-company-${i}`}>
                          {entry.companyName}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-4 pt-1">
                        {entry.contactEmail && (
                          <a
                            href={`mailto:${entry.contactEmail}`}
                            className="flex items-center gap-1.5 text-xs text-primary"
                            data-testid={`link-contact-email-${i}`}
                          >
                            <Mail className="w-3.5 h-3.5" />
                            {entry.contactEmail}
                          </a>
                        )}
                        {entry.contactPhone && (
                          <a
                            href={`tel:${entry.contactPhone}`}
                            className="flex items-center gap-1.5 text-xs text-primary"
                            data-testid={`link-contact-phone-${i}`}
                          >
                            <Phone className="w-3.5 h-3.5" />
                            {entry.contactPhone}
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs text-muted-foreground mb-1">Project</p>
                      <Link href={`/projects/${entry.projectId}`}>
                        <span
                          className="text-xs text-primary hover:underline cursor-pointer"
                          data-testid={`link-contact-project-${i}`}
                        >
                          {entry.projectName}
                        </span>
                      </Link>
                    </div>
                  </div>
                );
              }
            })}
          </div>
        )}
      </div>

      {/* Footer count */}
      {!isLoading && allEntries.length > 0 && (
        <div className="border-t px-6 py-2 flex-shrink-0 bg-background">
          <p className="text-xs text-muted-foreground" data-testid="text-contacts-count">
            {filtered.length} of {allEntries.length} contacts
            {standaloneContacts.length > 0 && (
              <span className="ml-2 text-muted-foreground/70">
                ({standaloneContacts.length} in address book)
              </span>
            )}
          </p>
        </div>
      )}

      <ContactFormDialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditingContact(null);
        }}
        contact={editingContact}
      />

      <AlertDialog open={!!deletingContact} onOpenChange={(v) => !v && setDeletingContact(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deletingContact?.fullName}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-contact">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingContact && deleteMutation.mutate(deletingContact.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-contact"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
