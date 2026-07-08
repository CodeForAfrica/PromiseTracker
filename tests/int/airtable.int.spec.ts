import { describe, expect, it, vi, beforeEach } from "vitest";

const scanMock = vi.fn();
const tableMock = vi.fn();

vi.mock("airtable-ts", () => ({
  AirtableTs: vi.fn(() => ({
    scan: scanMock,
    table: tableMock,
  })),
}));

vi.mock("airtable-ts-formula", () => ({
  formula: vi.fn(() => "mocked-formula"),
}));

import { getUnprocessedDocuments } from "@/lib/airtable";

describe("getUnprocessedDocuments", () => {
  beforeEach(() => {
    scanMock.mockReset();
    tableMock.mockReset();
    tableMock.mockResolvedValue({});
  });

  const mockScans = ({
    documents,
    publishedEntities,
  }: {
    documents: Array<Record<string, unknown>>;
    publishedEntities: Array<Record<string, unknown>>;
  }) => {
    scanMock.mockImplementation(async (table: { name: string }) => {
      if (table.name === "Documents") {
        return documents;
      }
      if (table.name === "Political Entities") {
        return publishedEntities;
      }
      return [];
    });
  };

  it("only returns documents linked to published political entities", async () => {
    mockScans({
      documents: [
        { id: "docPublished", politicalEntity: ["entityPublished"] },
        { id: "docUnpublished", politicalEntity: ["entityUnpublished"] },
        {
          id: "docMixed",
          politicalEntity: ["entityUnpublished", "entityPublished"],
        },
      ],
      publishedEntities: [{ id: "entityPublished" }],
    });

    const documents = await getUnprocessedDocuments({
      airtableAPIKey: "test-key",
    });

    expect(documents.map((doc) => doc.id)).toEqual([
      "docPublished",
      "docMixed",
    ]);
  });

  it("keeps documents without a political entity so the task can flag them", async () => {
    mockScans({
      documents: [
        { id: "docNoEntity", politicalEntity: [] },
        { id: "docUnpublished", politicalEntity: ["entityUnpublished"] },
      ],
      publishedEntities: [],
    });

    const documents = await getUnprocessedDocuments({
      airtableAPIKey: "test-key",
    });

    expect(documents.map((doc) => doc.id)).toEqual(["docNoEntity"]);
  });

  it("does not fetch political entities when there are no unprocessed documents", async () => {
    mockScans({ documents: [], publishedEntities: [] });

    const documents = await getUnprocessedDocuments({
      airtableAPIKey: "test-key",
    });

    expect(documents).toEqual([]);
    expect(scanMock).toHaveBeenCalledTimes(1);
  });
});
