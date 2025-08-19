import { TaskConfig } from 'payload'
import { FetchAirtableDocuments } from './fetchAirtableDocuments'
import { DownloadDocuments } from './downloadDocuments'
import { ExtractDocuments } from './extractDocuments'
import { AISummarizer } from './aiSummarizer'
import { UploadToMeedan } from './uploadToMeedan'

export const tasks: TaskConfig[] = [
  FetchAirtableDocuments,
  DownloadDocuments,
  ExtractDocuments,
  AISummarizer,
  UploadToMeedan,
]
