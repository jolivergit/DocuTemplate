import { CalendarDays, Check, Clock3, FileText, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isEntryOverdue, type WorkEntry } from "@shared/project-work";

function dateLabel(value: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function TypeIcon({ type }: { type: WorkEntry["entryType"] }) {
  if (type === "Task") return <Check className="h-3.5 w-3.5" />;
  if (type === "Reminder") return <Clock3 className="h-3.5 w-3.5" />;
  if (type === "Meeting") return <Users className="h-3.5 w-3.5" />;
  return <FileText className="h-3.5 w-3.5" />;
}

export function WorkEntryContent({ entry, phase }: { entry: WorkEntry; phase: string }) {
  const overdue = isEntryOverdue(entry);
  const actionable = entry.entryType === "Task" || entry.entryType === "Reminder";
  return <div className="flex gap-3">
    <div className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${entry.entryType === "Task" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}><TypeIcon type={entry.entryType} /></div>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="text-[10px]">{entry.entryType}</Badge>
            {entry.status && <Badge variant={entry.status === "Done" ? "secondary" : "outline"} className={`text-[10px] ${entry.status === "Blocked" ? "border-foreground/35 font-semibold" : ""}`}>{entry.status}</Badge>}
            {entry.priority && <span className="text-[11px] text-muted-foreground">{entry.priority} priority</span>}
            {entry.archived && <Badge variant="secondary" className="text-[10px]">Archived</Badge>}
          </div>
          {entry.entryType !== "Note" && !!entry.title.trim() && <h3 className={`mt-1 break-words text-base font-semibold normal-case tracking-normal ${entry.status === "Done" ? "text-muted-foreground line-through" : ""}`}>{entry.title}</h3>}
          {!!entry.description && <p className={`mt-1 whitespace-pre-wrap break-words leading-6 ${entry.entryType === "Note" ? "text-base font-medium text-foreground" : "text-sm text-foreground/85"}`}>{entry.description}</p>}
        </div>
        <time className="shrink-0 text-[11px] tabular-nums text-muted-foreground" dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{entry.authorName || "Project teammate"}</span>
        {phase && <span>{phase}</span>}
        {entry.assigneeName && <span>For {entry.assigneeName}</span>}
        {entry.assigneeId && !entry.assigneeName && <span className="font-medium">Teammate needs reassignment</span>}
        {entry.entryType === "Meeting" && (entry.meetingDate || entry.meetingTime) && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{entry.meetingDate ? dateLabel(entry.meetingDate) : ""}{entry.meetingDate && entry.meetingTime ? " · " : ""}{entry.meetingTime || ""}</span>}
        {actionable && <span className={overdue ? "font-semibold text-destructive" : ""}>{entry.dueDate ? `${overdue ? "Overdue · " : "Due "}${dateLabel(entry.dueDate)}` : "No due date"}</span>}
      </div>
    </div>
  </div>;
}
