/**
 * Cleans up promises duplicated by the meedan-sync webhook meedanId
 * overwrite bug: the webhook rewrote a promise's meedanId from the canonical
 * ProjectMedia global ID to an annotation ID, and the next workflow sync
 * created a fresh promise under the canonical ID.
 *
 * An orphan is a promise whose meedanId does not decode to "ProjectMedia/<n>".
 * Each orphan is matched to its canonical sibling by title + political entity
 * and deleted only when exactly one unambiguous match exists — the canonical
 * copy is refreshed by the workflow sync every run, so the orphan holds no
 * unique data.
 *
 * Dry run (default):
 *   pnpm payload run scripts/dedupe-meedan-promises.ts
 * Apply deletions:
 *   pnpm payload run scripts/dedupe-meedan-promises.ts -- --apply
 */
import { getPayload } from "payload";
import config from "../src/payload.config";

const apply = process.argv.includes("--apply");

const decodeProjectMediaId = (meedanId: string): string | null => {
  try {
    const decoded = Buffer.from(meedanId, "base64").toString("utf8");
    const match = /^ProjectMedia\/(\d+)$/.exec(decoded);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
};

const getRelationId = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "id" in value) {
    return String((value as { id: unknown }).id ?? "");
  }
  return "";
};

const matchKey = (doc: {
  title?: string | null;
  politicalEntity?: unknown;
}): string =>
  `${(doc.title ?? "").trim().toLowerCase()}::${getRelationId(doc.politicalEntity)}`;

const payload = await getPayload({ config });

const { docs: promises } = await payload.find({
  collection: "promises",
  depth: 0,
  limit: 0,
});

console.log(`Found ${promises.length} promises (apply=${apply})`);

const canonicalByKey = new Map<string, typeof promises>();
const orphans: typeof promises = [];

for (const promise of promises) {
  const meedanId = (promise.meedanId ?? "").trim();
  if (meedanId && decodeProjectMediaId(meedanId)) {
    const key = matchKey(promise);
    canonicalByKey.set(key, [...(canonicalByKey.get(key) ?? []), promise]);
  } else {
    orphans.push(promise);
  }
}

console.log(
  `Canonical promises: ${promises.length - orphans.length}, orphans: ${orphans.length}`,
);

let deleted = 0;
let skipped = 0;

for (const orphan of orphans) {
  const candidates = canonicalByKey.get(matchKey(orphan)) ?? [];

  if (candidates.length !== 1) {
    skipped += 1;
    console.log(
      JSON.stringify({
        action: "skip",
        reason:
          candidates.length === 0
            ? "no canonical sibling with same title + political entity"
            : `ambiguous: ${candidates.length} canonical siblings`,
        orphanId: orphan.id,
        orphanMeedanId: orphan.meedanId,
        title: orphan.title,
      }),
    );
    continue;
  }

  const canonical = candidates[0];
  console.log(
    JSON.stringify({
      action: apply ? "delete" : "would-delete",
      orphanId: orphan.id,
      orphanMeedanId: orphan.meedanId,
      keptId: canonical.id,
      keptMeedanId: canonical.meedanId,
      title: orphan.title,
    }),
  );

  if (apply) {
    await payload.delete({
      collection: "promises",
      id: orphan.id,
    });
    deleted += 1;
  }
}

console.log(
  `Done. ${apply ? `Deleted ${deleted}` : `Would delete ${orphans.length - skipped}`}, skipped ${skipped}.`,
);

await payload.destroy();
process.exit(0);
