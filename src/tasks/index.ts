import { TaskConfig } from "payload";
import { FetchAirtableDocuments } from "./fetchAirtableDocuments";
import { DownloadDocuments } from "./downloadDocuments";
import { ExtractDocuments } from "./extractDocuments";
import { AIExtractor } from "./aiExtractor";
import { UploadToMeedan } from "./uploadToMeedan";
import { CreateTenantFromAirtable } from "./createTenant";
import { CreatePoliticalEntity } from "./createPoliticalEntity";

export const tasks: TaskConfig[] = [
  CreateTenantFromAirtable,
  FetchAirtableDocuments,
  DownloadDocuments,
  ExtractDocuments,
  AIExtractor,
  UploadToMeedan,
  CreatePoliticalEntity,
];
