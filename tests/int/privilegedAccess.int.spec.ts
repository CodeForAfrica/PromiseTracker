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
import { describe, expect, it, vi } from "vitest";

const superAdmin: Pick<User, "id" | "roles"> = {
  id: "super-admin",
  roles: ["superAdmin"],
};
const globalEditor: Pick<User, "id" | "roles"> = {
  id: "global-editor",
  roles: ["globalEditor"],
};

const accessArgs = (user: typeof globalEditor | typeof superAdmin | null) =>
  ({
    req: {
      payloadAPI: "REST",
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

  it("denies user and settings administration to global editors", async () => {
    expect(await Users.access?.create?.(accessArgs(globalEditor))).toBe(false);
    expect(await Users.access?.delete?.(accessArgs(globalEditor))).toBe(false);
    expect(await Settings.access?.read?.(accessArgs(globalEditor))).toBe(false);
    expect(await Settings.access?.update?.(accessArgs(globalEditor))).toBe(
      false,
    );
  });

  it("limits global editors to viewing and updating their own account", async () => {
    const selfFilter = { id: { equals: globalEditor.id } };

    expect(await Users.access?.read?.(accessArgs(globalEditor))).toEqual(
      selfFilter,
    );
    expect(await Users.access?.update?.(accessArgs(globalEditor))).toEqual(
      selfFilter,
    );
  });

  it("denies account access to anonymous users", async () => {
    expect(await Users.access?.read?.(accessArgs(null))).toBe(false);
    expect(await Users.access?.update?.(accessArgs(null))).toBe(false);
  });

  it("allows user and settings access to super administrators", async () => {
    expect(await superAdmins(accessArgs(superAdmin))).toBe(true);
    expect(await Users.access?.read?.(accessArgs(superAdmin))).toBe(true);
    expect(await Settings.access?.read?.(accessArgs(superAdmin))).toBe(true);
    expect(await Settings.access?.update?.(accessArgs(superAdmin))).toBe(true);
  });
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

  it("never returns plaintext through the REST API", async () => {
    const result = await readSecretValue({
      req: { payload, payloadAPI: "REST" },
      value: encrypted,
    } as never);

    expect(result).toBe(REDACTED_SECRET_VALUE);
  });

  it("decrypts values for trusted Local API jobs", async () => {
    const result = await readSecretValue({
      req: { payload, payloadAPI: "local" },
      value: encrypted,
    } as never);

    expect(result).toBe("plain-secret");
    expect(payload.decrypt).toHaveBeenCalledWith("ciphertext");
  });
});
