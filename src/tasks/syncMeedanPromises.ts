import { TaskConfig } from "payload";
import {
  fetchPublishedReports,
  PublishedReport,
} from "@/lib/meedan";
import {
  Promise as PromiseDoc,
  AiExtraction as AiExtractionDoc,
  Document as PayloadDocument,
  PromiseStatus as PromiseStatusDoc,
  Media,
} from "@/payload-types";
import { downloadFile } from "@/utils/files";
import { unlink } from "node:fs/promises";

type PromiseData = {
  title: string;
  headline: string;
  description: string;
  text: string;
  introduction: string;
  statusLabel: string;
  themeColor: string;
  imageUrl: string;
  publishedArticleUrl: string;
  useVisualCard: boolean;
  state: string;
  lastPublished: string | null;
  status: string | null;
  politicalEntity: string | null;
  image: string | null;
};

const buildPromiseData = (
  report: PublishedReport,
  statusId: string | null,
  politicalEntityId: string | null,
  image: { mediaId: string | null; sourceUrl: string }
): PromiseData => {
  const coerce = (value: string | null) => value ?? "";

  return {
    title: coerce(report.title),
    headline: coerce(report.headline),
    description: coerce(report.description),
    text: coerce(report.text),
    introduction: coerce(report.introduction),
    statusLabel: coerce(report.statusLabel),
    themeColor: coerce(report.themeColor),
    imageUrl: image.sourceUrl,
    publishedArticleUrl: coerce(report.publishedArticleUrl),
    useVisualCard: report.useVisualCard,
    state: coerce(report.state),
    lastPublished: report.lastPublished ?? null,
    status: statusId,
    politicalEntity: politicalEntityId,
    image: image.mediaId,
  };
};

const getRelationId = (value: unknown): string | null => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "object") {
    const maybeId = (value as { id?: unknown }).id;
    if (typeof maybeId === "string") {
      const trimmed = maybeId.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof maybeId === "number" && Number.isFinite(maybeId)) {
      return String(maybeId);
    }
  }

  return null;
};

const normaliseExistingDoc = (doc: PromiseDoc): PromiseData => {
  const coerce = (value: string | null | undefined) => value ?? "";

  return {
    title: coerce(doc.title),
    headline: coerce(doc.headline),
    description: coerce(doc.description),
    text: coerce(doc.text),
    introduction: coerce(doc.introduction),
    statusLabel: coerce(doc.statusLabel),
    themeColor: coerce(doc.themeColor),
    imageUrl: coerce(doc.imageUrl),
    publishedArticleUrl: coerce(doc.publishedArticleUrl),
    useVisualCard: Boolean(doc.useVisualCard),
    state: coerce(doc.state),
    lastPublished: doc.lastPublished ?? null,
    status: getRelationId(doc.status),
    politicalEntity: getRelationId(doc.politicalEntity),
    image: getRelationId(doc.image as unknown),
  };
};

const haveDifferences = (next: PromiseData, prev: PromiseData): boolean => {
  return Object.entries(next).some(([key, value]) => {
    const prevValue = prev[key as keyof PromiseData];
    return prevValue !== value;
  });
};

export const SyncMeedanPromises: TaskConfig<"syncMeedanPromises"> = {
  slug: "syncMeedanPromises",
  label: "Sync Meedan Promises",
  handler: async ({ req }) => {
    const { payload } = req;
    const { logger } = payload;

    logger.info("syncMeedanPromises:: Starting Meedan promise sync");

    const {
      meedan: { meedanAPIKey, teamId },
    } = await payload.findGlobal({ slug: "settings" });

    if (!meedanAPIKey || !teamId) {
      logger.warn(
        "syncMeedanPromises:: Missing Meedan credentials, skipping sync"
      );
      return { output: { created: 0, updated: 0, total: 0 } };
    }

    const reports = await fetchPublishedReports({
      apiKey: meedanAPIKey,
      teamId,
    });

    if (reports.length === 0) {
      logger.info("syncMeedanPromises:: No published promises returned");
      return { output: { created: 0, updated: 0, total: 0 } };
    }

    const existing = await payload.find({
      collection: "promises",
      limit: -1,
    });

    const { docs: statusDocs } = await payload.find({
      collection: "promise-status",
      limit: -1,
    });

    const statusIdByMeedan = new Map<string, string>();
    for (const status of statusDocs as PromiseStatusDoc[]) {
      const key = status.meedanId?.trim().toLowerCase();
      if (key) {
        statusIdByMeedan.set(key, status.id);
      }
    }

    const { docs: aiExtractionDocs } = await payload.find({
      collection: "ai-extractions",
      limit: -1,
      depth: 2,
    });

    const documentCache = new Map<string, PayloadDocument | null>();

    const resolveDocument = async (
      value: AiExtractionDoc["document"]
    ): Promise<PayloadDocument | null> => {
      if (!value) return null;

      if (typeof value !== "string") {
        return value as PayloadDocument;
      }

      if (documentCache.has(value)) {
        return documentCache.get(value) ?? null;
      }

      try {
        const doc = (await payload.findByID({
          collection: "documents",
          id: value,
          depth: 1,
        })) as PayloadDocument;
        documentCache.set(value, doc);
        return doc;
      } catch (error) {
        logger.warn(
          "syncMeedanPromises:: Failed to resolve document for AI extraction",
          {
            documentId: value,
            error:
              error instanceof Error ? error.message : String(error ?? "") ,
          }
        );
        documentCache.set(value, null);
        return null;
      }
    };

    const extractionEntityIndex = new Map<string, string>();

    for (const extractionDoc of aiExtractionDocs as AiExtractionDoc[]) {
      const document = await resolveDocument(extractionDoc.document);
      const politicalEntityValue = document?.politicalEntity ?? null;
      let politicalEntityId: string | null = null;

      if (politicalEntityValue) {
        politicalEntityId =
          typeof politicalEntityValue === "string"
            ? politicalEntityValue
            : politicalEntityValue.id ?? null;
      }

      if (!politicalEntityId) {
        continue;
      }

      for (const extraction of extractionDoc.extractions ?? []) {
        const checkMediaId = extraction.checkMediaId?.trim();
        if (!checkMediaId) {
          continue;
        }
        extractionEntityIndex.set(checkMediaId, politicalEntityId);
      }
    }

    const existingById = new Map<string, PromiseDoc>();
    const uploadedImages = new Map<string, string>();

    for (const doc of existing.docs as PromiseDoc[]) {
      const key = doc.meedanId?.trim();
      if (key) {
        existingById.set(key, doc);
      }

      const sourceUrl = doc.imageUrl?.trim();
      const imageId = getRelationId(doc.image as unknown);
      if (sourceUrl && imageId) {
        uploadedImages.set(sourceUrl, imageId);
      }
    }

    let created = 0;
    let updated = 0;

    const uploadImageFromUrl = async (
      url: string,
      alt: string
    ): Promise<string | null> => {
      if (uploadedImages.has(url)) {
        return uploadedImages.get(url) ?? null;
      }

      let filePath: string | null = null;
      try {
        filePath = await downloadFile(url);

        const media = (await payload.create({
          collection: "media",
          data: {
            alt,
          },
          filePath,
        })) as Media;

        const mediaId = getRelationId(media);

        if (mediaId) {
          uploadedImages.set(url, mediaId);
        }

        return mediaId ?? null;
      } catch (error) {
        logger.warn("syncMeedanPromises:: Failed to cache image", {
          url,
          error: error instanceof Error ? error.message : String(error ?? ""),
        });
        return null;
      } finally {
        if (filePath) {
          try {
            await unlink(filePath);
          } catch (cleanupError) {
            logger.warn("syncMeedanPromises:: Failed to remove temp image", {
              url,
              error:
                cleanupError instanceof Error
                  ? cleanupError.message
                  : String(cleanupError ?? ""),
            });
          }
        }
      }
    };

    const resolveImageForReport = async (
      report: PublishedReport,
      existingData: PromiseData | undefined
    ): Promise<{ mediaId: string | null; sourceUrl: string }> => {
      const remoteUrl = report.image?.trim() ?? "";

      if (!remoteUrl) {
        return {
          mediaId: null,
          sourceUrl: "",
        };
      }

      if (
        existingData &&
        existingData.imageUrl === remoteUrl &&
        existingData.image
      ) {
        return {
          mediaId: existingData.image,
          sourceUrl: remoteUrl,
        };
      }

      const cached = uploadedImages.get(remoteUrl);
      if (cached) {
        return {
          mediaId: cached,
          sourceUrl: remoteUrl,
        };
      }

      const alt =
        report.title ??
        report.headline ??
        report.description ??
        "Meedan promise image";

      const mediaId = await uploadImageFromUrl(remoteUrl, alt);

      if (!mediaId) {
        return {
          mediaId: existingData?.image ?? null,
          sourceUrl: existingData?.imageUrl ?? remoteUrl,
        };
      }

      return {
        mediaId,
        sourceUrl: remoteUrl,
      };
    };

    for (const report of reports) {
      const meedanId = report.meedanId;
      if (!meedanId) {
        logger.warn("syncMeedanPromises:: Report missing Meedan ID, skipping");
        continue;
      }
      const statusKey = report.status?.trim().toLowerCase() ?? null;
      const statusId = statusKey ? statusIdByMeedan.get(statusKey) ?? null : null;

      if (statusKey && !statusId) {
        logger.warn("syncMeedanPromises:: Missing status mapping", {
          meedanStatus: report.status,
        });
      }

      const politicalEntityId = meedanId
        ? extractionEntityIndex.get(meedanId) ?? null
        : null;

      if (meedanId && !politicalEntityId) {
        logger.warn("syncMeedanPromises:: Unable to resolve political entity", {
          meedanId,
        });
      }

      const stored = existingById.get(meedanId);
      const existingData = stored ? normaliseExistingDoc(stored) : undefined;
      const imageInfo = await resolveImageForReport(report, existingData);
      const data = buildPromiseData(
        report,
        statusId ?? null,
        politicalEntityId,
        imageInfo
      );

      if (!stored) {
        await payload.create({
          collection: "promises",
          data: {
            meedanId: report.meedanId,
            ...data,
          },
        });
        created += 1;
        logger.info("syncMeedanPromises:: Created promise", {
          meedanId: report.meedanId,
        });
        continue;
      }

      const currentData = existingData ?? normaliseExistingDoc(stored);

      if (!haveDifferences(data, currentData)) {
        continue;
      }

      await payload.update({
        collection: "promises",
        id: stored.id,
        data,
      });

      updated += 1;
      logger.info("syncMeedanPromises:: Updated promise", {
        meedanId: report.meedanId,
      });
    }

    logger.info("syncMeedanPromises:: Completed", {
      total: reports.length,
      created,
      updated,
    });

    return {
      output: {
        total: reports.length,
        created,
        updated,
      },
    };
  },
};
