import { createExportHeaderHook } from "@/lib/exportColumnLabels";
import { describe, expect, it } from "vitest";

const fakeReq = (fields: Array<{ name: string; label?: unknown }>) =>
  ({
    payload: {
      collections: {
        "ai-extraction-export-rows": {
          config: {
            flattenedFields: fields,
          },
        },
      },
    },
    i18n: {
      language: "en",
      fallbackLanguage: "en",
      t: (key: string) => key,
    },
  }) as never;

describe("createExportHeaderHook", () => {
  it("renames raw field keys to their configured admin labels", async () => {
    const hook = createExportHeaderHook("ai-extraction-export-rows");
    const req = fakeReq([
      { name: "tenantName", label: "Tenant Name" },
      { name: "politicalEntityName", label: "Political Entity Name" },
      { name: "documentTitle", label: "Document Title" },
      { name: "category", label: "Category" },
      { name: "summary", label: "Summary" },
      { name: "statusLabel", label: "Status Label" },
      { name: "source", label: "Source" },
      { name: "checkMediaURL", label: "CheckMedia URL" },
    ]);

    const result = await hook({
      batchNumber: 1,
      data: [
        {
          tenantName: "Kenya",
          politicalEntityName: "Jane Leader",
          documentTitle: "Manifesto PDF",
          category: "Health",
          summary: "Build new clinics",
          statusLabel: "In Progress",
          source: "Clinic source quote",
          checkMediaURL: "https://check.example.com/media/check-1",
        },
      ],
      format: "csv",
      originalData: [],
      req,
      totalBatches: 1,
    });

    expect(result).toEqual([
      {
        "Tenant Name": "Kenya",
        "Political Entity Name": "Jane Leader",
        "Document Title": "Manifesto PDF",
        Category: "Health",
        Summary: "Build new clinics",
        "Status Label": "In Progress",
        Source: "Clinic source quote",
        "CheckMedia URL": "https://check.example.com/media/check-1",
      },
    ]);
  });

  it("falls back to a title-cased key when a field has no configured label", async () => {
    const hook = createExportHeaderHook("ai-extraction-export-rows");
    const req = fakeReq([{ name: "checkMediaId" }]);

    const result = await hook({
      batchNumber: 1,
      data: [{ checkMediaId: "check-1", unknownRawKey: "value" }],
      format: "csv",
      originalData: [],
      req,
      totalBatches: 1,
    });

    expect(result).toEqual([
      { "Check Media Id": "check-1", "Unknown Raw Key": "value" },
    ]);
  });
});
