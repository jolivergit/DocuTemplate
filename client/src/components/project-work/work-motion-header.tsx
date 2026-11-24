import { CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkEntry } from "@shared/project-work";

type Summary = { open: number; blocked: number; overdue: number; done: number; nextMeeting: WorkEntry | null };
type Props = {
  summary: Summary;
  addDisabled: boolean;
  onAddUpdate: () => void;
};

function dateLabel(value: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function WorkMotionHeader({ summary, addDisabled, onAddUpdate }: Props) {
  const meeting = summary.nextMeeting;
  const meetingWhen = meeting
    ? `${dateLabel(meeting.meetingDate)}${meeting.meetingTime ? ` · ${meeting.meetingTime}` : " · Time not set"}`
    : "";

  return <header className="border-b bg-muted/20 px-4 py-3 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold">Work in motion</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Active work: <span className="font-medium text-foreground">{summary.open} open</span> <span className="mx-1.5" aria-hidden="true">·</span><span className={summary.overdue ? "font-semibold text-foreground" : ""}>{summary.overdue} overdue</span> <span className="mx-1.5" aria-hidden="true">·</span>{summary.blocked} blocked <span className="mx-1.5" aria-hidden="true">·</span>{summary.done} done</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="h-8 px-3" disabled={addDisabled} onClick={onAddUpdate}><Plus className="mr-1.5 h-4 w-4" />Add update</Button>
      </div>
    </div>
    {meeting && <div className="mt-2 flex min-w-0 items-start gap-2 border-t pt-2 text-sm">
      <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-xs font-medium text-muted-foreground">Next meeting</span>
          {meeting.title.trim() && <span className="line-clamp-1 min-w-0 break-words font-medium">{meeting.title}</span>}
          <span className="text-xs text-muted-foreground">{meetingWhen}</span>
        </div>
      </div>
    </div>}
  </header>;
}
