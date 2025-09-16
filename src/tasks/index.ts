import { TaskConfig } from "payload";
import { FetchAirtableDocuments } from "./fetchAirtableDocuments";
import { DownloadDocuments } from "./downloadDocuments";
import { ExtractDocuments } from "./extractDocuments";
import { ExtractPromises } from "./extractPromises";
import { UploadToMeedan } from "./uploadToMeedan";
import { CreateTenantFromAirtable } from "./createTenant";
import { CreatePoliticalEntity } from "./createPoliticalEntity";
import { FetchPromiseStatuses } from "./fetchMeedanpromiseStatus";

export const tasks: TaskConfig[] = [
  CreateTenantFromAirtable,
  FetchAirtableDocuments,
  DownloadDocuments,
  ExtractDocuments,
  ExtractPromises,
  UploadToMeedan,
  CreatePoliticalEntity,
  FetchPromiseStatuses,
];
