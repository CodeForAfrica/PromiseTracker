import type {
  MigrateDownArgs,
  MigrateUpArgs,
  MongooseAdapter,
} from "@payloadcms/db-mongodb";

const DEFAULT_BACKFILL_BATCH_SIZE = 100;

type RawExtractionItem = {
  category?: string;
  checkMediaId?: string;
};

type RawAIExtraction = {
  _id: unknown;
  extractions?: RawExtractionItem[];
};

type RawPromise = {
  _id: unknown;
  meedanId?: string;
  category?: string;
};

const getBackfillBatchSize = (): number => {
  const raw = Number(
    process.env.PAYLOAD_PROMISE_CATEGORY_BACKFILL_BATCH_SIZE,
  );
  return Number.isFinite(raw) && raw > 0
    ? Math.floor(raw)
    : DEFAULT_BACKFILL_BATCH_SIZE;
};

const backfillPromiseCategories = async ({
  payload,
}: MigrateUpArgs): Promise<void> => {
  const db = payload.db as MongooseAdapter;
  const aiExtractionsModel = db.collections["ai-extractions"];
  const promisesModel = db.collections.promises;

  if (!aiExtractionsModel || !promisesModel) {
    throw new Error(
      "Failed to resolve one or more collections for promise category backfill",
    );
  }

  const categoryByCheckMediaId = new Map<string, string>();

  const extractionDocs = (await aiExtractionsModel.find(
    {},
    { extractions: 1 },
    { lean: true },
  )) as RawAIExtraction[];

  for (const extractionDoc of extractionDocs) {
    for (const extraction of extractionDoc.extractions ?? []) {
      const checkMediaId = extraction.checkMediaId?.trim();
      const category = extraction.category?.trim();
      if (checkMediaId && category) {
        categoryByCheckMediaId.set(checkMediaId, category);
      }
    }
  }

  const batchSize = getBackfillBatchSize();
  let lastID: unknown;
  let updated = 0;

  payload.logger.info({
    msg: "promiseCategoryBackfill:: Starting migration backfill",
    batchSize,
    knownCategories: categoryByCheckMediaId.size,
  });

  while (true) {
    const batch = (await promisesModel.find(
      lastID ? { _id: { $gt: lastID } } : {},
      { meedanId: 1, category: 1 },
      { lean: true, limit: batchSize, sort: { _id: 1 } },
    )) as RawPromise[];

    if (batch.length === 0) {
      break;
    }

    lastID = batch[batch.length - 1]?._id;

    for (const promise of batch) {
      const meedanId = promise.meedanId?.trim();
      const category = meedanId ? categoryByCheckMediaId.get(meedanId) : undefined;

      if (!category || promise.category?.trim()) {
        continue;
      }

      await promisesModel.collection.updateOne(
        { _id: promise._id } as Record<string, unknown>,
        { $set: { category } },
      );
      updated += 1;
    }
  }

  payload.logger.info({
    msg: "promiseCategoryBackfill:: Completed migration backfill",
    updated,
  });
};

export async function up(args: MigrateUpArgs): Promise<void> {
  await backfillPromiseCategories(args);
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  const db = payload.db as MongooseAdapter;
  const promisesModel = db.collections.promises;

  if (!promisesModel) {
    throw new Error(
      "Failed to resolve promises collection for migration rollback",
    );
  }

  await promisesModel.collection.updateMany({}, { $unset: { category: "" } });
}
