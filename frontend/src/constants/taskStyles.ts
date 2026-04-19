/**
 * Shared presentation constants for remediation tasks and publication statuses.
 * Pages should import from here instead of defining their own copy so one
 * place controls the color language of the app.
 */

export type TaskStatus = 'open' | 'in_progress' | 'done';

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  done: 'Done',
};

// Pill styling for task status chips (bg + text).
export const TASK_STATUS_PILL: Record<TaskStatus, string> = {
  open: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-amber-50 text-amber-700',
  done: 'bg-green-50 text-green-700',
};

// Label for change_type badges on a task.
export const CHANGE_TYPE_LABEL: Record<string, string> = {
  NEW_REQUIREMENT: 'New Requirement',
  AMENDED_REQUIREMENT: 'Amended Requirement',
  DEADLINE_CHANGE: 'Deadline Change',
};

// Short form for tight kanban cards.
export const CHANGE_TYPE_SHORT: Record<string, string> = {
  NEW_REQUIREMENT: 'New Req.',
  AMENDED_REQUIREMENT: 'Amended',
  DEADLINE_CHANGE: 'Deadline',
};

// Publication lifecycle status chip styling.
export const PUBLICATION_STATUS_PILL: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-500',
  ingested: 'bg-blue-50 text-blue-600',
  classified: 'bg-indigo-50 text-indigo-600',
  actioned: 'bg-green-50 text-green-700',
  skipped: 'bg-gray-50 text-gray-400',
};

export const DOC_TYPE_LABEL: Record<string, string> = {
  FinalRule: 'Final Rule',
  ConsultationPaper: 'Consultation Paper',
  DearCEOLetter: 'Dear CEO Letter',
  GuidanceNote: 'Guidance Note',
};
