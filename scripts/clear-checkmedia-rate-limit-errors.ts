/**
 * One-off remediation for the pre-fix uploadToMeedan behavior that treated
 * CheckMedia HTTP 429 (rate limit) responses as permanent failures. Clears
 * `uploadError` on extractions whose stored error is a 429 so they become
 * eligible for upload again on the next uploadToMeedan run.
 *
 * Non-429 errors (bad source URLs, GraphQL validation errors, missing
 * entity/tenant, etc.) are left untouched — those are deterministic
 * failures that would just fail again on retry.
 *
 * Dry run (default):
 *   pnpm payload run scripts/clear-checkmedia-rate-limit-errors.ts
 * Apply:
 *   pnpm payload run scripts/clear-checkmedia-rate-limit-errors.ts -- --apply
 */
import { getPayload } from "payload";
import config from "../src/payload.config";

const apply = process.argv.includes("--apply");

const isRateLimitError = (message: string | null | undefined): boolean =>
  Boolean(message) && /HTTP 429|TooManyRequestsError/i.test(message as string);

const payload = await getPayload({ config });

const { docs: extractionDocs } = await payload.find({
  collection: "ai-extractions",
  depth: 0,
  limit: 0,
});

console.log(
  `Found ${extractionDocs.length} ai-extractions docs (apply=${apply})`,
);

let clearedExtractions = 0;
let touchedDocs = 0;

for (const doc of extractionDocs) {
  const extractions = doc.extractions ?? [];
  const matches = extractions.filter((extraction) =>
    isRateLimitError(extraction.uploadError),
  );

  if (matches.length === 0) {
    continue;
  }

  touchedDocs += 1;
  for (const match of matches) {
    console.log(
      JSON.stringify({
        action: apply ? "clear" : "would-clear",
        extractionDocId: doc.id,
        extractionUniqueId: match.uniqueId,
        uploadError: match.uploadError,
      }),
    );
  }

  if (apply) {
    const updatedExtractions = extractions.map((extraction) =>
      isRateLimitError(extraction.uploadError)
        ? { ...extraction, uploadError: null }
        : extraction,
    );
    await payload.update({
      collection: "ai-extractions",
      id: doc.id,
      data: { extractions: updatedExtractions },
    });
  }

  clearedExtractions += matches.length;
}

console.log(
  `Done. ${apply ? "Cleared" : "Would clear"} ${clearedExtractions} extraction(s) across ${touchedDocs} document(s).`,
);

await payload.destroy();
process.exit(0);
