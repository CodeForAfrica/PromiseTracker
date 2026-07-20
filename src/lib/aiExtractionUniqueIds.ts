import { randomUUID } from "node:crypto";

type ExtractionRowLike = {
  uniqueId?: string | null;
  [key: string]: unknown;
};

/**
 * Returns a copy of the extraction rows with a system-generated uniqueId
 * assigned to every row missing one, or null when nothing needs backfilling.
 * Used by the AIExtractions field hook's migration counterpart so existing
 * records satisfy the required-uniqueId invariant.
 */
export const assignMissingExtractionRowUniqueIds = (
  extractions: ExtractionRowLike[] | null | undefined,
  generateId: () => string = randomUUID,
): ExtractionRowLike[] | null => {
  if (!Array.isArray(extractions) || extractions.length === 0) {
    return null;
  }

  let changed = false;
  const next = extractions.map((row) => {
    if (typeof row?.uniqueId === "string" && row.uniqueId.trim()) {
      return row;
    }
    changed = true;
    return { ...row, uniqueId: generateId() };
  });

  return changed ? next : null;
};
