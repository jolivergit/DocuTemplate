import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Mail, Plus, Phone } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COMPANY_ROLE_SUGGESTIONS } from "@shared/schema";
import type { LeadCompanyWithLinked, LeadWithCompanies } from "@shared/schema";
import type { ProjectSetupOptions } from "@shared/project-setup";
import { CompanyEntryCard } from "./company-entry-card";

type Entry = {
  clientKey: string;
  companyRole: string; companyId: string | null; contactId: string | null; companyName: string;
  addressLine1: string; addressLine2: string; city: string; state: string; zip: string;
};
const fromEntry = (entry: LeadCompanyWithLinked): Entry => ({
  clientKey: `saved:${entry.id}`,
  companyRole: entry.companyRole, companyId: entry.companyId, contactId: entry.contactId,
  companyName: entry.companyName ?? "", addressLine1: entry.addressLine1 ?? "", addressLine2: entry.addressLine2 ?? "",
  city: entry.city ?? "", state: entry.state ?? "", zip: entry.zip ?? "",
});
const blank = (clientKey: string): Entry => ({ clientKey, companyRole: "", companyId: null, contactId: null, companyName: "", addressLine1: "", addressLine2: "", city: "", state: "", zip: "" });
const field = "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm";
const CUSTOM_ROLE = "__custom_role__";

export function CompaniesEditor({ leadId, entries, options, version, disabled = false, onDirtyChange, onStatusChange }: { leadId: number; entries: LeadCompanyWithLinked[]; options: ProjectSetupOptions; version: number; disabled?: boolean; onDirtyChange?: (dirty: boolean) => void; onStatusChange?: (status: { dirty: boolean; saving: boolean; error: boolean; reloading: boolean }) => void }) {
  const newKeyCounter = useRef(0);
  const [draft, setDraft] = useState(() => entries.map(fromEntry));
  const [baseline, setBaseline] = useState(() => entries.map(fromEntry));
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const [customRoleKeys, setCustomRoleKeys] = useState<Set<string>>(() => new Set());
  const [baseVersion, setBaseVersion] = useState(version);
  const [reloading, setReloading] = useState(false);
  const [reloadError, setReloadError] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const dirtyCallback = useRef(onDirtyChange);
  dirtyCallback.current = onDirtyChange;
  const statusCallback = useRef(onStatusChange);
  statusCallback.current = onStatusChange;
  useEffect(() => { dirtyCallback.current?.(dirty); }, [dirty]);
  const save = useMutation({
    mutationFn: (payload: { version: number; entries: Entry[] }) => apiRequest<LeadWithCompanies>("PATCH", `/api/leads/${leadId}/setup`, {
      version: payload.version, companies: payload.entries.map(entry => ({
        companyRole: entry.companyRole,
        companyId: entry.companyId,
        contactId: entry.contactId,
        companyName: entry.companyName.trim() || null,
        addressLine1: entry.addressLine1.trim() || null,
        addressLine2: entry.addressLine2.trim() || null,
        city: entry.city.trim() || null,
        state: entry.state.trim() || null,
        zip: entry.zip.trim() || null,
      })),
    }),
    onSuccess: result => {
      queryClient.setQueryData(["/api/leads", leadId], result);
      const next = result.companies.map(fromEntry);
      setDraft(next);
      setBaseline(next);
      setExpandedKeys(new Set());
      setCustomRoleKeys(new Set());
      setBaseVersion(result.setupVersion);
      setReloadError("");
    },
  });
  useEffect(() => {
    if (dirtyRef.current || save.isPending || reloading) return;
    const latest = entries.map(fromEntry);
    setDraft(latest);
    setBaseline(latest);
    setBaseVersion(version);
  }, [entries, version, dirty, save.isPending, reloading]);
  const set = (clientKey: string, value: Partial<Entry>) => setDraft(current => current.map(item => item.clientKey === clientKey ? { ...item, ...value } : item));
  const cancel = () => {
    if (dirty && !window.confirm("Discard unsaved company entries?")) return;
    setDraft(baseline);
    setCustomRoleKeys(new Set());
  };
  const reloadLatest = async () => {
    setReloading(true);
    setReloadError("");
    try {
      await queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
      const latest = await queryClient.fetchQuery<LeadWithCompanies>({ queryKey: ["/api/leads", leadId], staleTime: 0 });
      const next = latest.companies.map(fromEntry);
      setDraft(next);
      setBaseline(next);
      setExpandedKeys(new Set());
      setCustomRoleKeys(new Set());
      setBaseVersion(latest.setupVersion);
      setReloadError("");
      save.reset();
    } catch (error) {
      setReloadError(error instanceof Error ? error.message : "Could not load the latest company entries. Your draft is preserved.");
    } finally {
      setReloading(false);
    }
  };
  const isConflict = (save.error as { status?: number } | null)?.status === 409;
  const locked = disabled || save.isPending || reloading;
  const hasError = !!save.error || !!reloadError;
  useEffect(() => {
    statusCallback.current?.({ dirty, saving: save.isPending, error: hasError, reloading });
  }, [dirty, save.isPending, hasError, reloading]);

  return <div>
    <fieldset disabled={locked} className="m-0 min-w-0 border-0 p-0">
    <Button variant="outline" size="sm" className="mb-3" onClick={() => {
      const clientKey = `new:${++newKeyCounter.current}`;
      setDraft(current => [...current, blank(clientKey)]);
      setExpandedKeys(current => new Set(current).add(clientKey));
    }}><Plus className="mr-1.5 h-4 w-4" />Add company entry</Button>
    {draft.length === 0 ? <div className="rounded-lg border border-dashed px-4 py-6 text-center"><p className="text-sm font-medium">No companies attached yet</p><p className="mt-1 text-xs text-muted-foreground">Add a client, consultant, vendor, or any other project participant.</p></div> :
      <div className="space-y-2">{draft.map(entry => {
        const key = entry.clientKey;
        const linkedContact = options.contacts.find(contact => contact.id === entry.contactId);
        const existingCustomRoles = Array.from(new Set([...baseline, ...draft].map(item => item.companyRole).filter(role => role && !COMPANY_ROLE_SUGGESTIONS.includes(role))));
        const customMode = customRoleKeys.has(key);
        const roleOptions = Array.from(new Set([...COMPANY_ROLE_SUGGESTIONS, ...existingCustomRoles]));
        const panelId = `company-entry-panel-${leadId}-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
        return <CompanyEntryCard
          key={key}
          panelId={panelId}
          companyName={entry.companyName}
          companyRole={entry.companyRole}
          linked={!!entry.companyId}
          contactSummary={linkedContact?.fullName}
          expanded={expandedKeys.has(key)}
          onToggle={() => setExpandedKeys(current => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
          })}
          onRemove={() => setDraft(current => current.filter(item => item.clientKey !== key))}
          removeLabel={`Remove company entry ${entry.companyName.trim() || entry.companyRole.trim() || "without a name"}`}
        >
        <div className="grid gap-2.5 sm:grid-cols-2">
          <label className="space-y-1 text-[11px] font-medium">Project role
            <select className={field} value={customMode ? CUSTOM_ROLE : entry.companyRole ? `role:${entry.companyRole}` : ""} onChange={event => {
              if (event.target.value === CUSTOM_ROLE) {
                setCustomRoleKeys(current => new Set(current).add(key));
                if (COMPANY_ROLE_SUGGESTIONS.includes(entry.companyRole)) set(key, { companyRole: "" });
              } else {
                setCustomRoleKeys(current => { const next = new Set(current); next.delete(key); return next; });
                set(key, { companyRole: event.target.value.replace(/^role:/, "") });
              }
            }}>
              <option value="">Choose a role…</option>
              {roleOptions.map(role => <option key={role} value={`role:${role}`}>{role}</option>)}
              <option value={CUSTOM_ROLE}>Other / enter custom role…</option>
            </select>
          </label>
          {customMode && <label className="space-y-1 text-[11px] font-medium">Custom project role
            <Input className="h-9" value={entry.companyRole} maxLength={160} onChange={event => set(key, { companyRole: event.target.value })} placeholder="Enter a project role" />
          </label>}
          <label className="space-y-1 text-[11px] font-medium">Link a company<select className={field} value={entry.companyId ?? ""} onChange={event => {
            const company = options.companies.find(item => item.id === event.target.value);
            set(key, company ? {
              companyId: company.id, companyName: company.name, addressLine1: company.addressLine1 ?? "",
              addressLine2: company.addressLine2 ?? "", city: company.city ?? "", state: company.state ?? "", zip: company.zip ?? "",
            } : { companyId: null });
          }}><option value="">No linked company</option>{options.companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
          <label className="space-y-1 text-[11px] font-medium">Linked contact<select className={field} value={entry.contactId ?? ""} onChange={event => set(key, { contactId: event.target.value || null })}><option value="">No linked contact</option>{options.contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.fullName}{contact.companyName ? ` · ${contact.companyName}` : ""}</option>)}</select></label>
           {linkedContact && <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-2 text-xs text-muted-foreground sm:col-span-2">
             <span className="font-medium text-foreground">{linkedContact.fullName}{linkedContact.title ? ` · ${linkedContact.title}` : ""}</span>
             {linkedContact.phone && <a className="inline-flex items-center gap-1.5 hover:text-foreground" href={`tel:${linkedContact.phone}`}><Phone className="h-3.5 w-3.5" />{linkedContact.phone}</a>}
             {linkedContact.email && <a className="inline-flex items-center gap-1.5 hover:text-foreground" href={`mailto:${linkedContact.email}`}><Mail className="h-3.5 w-3.5" />{linkedContact.email}</a>}
           </div>}
          <label className="space-y-1 text-[11px] font-medium sm:col-span-2">Project company name<Input className="h-9" value={entry.companyName} onChange={event => set(key, { companyName: event.target.value })} placeholder="Name for this project" /></label>
          <div className="grid grid-cols-2 gap-2 sm:col-span-2"><label className="space-y-1 text-[11px] font-medium">Address<Input className="h-9" value={entry.addressLine1} onChange={event => set(key, { addressLine1: event.target.value })} /></label><label className="space-y-1 text-[11px] font-medium">Address line 2<Input className="h-9" value={entry.addressLine2} onChange={event => set(key, { addressLine2: event.target.value })} /></label></div>
          <div className="grid grid-cols-3 gap-2 sm:col-span-2"><label className="space-y-1 text-[11px] font-medium">City<Input className="h-9" value={entry.city} onChange={event => set(key, { city: event.target.value })} /></label><label className="space-y-1 text-[11px] font-medium">State<Input className="h-9" value={entry.state} onChange={event => set(key, { state: event.target.value })} /></label><label className="space-y-1 text-[11px] font-medium">ZIP<Input className="h-9" value={entry.zip} onChange={event => set(key, { zip: event.target.value })} /></label></div>
        </div>
        </CompanyEntryCard>;
      })}</div>}
    {save.error && <p role="alert" className="mt-3 text-xs text-destructive">{save.error instanceof Error ? save.error.message : "Could not save company entries. Your changes are preserved."}</p>}
    {dirty && <div className="mt-4 flex justify-end gap-2 border-t pt-3"><Button size="sm" variant="ghost" onClick={cancel}>Cancel</Button><Button size="sm" disabled={draft.some(entry => !entry.companyRole.trim())} onClick={() => save.mutate({ version: baseVersion, entries: draft })}>{save.isPending ? "Saving…" : "Save companies"}</Button></div>}
    {options.companies.length === 0 && <p className="mt-3 text-[11px] text-muted-foreground">No accessible company records. You can still keep project-specific names and contact details here.</p>}
    </fieldset>
    {isConflict && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/30 bg-amber-50/50 p-3 text-xs dark:bg-amber-950/20"><span className="mr-auto">Company entries changed elsewhere. Your draft is preserved.</span><Button size="sm" variant="outline" disabled={locked} onClick={() => void reloadLatest()}>{reloading ? "Loading…" : "Reload latest"}</Button><Button size="sm" variant="ghost" disabled={locked} onClick={() => void reloadLatest()}>Discard draft & reload</Button></div>}
    {reloadError && <p role="alert" className="mt-2 text-xs text-destructive">{reloadError}</p>}
  </div>;
}
