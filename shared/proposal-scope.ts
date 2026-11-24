type PhaseReference = { projectPhaseId?: string | null };

/** New documents start with active project scope; saved selections are never inferred. */
export function initialProposalPhaseIds(
  projectPhases: { id: string; archived: boolean; sortOrder: number }[],
  existingPhases?: PhaseReference[],
): string[] {
  if (existingPhases !== undefined) {
    return existingPhases.map(phase => phase.projectPhaseId).filter((id): id is string => !!id);
  }
  return projectPhases.filter(phase => !phase.archived)
    .sort((a, b) => a.sortOrder - b.sortOrder).map(phase => phase.id);
}

/** Omitting scope is a metadata edit, never an instruction to clear or expand it. */
export function scopeSaveFields(options: {
  editing: boolean;
  locked: boolean;
  selectionChanged: boolean;
  selectedPhaseIds: string[];
}): { selectedPhaseIds?: string[] } {
  if (options.locked || options.editing && !options.selectionChanged) return {};
  return { selectedPhaseIds: options.selectedPhaseIds };
}

/** Refresh only the document's actual selection, including an explicitly empty one. */
export function scopeRefreshIds(phases: PhaseReference[]): string[] {
  if (phases.some(phase => !phase.projectPhaseId)) {
    throw new Error("This older proposal has unmapped phases. Use Edit to explicitly select its shared project phases before refreshing, or prepare a new proposal with an explicit selection.");
  }
  return phases.map(phase => phase.projectPhaseId!);
}
