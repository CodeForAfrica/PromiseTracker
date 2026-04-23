import { buildAIExtractionExportRows } from "@/lib/aiExtractionExportRows";
import type { AiExtraction } from "@/payload-types";
import { describe, expect, it } from "vitest";

describe("AI extraction export rows", () => {
  it("creates one flat export row per extraction entry", () => {
    const extractionDoc = {
      id: "ai-extraction-1",
      title: "Campaign Manifesto",
      document: {
        id: "document-1",
        title: "Manifesto PDF",
        url: "https://example.com/manifesto.pdf",
        language: "en",
        type: "promise",
        airtableID: "rec-document",
        politicalEntity: {
          id: "political-entity-1",
          name: "Jane Leader",
          slug: "jane-leader",
          position: "President",
          tenant: {
            id: "tenant-1",
            name: "Kenya",
            country: "KEN",
            locale: "en",
          },
        },
      },
      extractions: [
        {
          id: "row-1",
          category: "Health",
          summary: "Build new clinics",
          source: "Clinic source quote",
          uniqueId: "unique-1",
          checkMediaId: "check-1",
          checkMediaURL: "https://check.example.com/media/check-1",
          Status: {
            id: "status-1",
            label: "In Progress",
            meedanId: "meedan-status-1",
          },
        },
        {
          id: "row-2",
          category: "Education",
          summary: "Hire teachers",
          source: "Teacher source quote",
          uploadError: "Upload failed",
        },
      ],
    } as AiExtraction;

    const rows = buildAIExtractionExportRows(extractionDoc);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      uniqueKey: "ai-extraction-1:unique-1",
      tenantId: "tenant-1",
      tenantName: "Kenya",
      tenantCountry: "KEN",
      politicalEntityId: "political-entity-1",
      politicalEntityName: "Jane Leader",
      documentId: "document-1",
      documentTitle: "Manifesto PDF",
      documentUrl: "https://example.com/manifesto.pdf",
      aiExtractionId: "ai-extraction-1",
      extractionRowId: "unique-1",
      category: "Health",
      summary: "Build new clinics",
      statusId: "status-1",
      statusLabel: "In Progress",
      statusMeedanId: "meedan-status-1",
      checkMediaId: "check-1",
      checkMediaURL: "https://check.example.com/media/check-1",
    });
    expect(rows[1]).toMatchObject({
      uniqueKey: "ai-extraction-1:row-2",
      category: "Education",
      statusId: "",
      statusLabel: "",
      uploadError: "Upload failed",
    });
  });

  it("falls back to docURLs and safely handles unresolved relationships", () => {
    const extractionDoc = {
      id: "ai-extraction-2",
      document: {
        id: "document-2",
        title: "Airtable attachment",
        docURLs: [{ url: "https://example.com/attachment.pdf" }],
        politicalEntity: "political-entity-2",
      },
      extractions: [
        {
          category: "Jobs",
          summary: "Create jobs",
          source: "Jobs quote",
        },
      ],
    } as AiExtraction;

    const [row] = buildAIExtractionExportRows(extractionDoc);

    expect(row).toMatchObject({
      uniqueKey: "ai-extraction-2:1",
      documentUrl: "https://example.com/attachment.pdf",
      politicalEntityId: "political-entity-2",
      politicalEntityName: "",
      tenantId: "",
      tenantName: "",
    });
  });
});
