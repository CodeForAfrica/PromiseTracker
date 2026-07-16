import { isSuperAdmin, superAdmins } from "@/access/roles";
import { Users } from "@/collections/Users";
import {
  ENCRYPTED_SECRET_PREFIX,
  REDACTED_SECRET_VALUE,
  encryptSecretValue,
  readSecretValue,
} from "@/fields/encryptedSecret";
import { Settings } from "@/globals/Settings";
import type { User } from "@/payload-types";
import type { PayloadRequest } from "payload";
import { describe, expect, it, vi } from "vitest";

const superAdmin: Pick<User, "id" | "roles"> = {
  id: "super-admin",
  roles: ["superAdmin"],
};
const globalEditor: Pick<User, "id" | "roles"> = {
  id: "global-editor",
  roles: ["globalEditor"],
};

const accessArgs = (
  user: typeof globalEditor | typeof superAdmin | null,
  payloadAPI: PayloadRequest["payloadAPI"],
) =>
  ({
    req: {
      payloadAPI,
      user,
    },
  }) as never;

describe("privileged access", () => {
  it("recognizes only the superAdmin role as privileged", () => {
    expect(isSuperAdmin(superAdmin)).toBe(true);
    expect(isSuperAdmin(globalEditor)).toBe(false);
    expect(isSuperAdmin({ roles: [] })).toBe(false);
    expect(isSuperAdmin(null)).toBe(false);
  });

  it.each(["REST", "GraphQL"] as const)(
    "denies %s user and settings access to global editors",
    async (payloadAPI) => {
      expect(
        await Users.access?.create?.(accessArgs(globalEditor, payloadAPI)),
      ).toBe(false);
      expect(
        await Users.access?.delete?.(accessArgs(globalEditor, payloadAPI)),
      ).toBe(false);
      expect(
        await Settings.access?.read?.(accessArgs(globalEditor, payloadAPI)),
      ).toBe(false);
      expect(
        await Settings.access?.update?.(accessArgs(globalEditor, payloadAPI)),
      ).toBe(false);
    },
  );

  it.each(["REST", "GraphQL"] as const)(
    "limits %s global editors to viewing and updating their own account",
    async (payloadAPI) => {
      const selfFilter = { id: { equals: globalEditor.id } };

      expect(
        await Users.access?.read?.(accessArgs(globalEditor, payloadAPI)),
      ).toEqual(selfFilter);
      expect(
        await Users.access?.update?.(accessArgs(globalEditor, payloadAPI)),
      ).toEqual(selfFilter);
    },
  );

  it.each(["REST", "GraphQL"] as const)(
    "denies %s account access to anonymous users",
    async (payloadAPI) => {
      expect(await Users.access?.read?.(accessArgs(null, payloadAPI))).toBe(
        false,
      );
      expect(await Users.access?.update?.(accessArgs(null, payloadAPI))).toBe(
        false,
      );
    },
  );

  it.each(["REST", "GraphQL"] as const)(
    "allows %s user and settings access to super administrators",
    async (payloadAPI) => {
      expect(await superAdmins(accessArgs(superAdmin, payloadAPI))).toBe(true);
      expect(
        await Users.access?.read?.(accessArgs(superAdmin, payloadAPI)),
      ).toBe(true);
      expect(
        await Settings.access?.read?.(accessArgs(superAdmin, payloadAPI)),
      ).toBe(true);
      expect(
        await Settings.access?.update?.(accessArgs(superAdmin, payloadAPI)),
      ).toBe(true);
    },
  );
});

describe("encrypted credential fields", () => {
  const encrypted = `${ENCRYPTED_SECRET_PREFIX}ciphertext`;
  const payload = {
    decrypt: vi.fn(() => "plain-secret"),
    encrypt: vi.fn(() => "ciphertext"),
  };

  it("encrypts new values before persistence", async () => {
    const result = await encryptSecretValue({
      req: { payload },
      value: "plain-secret",
    } as never);

    expect(result).toBe(encrypted);
    expect(payload.encrypt).toHaveBeenCalledWith("plain-secret");
  });

  it("preserves the encrypted value when a redacted form is saved", async () => {
    const result = await encryptSecretValue({
      previousValue: encrypted,
      req: { payload },
      value: REDACTED_SECRET_VALUE,
    } as never);

    expect(result).toBe(encrypted);
  });

  it.each(["REST", "GraphQL"] as const)(
    "never returns plaintext through %s",
    async (payloadAPI) => {
      const result = await readSecretValue({
        req: { payload, payloadAPI },
        value: encrypted,
      } as never);

      expect(result).toBe(REDACTED_SECRET_VALUE);
    },
  );

  it("decrypts values for trusted Local API jobs", async () => {
    const result = await readSecretValue({
      req: { payload, payloadAPI: "local" },
      value: encrypted,
    } as never);

    expect(result).toBe("plain-secret");
    expect(payload.decrypt).toHaveBeenCalledWith("ciphertext");
  });
});
