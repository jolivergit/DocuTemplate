import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, Users, Mail, Phone, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { LeadWithCompanies } from "@shared/schema";
import { COMPANY_ROLE_LABELS } from "@shared/schema";

interface ContactEntry {
  contactFullName: string | null;
  contactTitle: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  companyName: string | null;
  companyRole: string;
  projectId: number;
  projectName: string;
}

export default function ContactsPage() {
  const [search, setSearch] = useState("");

  const { data: leads = [], isLoading } = useQuery<LeadWithCompanies[]>({
    queryKey: ["/api/leads"],
  });

  const contacts: ContactEntry[] = [];
  const seen = new Set<string>();

  for (const lead of leads) {
    for (const company of lead.companies) {
      if (!company.contactFullName && !company.companyName) continue;

      const key = company.contactEmail
        ? company.contactEmail.toLowerCase()
        : `${company.contactFullName || ""}::${company.companyName || ""}::${lead.id}`;

      if (seen.has(key)) continue;
      seen.add(key);

      contacts.push({
        contactFullName: company.contactFullName,
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

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return (
      (c.contactFullName || "").toLowerCase().includes(q) ||
      (c.companyName || "").toLowerCase().includes(q) ||
      (c.contactEmail || "").toLowerCase().includes(q) ||
      (c.contactPhone || "").toLowerCase().includes(q) ||
      c.projectName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 flex-wrap flex-shrink-0 bg-background">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Contacts</h1>
          <p className="text-sm text-muted-foreground">Companies and contacts across all projects</p>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-3 border-b flex items-center gap-3 flex-shrink-0 bg-background">
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
            <p className="text-xs text-muted-foreground" data-testid="text-no-contacts-description">
              {search
                ? "Try adjusting your search"
                : "Add company and contact information to your projects to see them here"}
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-3">
            {filtered.map((contact, i) => (
              <div
                key={i}
                className="rounded-md border bg-card p-4 flex items-start gap-4"
                data-testid={`card-contact-${i}`}
              >
                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {contact.contactFullName && (
                      <span className="text-sm font-semibold" data-testid={`text-contact-name-${i}`}>
                        {contact.contactFullName}
                      </span>
                    )}
                    {contact.contactTitle && (
                      <span className="text-xs text-muted-foreground">{contact.contactTitle}</span>
                    )}
                    <Badge variant="secondary" className="text-xs" data-testid={`badge-contact-role-${i}`}>
                      {COMPANY_ROLE_LABELS[contact.companyRole as keyof typeof COMPANY_ROLE_LABELS] || contact.companyRole}
                    </Badge>
                  </div>

                  {contact.companyName && (
                    <p className="text-sm text-muted-foreground" data-testid={`text-contact-company-${i}`}>
                      {contact.companyName}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-4 pt-1">
                    {contact.contactEmail && (
                      <a
                        href={`mailto:${contact.contactEmail}`}
                        className="flex items-center gap-1.5 text-xs text-primary"
                        data-testid={`link-contact-email-${i}`}
                      >
                        <Mail className="w-3.5 h-3.5" />
                        {contact.contactEmail}
                      </a>
                    )}
                    {contact.contactPhone && (
                      <a
                        href={`tel:${contact.contactPhone}`}
                        className="flex items-center gap-1.5 text-xs text-primary"
                        data-testid={`link-contact-phone-${i}`}
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {contact.contactPhone}
                      </a>
                    )}
                  </div>
                </div>

                {/* Project link */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs text-muted-foreground mb-1">Project</p>
                  <Link href={`/projects/${contact.projectId}`}>
                    <span
                      className="text-xs text-primary hover:underline cursor-pointer"
                      data-testid={`link-contact-project-${i}`}
                    >
                      {contact.projectName}
                    </span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer count */}
      {!isLoading && contacts.length > 0 && (
        <div className="border-t px-6 py-2 flex-shrink-0 bg-background">
          <p className="text-xs text-muted-foreground" data-testid="text-contacts-count">
            {filtered.length} of {contacts.length} contacts
          </p>
        </div>
      )}
    </div>
  );
}
