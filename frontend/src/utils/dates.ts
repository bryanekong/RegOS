import { isBefore, parseISO } from 'date-fns';

/**
 * Safely determine whether a deadline has passed. Returns false for null,
 * undefined, empty, or malformed ISO strings — so the overdue badge never
 * misfires on bad data.
 */
export function isOverdue(deadline: string | null | undefined): boolean {
  if (!deadline) return false;
  const d = parseISO(deadline);
  if (isNaN(d.getTime())) return false;
  return isBefore(d, new Date());
}
