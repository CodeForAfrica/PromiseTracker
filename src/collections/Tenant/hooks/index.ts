import { countriesByContinent, getCountryFlag } from "@/data/countries";
import { deleteAIExtractionExportRowsForTenant } from "@/lib/aiExtractionExportRows";
import { queueAIExtractionExportRowsSync } from "@/lib/aiExtractionExportRowsJobs";
import type { Tenant } from "@/payload-types";
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionAfterReadHook,
} from "payload";

export const queueAIExtractionExportRowsSyncAfterTenantChange: CollectionAfterChangeHook<
  Tenant
> = async ({ doc, req }) => {
  await queueAIExtractionExportRowsSync({
    errorMessage:
      "Failed to queue AI extraction export row sync after tenant change",
    input: {
      scope: "tenant",
      tenantId: String(doc.id),
    },
    logContext: {
      tenantId: String(doc.id),
    },
    req,
  });

  return doc;
};

export const deleteAIExtractionExportRowsAfterTenantDelete: CollectionAfterDeleteHook<
  Tenant
> = async ({ doc, req }) => {
  try {
    await deleteAIExtractionExportRowsForTenant({
      payload: req.payload,
      req,
      tenantId: String(doc.id),
    });
  } catch (err) {
    req.payload.logger.error({
      err,
      msg: "Failed to delete AI extraction export rows after tenant delete",
      tenantId: String(doc.id),
    });
  }

  return doc;
};

export const populateTenantFlagAfterRead: CollectionAfterReadHook<
  Tenant
> = async ({ doc }) => {
  const tenantWithFlag = doc as Tenant & { flag?: string | null };
  tenantWithFlag.flag = getCountryFlag(doc.country);
  return tenantWithFlag;
};

export const TENANT_COUNTRY_OPTIONS = countriesByContinent("Africa");
