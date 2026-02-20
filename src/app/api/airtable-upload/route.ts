import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlink, writeFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";

import { getGlobalPayload } from "@/lib/payload";
import {
  getCorsHeaders,
  isAuthorizedUploadRequest,
  parseUploadKind,
  resolveAbsoluteMediaUrl,
  sanitizeUploadFileName,
  validateFileForUpload,
} from "./utils";

export const runtime = "nodejs";

type UploadSuccessResponse = {
  ok: true;
  url: string;
  filename: string;
  mimeType: string;
  filesize: number;
  mediaId: string;
};

const jsonResponse = <T extends Record<string, unknown>>(
  request: NextRequest,
  status: number,
  body: T,
) => {
  return NextResponse.json(body, {
    status,
    headers: getCorsHeaders(request.headers.get("origin")),
  });
};

export const OPTIONS = async (request: NextRequest) => {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get("origin")),
  });
};

export const POST = async (request: NextRequest) => {
  if (!isAuthorizedUploadRequest(request.headers.get("authorization"))) {
    return jsonResponse(request, 401, {
      ok: false,
      error: "Unauthorized",
    });
  }

  let tempFilePath: string | null = null;

  try {
    const formData = await request.formData();
    const kind = parseUploadKind(formData.get("kind"));

    if (!kind) {
      return jsonResponse(request, 400, {
        ok: false,
        error: 'Missing or invalid "kind". Use "document" or "entityImage".',
      });
    }

    const fileValue = formData.get("file");
    if (!(fileValue instanceof File)) {
      return jsonResponse(request, 400, {
        ok: false,
        error: 'Missing "file" upload payload.',
      });
    }

    const validationResult = validateFileForUpload(fileValue, kind);
    if (!validationResult.ok) {
      return jsonResponse(request, validationResult.status, {
        ok: false,
        error: validationResult.message,
      });
    }

    const payload = await getGlobalPayload();
    const fileBuffer = Buffer.from(await fileValue.arrayBuffer());
    const safeName = sanitizeUploadFileName(fileValue.name || "upload");
    tempFilePath = join(tmpdir(), `${randomUUID()}-${safeName}`);

    await writeFile(tempFilePath, fileBuffer, { flag: "w" });

    const altValue = formData.get("alt");
    const alt =
      typeof altValue === "string" && altValue.trim().length > 0
        ? altValue.trim()
        : fileValue.name || `${kind} upload`;

    const createdMedia = await payload.create({
      collection: "media",
      data: {
        alt,
      },
      filePath: tempFilePath,
      depth: 0,
    });

    const mediaDoc = await payload.findByID({
      collection: "media",
      id: createdMedia.id,
      depth: 0,
    });

    if (!mediaDoc?.url) {
      return jsonResponse(request, 500, {
        ok: false,
        error: "Upload succeeded but media URL is unavailable.",
      });
    }

    const absoluteUrl = resolveAbsoluteMediaUrl(
      mediaDoc.url,
      request.nextUrl.origin,
    );

    if ((mediaDoc.externalUrl ?? "").trim() !== absoluteUrl) {
      await payload.update({
        collection: "media",
        id: mediaDoc.id,
        data: {
          externalUrl: absoluteUrl,
        },
        depth: 0,
      });
    }

    const responseBody: UploadSuccessResponse = {
      ok: true,
      url: absoluteUrl,
      filename: mediaDoc.filename ?? fileValue.name,
      mimeType: mediaDoc.mimeType ?? fileValue.type ?? "application/octet-stream",
      filesize: mediaDoc.filesize ?? fileValue.size,
      mediaId: mediaDoc.id,
    };

    return jsonResponse(request, 200, responseBody);
  } catch (error) {
    return jsonResponse(request, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Upload failed.",
    });
  } finally {
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
      } catch (_cleanupError) {
        // Ignore cleanup failures for temporary upload files.
      }
    }
  }
};
