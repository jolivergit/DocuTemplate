import { Archive, Search } from "lucide-react";
import { ENTRY_TYPES } from "@shared/project-work";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type WorkLogFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  entryTypeFilter: string;
  onEntryTypeFilterChange: (value: string) => void;
  actionableOnly: boolean;
  onActionableOnlyChange: (value: boolean) => void;
  mineOnly: boolean;
  onMineOnlyChange: (value: boolean) => void;
  archived: boolean;
  onArchivedChange: (value: boolean) => void;
};

export function WorkLogFilters({
  search,
  onSearchChange,
  entryTypeFilter,
  onEntryTypeFilterChange,
  actionableOnly,
  onActionableOnlyChange,
  mineOnly,
  onMineOnlyChange,
  archived,
  onArchivedChange,
}: WorkLogFiltersProps) {
  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(14rem,1fr)_auto] lg:items-center">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden="true" className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search work entries"
            className="h-9 pl-9"
            value={search}
            onChange={event => onSearchChange(event.target.value)}
            placeholder="Search the log"
          />
        </div>
        <select
          aria-label="Filter by entry type"
          className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring sm:w-40"
          value={entryTypeFilter}
          onChange={event => onEntryTypeFilterChange(event.target.value)}
        >
          <option value="all">All types</option>
          {ENTRY_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
        </select>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div role="group" aria-label="Additional filters" className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={actionableOnly ? "default" : "outline"}
            className="h-9 min-h-9 px-3"
            aria-pressed={actionableOnly}
            title="Show tasks and reminders only"
            onClick={() => onActionableOnlyChange(!actionableOnly)}
          >
            Actionable
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mineOnly ? "default" : "outline"}
            className="h-9 min-h-9 px-3"
            aria-pressed={mineOnly}
            title="Show entries assigned to you"
            onClick={() => onMineOnlyChange(!mineOnly)}
          >
            Mine
          </Button>
        </div>

        <div className="hidden h-6 w-px bg-border sm:block" aria-hidden="true" />

        <div role="group" aria-label="Entry status" className="flex h-9 shrink-0 items-center rounded-md border border-input bg-muted/40 p-0.5">
          <Button
            type="button"
            size="sm"
            variant={archived ? "ghost" : "default"}
            className="h-8 min-h-8 px-3"
            aria-pressed={!archived}
            onClick={() => onArchivedChange(false)}
          >
            Active
          </Button>
          <Button
            type="button"
            size="sm"
            variant={archived ? "default" : "ghost"}
            className="h-8 min-h-8 px-3"
            aria-pressed={archived}
            onClick={() => onArchivedChange(true)}
          >
            <Archive className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Archived
          </Button>
        </div>
      </div>
    </div>
  );
}
