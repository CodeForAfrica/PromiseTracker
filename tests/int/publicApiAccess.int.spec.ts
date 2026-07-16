import { AIExtractions } from "@/collections/AIExtractions";
import { Documents } from "@/collections/Documents";
import { Promises } from "@/collections/Promises";
import type { User } from "@/payload-types";
import type { Field, TextField } from "payload";
import { describe, expect, it } from "vitest";

const editor: Pick<User, "id" | "roles"> = {
  id: "global-editor",
  roles: ["globalEditor"],
};

const accessArgs = (user: typeof editor | null) =>
  ({
    req: {
      payloadAPI: "REST",
      user,
    },
  }) as never;

const findTextField = (fields: Field[], name: string) =>
  fields.find(
    (field): field is TextField =>
      field.type === "text" && field.name === name,
  );

describe("public API publication controls", () => {
  it("limits anonymous promise reads to published records", async () => {
    expect(await Promises.access?.read?.(accessArgs(null))).toEqual({
      publishStatus: {
        equals: "published",
      },
    });
  });

  it("lets editors read draft and unpublished promises", async () => {
    expect(await Promises.access?.read?.(accessArgs(editor))).toBe(true);
  });

  it("hides the Meedan identifier from anonymous readers", async () => {
    const meedanId = findTextField(Promises.fields, "meedanId");

    expect(meedanId).toBeDefined();
    expect(await meedanId?.access?.read?.(accessArgs(null))).toBe(false);
    expect(await meedanId?.access?.read?.(accessArgs(editor))).toBe(true);
  });

  it("requires authentication to read documents", async () => {
    expect(await Documents.access?.read?.(accessArgs(null))).toBe(false);
    expect(await Documents.access?.read?.(accessArgs(editor))).toBe(true);
  });

  it("requires authentication to read AI extractions", async () => {
    expect(await AIExtractions.access?.read?.(accessArgs(null))).toBe(false);
    expect(await AIExtractions.access?.read?.(accessArgs(editor))).toBe(true);
  });
});
