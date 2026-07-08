import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { Media } from "@/collections/Media";

describe("Media beforeChange hook", () => {
  const runHook = (args: Record<string, unknown>) => {
    const hook = Media.hooks?.beforeChange?.[0];
    if (typeof hook !== "function") {
      throw new Error("Media beforeChange hook is not defined");
    }
    return hook(args as never);
  };

  it("sets the checksum from the uploaded file", async () => {
    const fileData = Buffer.from("image bytes");
    const result = await runHook({
      data: { alt: "Entity image" },
      req: { file: { data: fileData } },
    });

    expect(result).toEqual({
      alt: "Entity image",
      checksum: createHash("sha256").update(fileData).digest("hex"),
    });
  });

  it("leaves data untouched when no file is uploaded", async () => {
    const result = await runHook({
      data: { alt: "Entity image" },
      req: {},
    });

    expect(result).toEqual({ alt: "Entity image" });
  });
});
