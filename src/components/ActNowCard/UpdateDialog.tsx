"use client";

import { useId } from "react";
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import { isAllowedIframeUrl } from "@/lib/security/embedPolicy.mjs";

/**
 * Sandbox capabilities granted to the embedded update form, kept to the
 * minimum Airtable's shared forms need (documented in
 * docs/security/embeds-and-csp.md):
 * - allow-scripts: the form is a JavaScript application.
 * - allow-forms: submitting the form.
 * - allow-same-origin: the form needs access to its own (airtable.com)
 *   origin for storage/XHR. It never matches this site's origin because
 *   src is restricted to allowlisted third-party hosts.
 * - allow-popups + allow-popups-to-escape-sandbox: links inside the
 *   form open in a new tab.
 * Deliberately NOT granted: top-navigation, downloads, modals,
 * pointer-lock, presentation.
 */
const IFRAME_SANDBOX =
  "allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox";

/** No powerful browser features are delegated to the embed. */
const IFRAME_ALLOW =
  "camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; fullscreen 'none'";

type UpdateDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Validated https URL of the update form on an allowlisted provider. */
  src: string;
  /** Accessible dialog title, e.g. the CMS-configured update label. */
  title?: string | null;
};

const UpdateDialog = ({ open, onClose, src, title }: UpdateDialogProps) => {
  const titleId = useId();
  const dialogTitle = title?.trim() || "Submit a promise update";

  // Defense in depth: never render an iframe pointing outside the
  // embed allowlist, even if a caller passes an unvalidated URL.
  if (!isAllowedIframeUrl(src)) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      maxWidth="md"
      fullWidth
      scroll="body"
    >
      <DialogTitle id={titleId} sx={{ pr: 8 }}>
        {dialogTitle}
      </DialogTitle>
      <IconButton
        onClick={onClose}
        aria-label="Close"
        sx={{
          position: "absolute",
          top: 12,
          right: 12,
          color: "text.secondary",
        }}
      >
        <CloseIcon />
      </IconButton>
      <DialogContent dividers sx={{ p: 0 }}>
        <Box
          component="iframe"
          title={dialogTitle}
          src={src}
          sandbox={IFRAME_SANDBOX}
          allow={IFRAME_ALLOW}
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
          sx={{
            display: "block",
            width: "100%",
            minHeight: { xs: 640, md: 760 },
            border: "none",
          }}
        />
      </DialogContent>
    </Dialog>
  );
};

export default UpdateDialog;
