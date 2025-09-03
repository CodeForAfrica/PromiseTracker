import { TaskConfig } from "payload";
import { FetchAirtableDocuments } from "./fetchAirtableDocuments";
import { DownloadDocuments } from "./downloadDocuments";
import { ExtractDocuments } from "./extractDocuments";
import { AIExtractor } from "./aiExtractor";
import { UploadToMeedan } from "./uploadToMeedan";

export const tasks: TaskConfig[] = [
  FetchAirtableDocuments,
  DownloadDocuments,
  ExtractDocuments,
  AIExtractor,
  UploadToMeedan,
];
