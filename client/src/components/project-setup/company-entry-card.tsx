import type { ReactNode } from "react";
import { ChevronDown, ChevronUp, Link2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  panelId: string;
  companyName: string;
  companyRole: string;
  linked: boolean;
  contactSummary?: string;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  removeLabel: string;
  children: ReactNode;
};

export function CompanyEntryCard({
  panelId,
  companyName,
  companyRole,
  linked,
  contactSummary,
  expanded,
  onToggle,
  onRemove,
  removeLabel,
  children,
}: Props) {
  const heading = companyName.trim() || companyRole.trim() || "New company entry";

  return (
    <article className="overflow-hidden rounded-lg border bg-background">
      <div className="flex min-w-0 items-center gap-1.5 p-1.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{heading}</span>
            <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span className="truncate">{companyRole.trim() || "Role not set"}</span>
              {linked && <span className="inline-flex items-center gap-1"><Link2 className="h-3 w-3" />Linked company</span>}
              {contactSummary && <span className="truncate">Contact: {contactSummary}</span>}
            </span>
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={removeLabel}
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div id={panelId} hidden={!expanded} className="border-t px-3 py-3">
        {children}
      </div>
    </article>
  );
}
