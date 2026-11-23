import { entrySummary, localCalendarDate, type WorkEntry } from "../../../shared/project-work";

/** Summary always uses the full project log, never the currently filtered view. */
export function workMotionSummary(entries: WorkEntry[], now = new Date()) {
  const today = localCalendarDate(now);
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const meetings = entries.filter(entry =>
    !entry.archived && entry.entryType === "Meeting" && !!entry.meetingDate &&
    (entry.meetingDate > today || (entry.meetingDate === today && (!entry.meetingTime || entry.meetingTime >= time)))
  );
  meetings.sort((a, b) =>
    a.meetingDate!.localeCompare(b.meetingDate!) ||
    (a.meetingTime ?? "").localeCompare(b.meetingTime ?? "") ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id)
  );
  return { ...entrySummary(entries, today), nextMeeting: meetings[0] ?? null };
}
