import { useState } from "react";
import { ENTRY_TYPES, TASK_PRIORITIES, TASK_STATUSES, type EntryType, type ProjectWork } from "@shared/project-work";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WorkDateField } from "./work-date-field";

export type EntryDraft = {
  entryType: EntryType; title: string; description: string; phaseId: string; assigneeId: string;
  priority: string; status: string; dueDate: string; meetingDate: string; meetingTime: string;
};
export const emptyDraft = (entryType: EntryType = "Task"): EntryDraft => ({
  entryType, title: "", description: "", phaseId: "", assigneeId: "",
  priority: "Normal", status: "To do", dueDate: "", meetingDate: "", meetingTime: "",
});
export function entryHasContent(draft: EntryDraft) {
  if (draft.entryType === "Note") return !!draft.description.trim();
  if (draft.entryType === "Meeting") return !!draft.title.trim() || !!draft.description.trim();
  return !!draft.title.trim();
}
const fieldClass = "h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm";

export function PhaseAssigneeFields({ draft, setDraft, phases, assignees }: { draft: EntryDraft; setDraft: (next: EntryDraft) => void; phases: ProjectWork["phases"]; assignees: ProjectWork["assignees"] }) {
  return <div className="grid gap-3 sm:grid-cols-2">
    <label className="grid min-w-0 gap-1.5 text-xs font-medium">Phase (optional)<select className={fieldClass} value={draft.phaseId} onChange={e => setDraft({ ...draft, phaseId: e.target.value })}><option value="">General</option>{phases.filter(p => !p.archived || p.id === draft.phaseId).map(p => <option key={p.id} value={p.id}>{p.name}{p.archived ? " (archived)" : ""}</option>)}</select></label>
    <label className="grid min-w-0 gap-1.5 text-xs font-medium">Teammate (optional)<select className={fieldClass} value={draft.assigneeId} onChange={e => setDraft({ ...draft, assigneeId: e.target.value })}><option value="">No teammate</option>{draft.assigneeId && !assignees.some(person => person.userId === draft.assigneeId) && <option value={draft.assigneeId} disabled>Previous teammate (access removed)</option>}{assignees.map(person => <option key={person.userId} value={person.userId}>{person.name}</option>)}</select></label>
  </div>;
}

export function Composer({ draft, setDraft, phases, assignees, pending, error, saveError, onDismiss, onSubmit, onCheck, onNewRequest, onRestoreOriginal, canNewRequest, canRestoreOriginal, blockedChangedRequest, originalResolved, confirmDiscard, onKeepEditing, onDiscard }: {
  draft: EntryDraft; setDraft: (draft: EntryDraft) => void; phases: ProjectWork["phases"]; assignees: ProjectWork["assignees"]; pending: boolean;
  error: string; saveError: string; onDismiss: () => void; onSubmit: () => void; onCheck: () => void; onNewRequest: () => void; onRestoreOriginal: () => void;
  canNewRequest: boolean; canRestoreOriginal: boolean; blockedChangedRequest: boolean; originalResolved: boolean; confirmDiscard: boolean; onKeepEditing: () => void; onDiscard: () => void;
}) {
  const valid = entryHasContent(draft) && !(draft.entryType === "Meeting" && draft.meetingTime && !draft.meetingDate);
  const [switchingTo, setSwitchingTo] = useState<EntryType | null>(null);
  const hasTypeDraft = entryHasContent(draft) || !!draft.description || !!draft.phaseId || !!draft.assigneeId || draft.priority !== "Normal" || draft.status !== "To do" || !!draft.dueDate || !!draft.meetingDate || !!draft.meetingTime;
  const chooseType = (type: EntryType) => {
    if (type === draft.entryType || pending) return;
    if (hasTypeDraft) { setSwitchingTo(type); return; }
    setDraft({ ...emptyDraft(type), phaseId: draft.phaseId, assigneeId: draft.assigneeId });
  };
  return <form className="border-b bg-muted/15 p-4 sm:p-5" onSubmit={e => { e.preventDefault(); onSubmit(); }}>
    <fieldset disabled={pending} className="m-0 grid min-w-0 gap-4 border-0 p-0">
      <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-1.5" aria-label="Entry type">
        {ENTRY_TYPES.map(type => <Button key={type} type="button" size="sm" variant={draft.entryType === type ? "default" : "outline"} disabled={pending} onClick={() => chooseType(type)}>{type}</Button>)}
      </div><span className="text-xs text-muted-foreground">Type is fixed after saving.</span></div>
      {switchingTo && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-600/30 bg-amber-500/5 p-3 text-sm"><span>Changing to {switchingTo} will discard this draft.</span><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setSwitchingTo(null)}>Keep draft</Button><Button type="button" size="sm" variant="destructive" onClick={() => { setDraft({ ...emptyDraft(switchingTo), phaseId: draft.phaseId, assigneeId: draft.assigneeId }); setSwitchingTo(null); }}>Discard and switch</Button></div></div>}
      {(draft.entryType === "Task" || draft.entryType === "Reminder" || draft.entryType === "Meeting") && <label className="grid min-w-0 gap-1.5 text-xs font-medium">{draft.entryType === "Meeting" ? "Meeting title (optional)" : `${draft.entryType} title`}<Input autoFocus required={draft.entryType !== "Meeting"} maxLength={240} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder={draft.entryType === "Meeting" ? "Optional if notes explain the meeting" : "A short, clear description"} /></label>}
      <label className="grid min-w-0 gap-1.5 text-xs font-medium">{draft.entryType === "Note" ? "Note" : draft.entryType === "Meeting" ? "Notes (optional)" : "Description (optional)"}<Textarea autoFocus={draft.entryType === "Note"} required={draft.entryType === "Note"} rows={draft.entryType === "Note" ? 4 : 3} maxLength={20000} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder={draft.entryType === "Note" ? "Write the day as it happened…" : "Context for the team"} /></label>
      <PhaseAssigneeFields draft={draft} setDraft={setDraft} phases={phases} assignees={assignees} />
      {draft.entryType === "Task" && <div className="grid gap-3 sm:grid-cols-3"><label className="grid min-w-0 gap-1.5 text-xs font-medium">Priority<select className={fieldClass} value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value })}>{TASK_PRIORITIES.map(item => <option key={item}>{item}</option>)}</select></label><label className="grid min-w-0 gap-1.5 text-xs font-medium">Status<select className={fieldClass} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}>{TASK_STATUSES.map(item => <option key={item}>{item}</option>)}</select></label><label className="grid min-w-0 gap-1.5 text-xs font-medium">Due date (optional)<WorkDateField label="Due date" value={draft.dueDate} disabled={pending} onChange={dueDate => setDraft({ ...draft, dueDate })} /></label></div>}
      {draft.entryType === "Reminder" && <div className="grid gap-3 sm:grid-cols-2"><label className="grid min-w-0 gap-1.5 text-xs font-medium">Status<select className={fieldClass} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}><option>To do</option><option>Done</option></select></label><label className="grid min-w-0 gap-1.5 text-xs font-medium">Due date (optional)<WorkDateField label="Due date" value={draft.dueDate} disabled={pending} onChange={dueDate => setDraft({ ...draft, dueDate })} /></label></div>}
      {draft.entryType === "Meeting" && <div className="grid gap-3 sm:grid-cols-2"><label className="grid min-w-0 gap-1.5 text-xs font-medium">Meeting date (optional)<WorkDateField label="Meeting date" value={draft.meetingDate} disabled={pending} onChange={meetingDate => setDraft({ ...draft, meetingDate, meetingTime: meetingDate ? draft.meetingTime : "" })} /></label><label className="grid min-w-0 gap-1.5 text-xs font-medium">Meeting time (optional)<input aria-label="Meeting time" className={`${fieldClass} [color-scheme:light] dark:[color-scheme:dark]`} type="time" value={draft.meetingTime} onChange={e => setDraft({ ...draft, meetingTime: e.target.value })} />{draft.meetingTime && !draft.meetingDate && <span className="text-destructive">Choose a date first.</span>}</label></div>}
      {(error || saveError) && <div role="alert" className="rounded border border-destructive/30 bg-destructive/5 p-3 text-sm">{error && <p>{error}</p>}{saveError && <p className={error ? "mt-1" : ""}>{saveError}</p>}<div className="mt-2 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={pending} onClick={onCheck}>Check if saved</Button>{canRestoreOriginal && <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onRestoreOriginal}>Restore original draft to retry</Button>}{canNewRequest && <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onNewRequest}>{originalResolved ? "Use a new request for changed draft" : "Start a new save"}</Button>}</div></div>}
      {blockedChangedRequest && <p role="status" className="text-xs text-amber-800">Check the log for the previous request before saving changed text. A new request ID is only created when you choose it explicitly.</p>}
      {confirmDiscard && <div className="rounded border border-amber-600/30 bg-amber-500/5 p-3 text-sm"><p>Discard this unsaved entry?</p><div className="mt-2 flex justify-end gap-2"><Button type="button" size="sm" variant="outline" onClick={onKeepEditing}>Keep writing</Button><Button type="button" size="sm" variant="destructive" onClick={onDiscard}>Discard</Button></div></div>}
      <div className="flex flex-wrap justify-end gap-2 border-t pt-4"><Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onDismiss}>Cancel</Button><Button size="sm" disabled={!valid || pending || blockedChangedRequest}>{pending ? "Saving…" : `Save ${draft.entryType.toLocaleLowerCase()}`}</Button></div>
    </fieldset>
  </form>;
}
