import { describe, expect, it, vi } from "vitest";
import type { TextField } from "payload";

import { PoliticalEntities } from "@/collections/PoliticalEntities";
import { ensureUniqueSlug } from "@/collections/PoliticalEntities/hooks/ensureUniqueSlug";

const getSlugField = () =>
  PoliticalEntities.fields.find(
    (field): field is TextField =>
      field.type === "text" && "name" in field && field.name === "slug",
  );

describe("political entity slug uniqueness", () => {
  it("keeps the ensureUniqueSlug hook on the slug field", () => {
    const slugField = getSlugField();

    expect(slugField).toBeDefined();
    expect(slugField?.hooks?.beforeValidate).toContain(ensureUniqueSlug);
  });

  it("indexes and requires the slug field", () => {
    const slugField = getSlugField();

    expect(slugField?.index).toBe(true);
    expect(slugField?.required).toBe(true);
  });

  it("rejects a duplicate slug within the same tenant", async () => {
    const find = vi.fn().mockImplementation(({ collection }) => {
      if (collection === "political-entities") {
        return { docs: [{ id: "existing", slug: "john-doe" }] };
      }
      return { docs: [{ id: "tenant-a", name: "Tenant A" }] };
    });

    await expect(
      ensureUniqueSlug({
        data: { tenant: "tenant-a" },
        originalDoc: undefined,
        req: { payload: { find } },
        value: "john-doe",
      } as never),
    ).rejects.toMatchObject({
      name: "ValidationError",
    });

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "political-entities",
        where: {
          and: [
            { slug: { equals: "john-doe" } },
            { tenant: { equals: "tenant-a" } },
          ],
        },
      }),
    );
  });

  it("allows a slug that is unique for the tenant", async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] });

    await expect(
      ensureUniqueSlug({
        data: { tenant: "tenant-a" },
        originalDoc: undefined,
        req: { payload: { find } },
        value: "unique-slug",
      } as never),
    ).resolves.toBe("unique-slug");
  });

  it("skips the check when the slug is unchanged", async () => {
    const find = vi.fn();

    await expect(
      ensureUniqueSlug({
        data: { tenant: "tenant-a" },
        originalDoc: { slug: "john-doe" },
        req: { payload: { find } },
        value: "john-doe",
      } as never),
    ).resolves.toBe("john-doe");

    expect(find).not.toHaveBeenCalled();
  });
});
