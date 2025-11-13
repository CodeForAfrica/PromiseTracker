"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Collapse,
  IconButton,
  Snackbar,
  Stack,
  Tooltip,
} from "@mui/material";
import ShareIcon from "@mui/icons-material/Share";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import LinkIcon from "@mui/icons-material/Link";
import InstagramIcon from "@mui/icons-material/Instagram";
import XIcon from "@mui/icons-material/X";
import { WhatsApp } from "@mui/icons-material";
import FacebookIcon from "@mui/icons-material/Facebook";

import UpdateDialog from "@/components/ActNowCard/UpdateDialog";
import { copyToClipboard } from "@/utils/copyToClipboard";

type ShareContent = {
  title?: string | null;
  description?: string | null;
} | null;

type ActionContent = {
  title?: string | null;
  description?: string | null;
  url?: string | null;
} | null;

type PromiseActionsProps = {
  share?: ShareContent;
  update?: ActionContent;
  updateEmbed?: string | null;
  updateLabel?: string | null;
};

const baseButtonStyles = {
  borderRadius: 999,
  px: 2.5,
  py: 1,
  fontWeight: 600,
  letterSpacing: 0.5,
  textTransform: "none",
};

const shareIconButtonStyles = {
  backgroundColor: "grey.100",
  color: "text.primary",
  "&:hover": {
    backgroundColor: "grey.200",
  },
};

const getShareMetadata = (share?: ShareContent) => {
  const currentUrl =
    typeof window !== "undefined" ? window.location.href : "";

  const pageTitle =
    share?.title ||
    (typeof document !== "undefined" ? document.title : "Check out this page");

  const pageDescription = share?.description || pageTitle;

  return {
    rawUrl: currentUrl,
    encodedUrl: encodeURIComponent(currentUrl),
    encodedTitle: encodeURIComponent(pageTitle),
    encodedDescription: encodeURIComponent(pageDescription),
  };
};

const PromiseActions = ({
  share,
  update,
  updateEmbed,
  updateLabel,
}: PromiseActionsProps) => {
  const [shareOpen, setShareOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const embedCode = (updateEmbed ?? "").trim();
  const hasUpdate = Boolean(embedCode);
  const updateButtonLabel =
    updateLabel?.trim() || update?.title?.trim() || "Submit Update";

  const handleCopyLink = async () => {
    const { rawUrl } = getShareMetadata(share);
    if (!rawUrl) return;

    const copied = await copyToClipboard(rawUrl);
    if (copied) {
      setCopySuccess(true);
    }
  };

  const handleCopySnackbarClose = (_event?: unknown, reason?: string) => {
    if (reason === "clickaway") {
      return;
    }
    setCopySuccess(false);
  };

  const handleTwitterShare = () => {
    const { encodedUrl, encodedTitle } = getShareMetadata(share);
    const twitterUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`;
    window.open(
      twitterUrl,
      "twitter-share",
      "width=600,height=400,scrollbars=yes,resizable=yes"
    );
  };

  const handleWhatsAppShare = () => {
    const { encodedUrl, encodedTitle } = getShareMetadata(share);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`;
    window.open(
      whatsappUrl,
      "whatsapp-share",
      "width=600,height=400,scrollbars=yes,resizable=yes"
    );
  };

  const handleFacebookShare = () => {
    const { encodedUrl, encodedDescription } = getShareMetadata(share);
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedDescription}`;
    window.open(
      facebookUrl,
      "facebook-share",
      "width=600,height=400,scrollbars=yes,resizable=yes"
    );
  };

  const handleToggleShare = () => {
    setShareOpen((prev) => !prev);
  };

  const handleOpenUpdate = () => {
    if (!hasUpdate) {
      return;
    }
    setUpdateOpen(true);
  };

  const handleCloseUpdate = () => {
    setUpdateOpen(false);
  };

  return (
    <>
      <Stack spacing={1.5}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", sm: "center" }}
          useFlexGap
        >
          {hasUpdate ? (
            <Button
              startIcon={<NotificationsNoneIcon />}
              variant="contained"
              onClick={handleOpenUpdate}
              sx={{
                ...baseButtonStyles,
                backgroundColor: "text.primary",
                color: "common.white",
                "&:hover": {
                  backgroundColor: "text.primary",
                },
                "&.Mui-disabled": {
                  backgroundColor: "grey.400",
                  color: "common.white",
                },
              }}
              disabled={!hasUpdate}
            >
              {updateButtonLabel}
            </Button>
          ) : null}

          <Tooltip title="Share">
            <IconButton
              onClick={handleToggleShare}
              sx={(theme) => ({
                width: theme.spacing(6),
                height: theme.spacing(6),
                borderRadius: "50%",
                backgroundColor: shareOpen ? "text.primary" : "grey.100",
                color: shareOpen ? "common.white" : "text.primary",
                "&:hover": {
                  backgroundColor: shareOpen ? "text.primary" : "grey.200",
                },
              })}
            >
              <ShareIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        <Collapse in={shareOpen} unmountOnExit>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Tooltip title="Copy link">
              <IconButton
                onClick={handleCopyLink}
                sx={shareIconButtonStyles}
                color="primary"
              >
                <LinkIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Share on Instagram">
              <IconButton
                onClick={handleCopyLink}
                sx={shareIconButtonStyles}
                color="primary"
              >
                <InstagramIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Share on X (Twitter)">
              <IconButton
                onClick={handleTwitterShare}
                sx={shareIconButtonStyles}
                color="primary"
              >
                <XIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Share on WhatsApp">
              <IconButton
                onClick={handleWhatsAppShare}
                sx={shareIconButtonStyles}
                color="primary"
              >
                <WhatsApp />
              </IconButton>
            </Tooltip>
            <Tooltip title="Share on Facebook">
              <IconButton
                onClick={handleFacebookShare}
                sx={shareIconButtonStyles}
                color="primary"
              >
                <FacebookIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Collapse>
      </Stack>

      {hasUpdate ? (
        <UpdateDialog
          open={updateOpen}
          onClose={handleCloseUpdate}
          embedCode={embedCode}
        />
      ) : null}

      <Snackbar
        open={copySuccess}
        autoHideDuration={3000}
        onClose={handleCopySnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleCopySnackbarClose}
          severity="success"
          variant="filled"
        >
          Link copied to clipboard
        </Alert>
      </Snackbar>
    </>
  );
};

export default PromiseActions;
