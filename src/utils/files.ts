import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const mimeToExtension: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    ".pptx",
  "text/plain": ".txt",
  "text/html": ".html",
  "text/csv": ".csv",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "application/json": ".json",
  "application/xml": ".xml",
  "application/zip": ".zip",
  "application/x-rar-compressed": ".rar",
  "application/gzip": ".gz",
  "audio/mpeg": ".mp3",
  "video/mp4": ".mp4",
  "video/mpeg": ".mpeg",
};

const fileName = fileURLToPath(import.meta.url);
const dirName = dirname(fileName);
const tempDir = join(dirName, "..", "..", "temp");

export const downloadFile = async (url: string) => {
  if (!existsSync(tempDir)) {
    await mkdir(tempDir, { recursive: true });
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Error downloading file from: ${url}. Status ${res.status}, Error: ${res.statusText}`
    );
  }

  const fileName = `file-${randomUUID()}`;

  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type")?.split(";")[0] || "";
  const extension = mimeToExtension[contentType] || "";
  const docFileName = `${fileName}${extension}`;
  const filePath = join(tempDir, docFileName);
  await writeFile(filePath, Buffer.from(buffer), { flag: "w" });
  return filePath;
};
