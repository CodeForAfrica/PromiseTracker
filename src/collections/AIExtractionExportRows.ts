import { AI_EXTRACTION_EXPORT_ROWS_COLLECTION } from "@/lib/aiExtractionExportRows";
import { CollectionConfig, Field } from "payload";

const disabledExportRelationship = {
  "plugin-import-export": {
    disabled: true,
  },
};

const relationshipField = ({
  name,
  relationTo,
}: {
  name: string;
  relationTo:
    | "ai-extractions"
    | "documents"
    | "political-entities"
    | "promise-status"
    | "tenants";
}): Field => ({
  name,
  type: "relationship",
  relationTo,
  admin: {
    hidden: true,
  },
  custom: disabledExportRelationship,
});

const textField = (name: string, label: string): Field => ({
  name,
  type: "text",
  label,
  admin: {
    readOnly: true,
  },
});

export const AIExtractionExportRows: CollectionConfig = {
  slug: AI_EXTRACTION_EXPORT_ROWS_COLLECTION,
  labels: {
    singular: "AI Extraction Export Row",
    plural: "AI Extraction Export Rows",
  },
  admin: {
    defaultColumns: [
      "tenantName",
      "politicalEntityName",
      "documentTitle",
      "category",
      "summary",
      "statusLabel",
    ],
    group: {
      en: "Documents",
      fr: "Documents",
    },
    useAsTitle: "summary",
  },
  access: {
    create: () => false,
    delete: () => false,
    read: ({ req }) => Boolean(req.user),
    update: () => false,
  },
  fields: [
    {
      name: "uniqueKey",
      type: "text",
      unique: true,
      index: true,
      required: true,
      admin: {
        hidden: true,
        readOnly: true,
      },
      custom: disabledExportRelationship,
    },
    relationshipField({
      name: "aiExtraction",
      relationTo: "ai-extractions",
    }),
    relationshipField({
      name: "document",
      relationTo: "documents",
    }),
    relationshipField({
      name: "politicalEntity",
      relationTo: "political-entities",
    }),
    relationshipField({
      name: "tenant",
      relationTo: "tenants",
    }),
    relationshipField({
      name: "status",
      relationTo: "promise-status",
    }),
    textField("tenantId", "Tenant ID"),
    textField("tenantName", "Tenant Name"),
    textField("tenantCountry", "Tenant Country"),
    textField("tenantLocale", "Tenant Locale"),
    textField("politicalEntityId", "Political Entity ID"),
    textField("politicalEntityName", "Political Entity Name"),
    textField("politicalEntitySlug", "Political Entity Slug"),
    textField("politicalEntityPosition", "Political Entity Position"),
    textField("documentId", "Document ID"),
    textField("documentTitle", "Document Title"),
    textField("documentUrl", "Document URL"),
    textField("documentLanguage", "Document Language"),
    textField("documentType", "Document Type"),
    textField("documentAirtableID", "Document Airtable ID"),
    textField("aiExtractionId", "AI Extraction ID"),
    textField("aiExtractionTitle", "AI Extraction Title"),
    textField("extractionRowId", "Extraction Row ID"),
    textField("uniqueId", "Unique ID"),
    textField("category", "Category"),
    textField("summary", "Summary"),
    {
      name: "source",
      type: "textarea",
      label: "Source",
      admin: {
        readOnly: true,
      },
    },
    textField("statusId", "Status ID"),
    textField("statusLabel", "Status Label"),
    textField("statusMeedanId", "Status Meedan ID"),
    textField("checkMediaId", "CheckMedia ID"),
    textField("checkMediaURL", "CheckMedia URL"),
    textField("uploadError", "Upload Error"),
  ],
};
