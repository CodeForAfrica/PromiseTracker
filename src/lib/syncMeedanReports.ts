import { unlink } from "node:fs/promises";

import type {
  AiExtraction as AiExtractionDoc,
  Document as PayloadDocument,
  Media,
  Promise as PromiseDoc,
} from "@/payload-types";
import type { PublishedReport } from "@/lib/meedan";
import { getGlobalPayload } from "@/lib/payload";
import { downloadFile } from "@/utils/files";

type PromiseData = {
  title: string;
  description: string;
  status: string | null;
  publishStatus: string;
  politicalEntity: string | null;
  image: string | null;
  url: string;
};

const buildPromiseData = (
  report: PublishedReport,
  statusId: string | null,
  politicalEntityId: string | null,
  imageId: string | null,
  rawPublishStatus: string | null
): PromiseData => {
  const coerce = (value: string | null | undefined) => value ?? "";

  return {
    title: coerce(report.title),
    description: coerce(report.description),
    status: statusId,
    publishStatus: coerce(rawPublishStatus),
    politicalEntity: politicalEntityId,
    image: imageId,
    url: coerce(report.url),
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
    description: coerce(doc.description),
    status: getRelationId(doc.status),
    publishStatus: coerce(doc.publishStatus),
    politicalEntity: getRelationId(doc.politicalEntity),
    image: getRelationId(doc.image as unknown),
    url: coerce(doc.url),
  };
};

const haveDifferences = (next: PromiseData, prev: PromiseData): boolean => {
  return Object.entries(next).some(([key, value]) => {
    const prevValue = prev[key as keyof PromiseData];
    return prevValue !== value;
  });
};

export interface SyncMeedanReportsResult {
  total: number;
  created: number;
  updated: number;
}

export interface SyncMeedanReportsArgs {
  reports: PublishedReport[];
}

export const syncMeedanReports = async ({
  reports,
}: SyncMeedanReportsArgs): Promise<SyncMeedanReportsResult> => {
  const payload = await getGlobalPayload();
  const logger = payload.logger ?? console;

  const sanitisedReports = reports
    .map((report) => ({
      ...report,
      meedanId: report.meedanId?.trim() ?? "",
    }))
    .filter((report) => {
      if (!report.meedanId) {
        logger.warn("syncMeedanReports:: Report missing Meedan ID, skipping");
        return false;
      }
      return true;
    });

  if (sanitisedReports.length === 0) {
    return { total: 0, created: 0, updated: 0 };
  }

  const uniqueIds = Array.from(
    new Set(sanitisedReports.map((report) => report.meedanId))
  );

  let existingDocs: PromiseDoc[] = [];
  if (uniqueIds.length > 0) {
    const existing = await payload.find({
      collection: "promises",
      limit: uniqueIds.length,
      where: {
        meedanId: {
          in: uniqueIds,
        },
      },
    });
    existingDocs = existing.docs as PromiseDoc[];
  }

  const existingById = new Map<string, PromiseDoc>();
  const uploadedImages = new Map<string, string>();
  const mediaCache = new Map<string, Media | null>();

  for (const doc of existingDocs) {
    const key = doc.meedanId?.trim();
    if (key) {
      existingById.set(key, doc);
    }
  }

  const { docs: aiExtractionDocsRaw } = await payload.find({
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
      logger.warn({
        message:
          "syncMeedanReports:: Failed to resolve document for AI extraction",
        documentId: value,
        error: error instanceof Error ? error.message : String(error ?? ""),
      });
      documentCache.set(value, null);
      return null;
    }
  };

  const extractionEntityIndex = new Map<string, string>();

  for (const extractionDoc of aiExtractionDocsRaw as AiExtractionDoc[]) {
    const document = await resolveDocument(extractionDoc.document);
    const politicalEntityValue = document?.politicalEntity ?? null;
    let politicalEntityId: string | null = null;

    if (politicalEntityValue) {
      politicalEntityId =
        typeof politicalEntityValue === "string"
          ? politicalEntityValue
          : (politicalEntityValue.id ?? null);
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
          externalUrl: url,
        },
        filePath,
      })) as Media;

      const mediaId = getRelationId(media);

      if (mediaId) {
        uploadedImages.set(url, mediaId);
      }

      return mediaId ?? null;
    } catch (error) {
      logger.warn({
        message: "syncMeedanReports:: Failed to cache image",
        url,
        error: error instanceof Error ? error.message : String(error ?? ""),
      });
      return null;
    } finally {
      if (filePath) {
        try {
          await unlink(filePath);
        } catch (cleanupError) {
          logger.warn({
            message: "syncMeedanReports:: Failed to remove temp image",
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

  const resolveMediaRecord = async (id: string): Promise<Media | null> => {
    if (mediaCache.has(id)) {
      return mediaCache.get(id) ?? null;
    }

    try {
      const mediaDoc = (await payload.findByID({
        collection: "media",
        id,
        depth: 0,
      })) as Media;

      mediaCache.set(id, mediaDoc);
      return mediaDoc;
    } catch (error) {
      logger.warn({
        message: "syncMeedanReports:: Failed to resolve media",
        mediaId: id,
        error: error instanceof Error ? error.message : String(error ?? ""),
      });
      mediaCache.set(id, null);
      return null;
    }
  };

  const resolveImageForReport = async (
    report: PublishedReport,
    existingData: PromiseData | undefined
  ): Promise<string | null> => {
    const remoteUrl = report.image?.trim() ?? "";

    if (!remoteUrl) {
      return existingData?.image ?? null;
    }

    const cached = uploadedImages.get(remoteUrl);
    if (cached) {
      return cached;
    }

    const existingImageId = existingData?.image ?? null;

    if (existingImageId) {
      const mediaDoc = await resolveMediaRecord(existingImageId);
      const storedSource = mediaDoc?.externalUrl?.trim() ?? "";

      if (storedSource && storedSource === remoteUrl) {
        uploadedImages.set(remoteUrl, existingImageId);
        return existingImageId;
      }
    }

    const alt = report.title ?? report.description ?? "Meedan promise image";

    const mediaId = await uploadImageFromUrl(remoteUrl, alt);

    if (!mediaId) {
      return existingImageId ?? null;
    }

    uploadedImages.set(remoteUrl, mediaId);

    return mediaId;
  };

  for (const report of sanitisedReports) {
    const statusValue =
      typeof report.status === "string" ? report.status.trim() : "";
    const reportStatusValue =
      typeof report.reportStatus === "string"
        ? report.reportStatus.trim()
        : "";

    let resolvedStatusId: string | null = null;

    if (statusValue) {
      const statusQuery = await payload.find({
        collection: "promise-status",
        limit: 1,
        depth: 0,
        where: {
          meedanId: {
            equals: statusValue,
          },
        },
      });

      const statusDoc = statusQuery.docs[0];

      if (!statusDoc) {
        logger.warn({
          message: "syncMeedanReports:: Missing status mapping",
          meedanStatus: statusValue,
        });
      } else {
        resolvedStatusId = statusDoc.id;
      }
    }

    const stored = existingById.get(report.meedanId);
    const existingData = stored ? normaliseExistingDoc(stored) : undefined;
    const extractionPoliticalEntityId =
      extractionEntityIndex.get(report.meedanId) ?? null;

    const politicalEntityId =
      extractionPoliticalEntityId ?? existingData?.politicalEntity ?? null;

    if (!politicalEntityId) {
      logger.warn({
        message: "syncMeedanReports:: Unable to resolve political entity",
        meedanId: report.meedanId,
      });
    }
    const imageId = await resolveImageForReport(report, existingData);
    const data = buildPromiseData(
      report,
      resolvedStatusId,
      politicalEntityId,
      imageId,
      reportStatusValue
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
      logger.info({
        message: "syncMeedanReports:: Created promise",
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
    logger.info({
      message: "syncMeedanReports:: Updated promise",
      meedanId: report.meedanId,
    });
  }

  return {
    total: sanitisedReports.length,
    created,
    updated,
  };
};
