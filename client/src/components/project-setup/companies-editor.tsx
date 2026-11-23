import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { LeadCompanyWithLinked, LeadWithCompanies } from "@shared/schema";
import type { ProjectSetupOptions } from "@shared/project-setup";

type Entry = {
  companyRole: string; companyId: string | null; contactId: string | null; companyName: string;
  addressLine1: string; addressLine2: string; city: string; state: string; zip: string;
};
const fromEntry = (entry: LeadCompanyWithLinked): Entry => ({
  companyRole: entry.companyRole, companyId: entry.companyId, contactId: entry.contactId,
  companyName: entry.companyName ?? "", addressLine1: entry.addressLine1 ?? "", addressLine2: entry.addressLine2 ?? "",
  city: entry.city ?? "", state: entry.state ?? "", zip: entry.zip ?? "",
});
const blank: Entry = { companyRole: "", companyId: null, contactId: null, companyName: "", addressLine1: "", addressLine2: "", city: "", state: "", zip: "" };
const field = "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm";

export function CompaniesEditor({ leadId, entries, options, version, disabled = false, onDirtyChange }: { leadId: number; entries: LeadCompanyWithLinked[]; options: ProjectSetupOptions; version: number; disabled?: boolean; onDirtyChange?: (dirty: boolean) => void }) {
  const [draft, setDraft] = useState(() => entries.map(fromEntry));
  const [baseline, setBaseline] = useState(() => entries.map(fromEntry));
  const [baseVersion, setBaseVersion] = useState(version);
  const [reloading, setReloading] = useState(false);
  const [reloadError, setReloadError] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const dirtyCallback = useRef(onDirtyChange);
  dirtyCallback.current = onDirtyChange;
  useEffect(() => { dirtyCallback.current?.(dirty); }, [dirty]);
  const save = useMutation({
    mutationFn: (payload: { version: number; entries: Entry[] }) => apiRequest<LeadWithCompanies>("PATCH", `/api/leads/${leadId}/setup`, {
      version: payload.version, companies: payload.entries.map(entry => ({
        ...entry,
        companyRole: entry.companyRole.trim(),
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
  const set = (index: number, value: Partial<Entry>) => setDraft(current => current.map((item, i) => i === index ? { ...item, ...value } : item));
  const cancel = () => {
    if (dirty && !window.confirm("Discard unsaved company entries?")) return;
    setDraft(baseline);
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

  return <div>
    <fieldset disabled={locked} className="m-0 min-w-0 border-0 p-0">
    {draft.length === 0 ? <div className="rounded-lg border border-dashed px-4 py-6 text-center"><p className="text-sm font-medium">No companies attached yet</p><p className="mt-1 text-xs text-muted-foreground">Add a client, consultant, vendor, or any other project participant.</p></div> :
      <div className="space-y-3">{draft.map((entry, index) => <article key={index} className="rounded-lg border bg-background p-3">
        <div className="mb-3 flex items-start justify-between gap-2"><div className="flex min-w-0 flex-wrap items-center gap-2"><Badge variant="secondary">{entry.companyRole || "New entry"}</Badge>{entry.companyId && <Badge variant="outline">Linked record</Badge>}</div><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Remove company entry ${index + 1}`} onClick={() => setDraft(current => current.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button></div>
        <div className="grid gap-2">
          <label className="space-y-1 text-[11px] font-medium">Project role<Input className="h-9" value={entry.companyRole} maxLength={160} onChange={event => set(index, { companyRole: event.target.value })} placeholder="Client, Architect, Lighting consultant…" /></label>
          <label className="space-y-1 text-[11px] font-medium">Link a company<select className={field} value={entry.companyId ?? ""} onChange={event => {
            const company = options.companies.find(item => item.id === event.target.value);
            set(index, company ? {
              companyId: company.id, companyName: company.name, addressLine1: company.addressLine1 ?? "",
              addressLine2: company.addressLine2 ?? "", city: company.city ?? "", state: company.state ?? "", zip: company.zip ?? "",
            } : { companyId: null });
          }}><option value="">No linked company</option>{options.companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
          <label className="space-y-1 text-[11px] font-medium">Linked contact<select className={field} value={entry.contactId ?? ""} onChange={event => set(index, { contactId: event.target.value || null })}><option value="">No linked contact</option>{options.contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.fullName}{contact.companyName ? ` · ${contact.companyName}` : ""}</option>)}</select></label>
          <label className="space-y-1 text-[11px] font-medium">Project company name<Input className="h-9" value={entry.companyName} onChange={event => set(index, { companyName: event.target.value })} placeholder="Name for this project" /></label>
          <div className="grid grid-cols-2 gap-2"><label className="space-y-1 text-[11px] font-medium">Address<Input className="h-9" value={entry.addressLine1} onChange={event => set(index, { addressLine1: event.target.value })} /></label><label className="space-y-1 text-[11px] font-medium">Address line 2<Input className="h-9" value={entry.addressLine2} onChange={event => set(index, { addressLine2: event.target.value })} /></label></div>
          <div className="grid grid-cols-3 gap-2"><label className="space-y-1 text-[11px] font-medium">City<Input className="h-9" value={entry.city} onChange={event => set(index, { city: event.target.value })} /></label><label className="space-y-1 text-[11px] font-medium">State<Input className="h-9" value={entry.state} onChange={event => set(index, { state: event.target.value })} /></label><label className="space-y-1 text-[11px] font-medium">ZIP<Input className="h-9" value={entry.zip} onChange={event => set(index, { zip: event.target.value })} /></label></div>
        </div>
      </article>)}</div>}
    <Button variant="outline" size="sm" className="mt-3" onClick={() => setDraft(current => [...current, { ...blank }])}><Plus className="mr-1.5 h-4 w-4" />Add company entry</Button>
    {save.error && <p role="alert" className="mt-3 text-xs text-destructive">{save.error instanceof Error ? save.error.message : "Could not save company entries. Your changes are preserved."}</p>}
    {dirty && <div className="mt-4 flex justify-end gap-2 border-t pt-3"><Button size="sm" variant="ghost" onClick={cancel}>Cancel</Button><Button size="sm" disabled={draft.some(entry => !entry.companyRole.trim())} onClick={() => save.mutate({ version: baseVersion, entries: draft })}>{save.isPending ? "Saving…" : "Save companies"}</Button></div>}
    {options.companies.length === 0 && <p className="mt-3 text-[11px] text-muted-foreground">No accessible company records. You can still keep project-specific names and contact details here.</p>}
    </fieldset>
    {isConflict && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/30 bg-amber-50/50 p-3 text-xs dark:bg-amber-950/20"><span className="mr-auto">Company entries changed elsewhere. Your draft is preserved.</span><Button size="sm" variant="outline" disabled={locked} onClick={() => void reloadLatest()}>{reloading ? "Loading…" : "Reload latest"}</Button><Button size="sm" variant="ghost" disabled={locked} onClick={() => void reloadLatest()}>Discard draft & reload</Button></div>}
    {reloadError && <p role="alert" className="mt-2 text-xs text-destructive">{reloadError}</p>}
  </div>;
}
