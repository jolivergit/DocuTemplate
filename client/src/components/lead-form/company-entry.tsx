import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronDown, ChevronRight, Link2, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RoleSuggestionPicker } from "./role-suggestion-picker";
import { CompanyAddressBookPicker } from "./company-address-book-picker";
import { ContactPicker } from "./contact-picker";
import type { FormValues } from "./types";
import type { CompanyWithContacts, ContactWithCompanies } from "@shared/schema";

interface Props {
  index: number;
  form: ReturnType<typeof useForm<FormValues>>;
  onRemove: () => void;
}

export function CompanyEntry({ index, form, onRemove }: Props) {
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
    ? addressBookCompanies.find((c) => c.id === linkedCompanyId) || null
    : null;
  const selectedContact = contactId
    ? allContacts.find((c) => c.id === contactId) || null
    : null;

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
                <span className="text-sm font-medium">
                  {role || <span className="text-muted-foreground">New Company</span>}
                </span>
                {companyName && (
                  <Badge variant="secondary" className="text-xs">{companyName}</Badge>
                )}
                {selectedContact && (
                  <Badge variant="outline" className="text-xs">
                    {selectedContact.fullName}
                    {selectedContact.title ? ` · ${selectedContact.title}` : ""}
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
              <p className="text-xs text-muted-foreground">
                No contact selected. Pick one from the address book.
              </p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
