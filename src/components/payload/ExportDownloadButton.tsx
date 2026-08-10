"use client";

import { Button, useDocumentInfo, useTranslation } from "@payloadcms/ui";

/**
 * Renders an always-available "Download" control for a saved Export doc.
 *
 * The exports collection denies update access to everyone by design
 * (`access.update: () => false` in @payloadcms/plugin-import-export's
 * getExportCollection.js — exports are immutable once generated). Payload's
 * Edit view only mounts the `edit.SaveButton` slot when the viewer has
 * update permission (see @payloadcms/ui's DocumentControls and
 * @payloadcms/next's renderDocumentSlots), so on a saved doc that slot
 * never renders at all — not merely disabled. That's why the plugin's own
 * Download button (and our ExportSaveButtonFixed fork of it) disappears
 * the moment you navigate away and back.
 *
 * `beforeDocumentControls` is rendered unconditionally, regardless of save
 * permission, so it's the right slot for a control that only needs read
 * access to the file already attached to the doc.
 */
export const ExportDownloadButton = () => {
  const { t } = useTranslation();
  const { id, savedDocumentData } = useDocumentInfo();
  const url =
    typeof savedDocumentData?.url === "string" ? savedDocumentData.url : undefined;
  const filename =
    typeof savedDocumentData?.filename === "string"
      ? savedDocumentData.filename
      : undefined;

  if (!id || !url) {
    return null;
  }

  const handleClick = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename ?? "";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Button size="medium" type="button" onClick={handleClick}>
      {t("upload:download")}
    </Button>
  );
};
