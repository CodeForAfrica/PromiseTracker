"use client";

import {
  Button,
  SaveButton,
  toast,
  useConfig,
  useField,
  useForm,
  useFormModified,
  useTranslation,
} from "@payloadcms/ui";
import { formatAdminURL } from "payload/shared";
import React from "react";

/**
 * Forks @payloadcms/plugin-import-export's ExportSaveButton to fix two
 * issues with its Download button once an export has already been saved:
 *
 * 1. It's disabled via `disabled: !modified` — as soon as the doc is saved,
 *    the form is no longer "modified", so the button becomes permanently
 *    unclickable the next time the doc is opened.
 * 2. Even when enabled, it always POSTs to `/exports/download` to
 *    regenerate a brand-new file from the current form fields rather than
 *    serving the file already attached to the doc.
 *
 * Here, whenever the doc already has a saved file, Download just opens that
 * file directly. Regeneration is kept as a fallback for brand-new/edited
 * exports that have no saved file yet.
 */
export const ExportSaveButtonFixed = () => {
  const { t } = useTranslation();
  const {
    config: {
      routes: { api },
    },
    getEntityConfig,
  } = useConfig();
  const { getData, setModified } = useForm();
  const modified = useFormModified();
  const { value: targetCollectionSlug } = useField({
    path: "collectionSlug",
  });
  const targetCollectionConfig = getEntityConfig({
    collectionSlug: targetCollectionSlug as string,
  });
  const targetPluginConfig = (
    targetCollectionConfig?.admin?.custom as
      | { ["plugin-import-export"]?: { disableSave?: boolean; disableDownload?: boolean } }
      | undefined
  )?.["plugin-import-export"];
  const exportsCollectionConfig = getEntityConfig({
    collectionSlug: "exports",
  });
  const exportsAdminCustom = exportsCollectionConfig?.admin?.custom as
    | { disableSave?: boolean; disableDownload?: boolean }
    | undefined;
  const disableSave =
    targetPluginConfig?.disableSave ?? exportsAdminCustom?.disableSave === true;
  const disableDownload =
    targetPluginConfig?.disableDownload ??
    exportsAdminCustom?.disableDownload === true;
  const label = t("general:save");

  const downloadSavedFile = (url: string, filename?: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename ?? "";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const regenerateAndDownload = async (data: Record<string, unknown>) => {
    let timeoutID: ReturnType<typeof setTimeout> | null = null;
    let toastID: string | number | null = null;
    try {
      setModified(false);
      timeoutID = setTimeout(() => {
        toastID = toast.success("Your export is being processed...");
      }, 200);
      const response = await fetch(
        formatAdminURL({ apiRoute: api, path: "/exports/download" }),
        {
          body: JSON.stringify({ data }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      if (timeoutID) {
        clearTimeout(timeoutID);
      }
      if (toastID) {
        toast.dismiss(toastID);
      }
      if (!response.ok) {
        let errorMsg = "Failed to download file";
        try {
          const errorJson = await response.json();
          if (errorJson?.errors?.[0]?.message) {
            errorMsg = errorJson.errors[0].message;
          }
        } catch {
          // Ignore JSON parse errors, fallback to generic message
        }
        throw new Error(errorMsg);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      downloadSavedFile(url, `${data.name}-${data.collectionSlug}.${data.format}`);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error downloading file");
    }
  };

  const handleDownload = async () => {
    const data = getData();

    if (!modified && typeof data?.url === "string" && data.url) {
      downloadSavedFile(data.url, typeof data.filename === "string" ? data.filename : undefined);
      return;
    }

    await regenerateAndDownload(data);
  };

  return (
    <React.Fragment>
      {!disableSave && <SaveButton label={label} />}
      {!disableDownload && (
        <Button size="medium" type="button" onClick={handleDownload}>
          {t("upload:download")}
        </Button>
      )}
    </React.Fragment>
  );
};
