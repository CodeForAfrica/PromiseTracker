import { getTranslation } from "@payloadcms/translations";
import { CollectionSlug, PayloadRequest } from "payload";
import { ExportBeforeHook } from "@payloadcms/plugin-import-export/types";

const titleCase = (key: string): string =>
  key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase());

const getFieldLabelMap = (
  req: PayloadRequest,
  collectionSlug: CollectionSlug,
): Map<string, string> => {
  const collectionConfig = req.payload.collections[collectionSlug]?.config;
  const map = new Map<string, string>();

  for (const field of collectionConfig?.flattenedFields ?? []) {
    if (!("name" in field) || typeof field.name !== "string") {
      continue;
    }

    const label = "label" in field ? field.label : undefined;
    map.set(
      field.name,
      label ? String(getTranslation(label, req.i18n)) : titleCase(field.name),
    );
  }

  return map;
};

/**
 * Renames export row keys from raw field names (e.g. "tenantName") to their
 * configured admin labels (e.g. "Tenant Name") so downloaded CSV/JSON exports
 * are human-readable rather than showing internal field names.
 */
export const createExportHeaderHook =
  (collectionSlug: CollectionSlug): ExportBeforeHook =>
  ({ data, req }) => {
    const labelMap = getFieldLabelMap(req, collectionSlug);

    return data.map((row) => {
      const relabeledRow: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        relabeledRow[labelMap.get(key) ?? titleCase(key)] = value;
      }
      return relabeledRow;
    });
  };
