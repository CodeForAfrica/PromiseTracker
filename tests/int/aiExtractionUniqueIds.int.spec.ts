import { describe, expect, it } from "vitest";
import type { ArrayField, Field, RowField, TextField } from "payload";

import {
  AIExtractions,
  ensureExtractionRowUniqueId,
} from "@/collections/AIExtractions";
import { assignMissingExtractionRowUniqueIds } from "@/lib/aiExtractionUniqueIds";

const getUniqueIdField = (): TextField | undefined => {
  const extractions = AIExtractions.fields.find(
    (field): field is ArrayField =>
      field.type === "array" && field.name === "extractions",
  );
  const row = extractions?.fields.find(
    (field): field is RowField => field.type === "row",
  );
  return row?.fields.find(
    (field: Field): field is TextField =>
      field.type === "text" && "name" in field && field.name === "uniqueId",
  );
};

describe("AI extraction row unique IDs", () => {
  it("requires a system-generated uniqueId on every extraction row", () => {
    const uniqueId = getUniqueIdField();

    expect(uniqueId).toBeDefined();
    expect(uniqueId?.required).toBe(true);
    expect(uniqueId?.hooks?.beforeValidate).toContain(
      ensureExtractionRowUniqueId,
    );
  });

  it("generates a uniqueId when the value is missing or blank", () => {
    const generatedForUndefined = ensureExtractionRowUniqueId({
      value: undefined,
    } as never);
    const generatedForBlank = ensureExtractionRowUniqueId({
      value: "   ",
    } as never);

    expect(generatedForUndefined).toMatch(/[0-9a-f-]{36}/);
    expect(generatedForBlank).toMatch(/[0-9a-f-]{36}/);
    expect(generatedForUndefined).not.toBe(generatedForBlank);
  });

  it("keeps an existing uniqueId untouched", () => {
    expect(
      ensureExtractionRowUniqueId({ value: "existing-id" } as never),
    ).toBe("existing-id");
  });

  describe("backfill helper (migration)", () => {
    it("assigns IDs only to rows missing one", () => {
      let counter = 0;
      const generateId = () => `generated-${(counter += 1)}`;

      const result = assignMissingExtractionRowUniqueIds(
        [
          { uniqueId: "keep-me", summary: "a" },
          { uniqueId: "", summary: "b" },
          { summary: "c" },
        ],
        generateId,
      );

      expect(result).toEqual([
        { uniqueId: "keep-me", summary: "a" },
        { uniqueId: "generated-1", summary: "b" },
        { uniqueId: "generated-2", summary: "c" },
      ]);
    });

    it("returns null when nothing needs backfilling", () => {
      expect(
        assignMissingExtractionRowUniqueIds([{ uniqueId: "ok" }]),
      ).toBeNull();
      expect(assignMissingExtractionRowUniqueIds([])).toBeNull();
      expect(assignMissingExtractionRowUniqueIds(null)).toBeNull();
    });
  });
});
