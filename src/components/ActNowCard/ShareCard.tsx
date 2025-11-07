"use client";

import FacebookIcon from "@mui/icons-material/Facebook";
import InstagramIcon from "@mui/icons-material/Instagram";
import LinkIcon from "@mui/icons-material/Link";
import XIcon from "@mui/icons-material/X";
import { WhatsApp } from "@mui/icons-material";
import { Alert, Box, IconButton, Snackbar } from "@mui/material";
import { useState } from "react";

import { copyToClipboard } from "@/utils/copyToClipboard";
import BaseContent from "./BaseContent";
import { usePathname } from "next/navigation";

interface ShareCardProps {
  closeCard: () => void;
  promiseActNow?: {
    share: {
      shareTitle?: string;
      shareDescription?: string;
    };
  };
}

function ShareCard({
  closeCard,
  promiseActNow = { share: {} },
}: ShareCardProps) {
  const [copySuccess, setCopySuccess] = useState(false);
  const iconButton = {
    backgroundColor: "#EBEBEB",
    margin: "10px",
    padding: "3%",
  };

  const {
    share: { shareTitle, shareDescription },
  } = promiseActNow;

  const pathname = usePathname();
  const getCurrentPageData = () => {
    const currentUrl =
      typeof window !== "undefined"
        ? window.location.href
        : `${process.env.NEXT_PUBLIC_SITE_URL || ""}${pathname}`;
    const pageTitle =
      shareTitle ||
      (typeof document !== "undefined"
        ? document.title
        : "Check out this page");
    const pageDescription = shareDescription || pageTitle;

    return {
      rawUrl: currentUrl,
      url: encodeURIComponent(currentUrl),
      title: encodeURIComponent(pageTitle),
      description: encodeURIComponent(pageDescription),
    };
  };

  // Share handlers
  const handleCopyLink = async () => {
    try {
      const { rawUrl } = getCurrentPageData();
      const copied = await copyToClipboard(rawUrl);
      if (!copied) {
        throw new Error("Unsupported clipboard API");
      }
      setCopySuccess(true);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  const handleInstagramShare = () => {
    // Instagram doesn't have a direct web share URL, so we'll copy the link
    // and show instructions
    handleCopyLink();
  };

  const handleTwitterShare = () => {
    const { url, title } = getCurrentPageData();
    const twitterUrl = `https://twitter.com/intent/tweet?url=${url}&text=${title}`;
    window.open(
      twitterUrl,
      "twitter-share",
      "width=600,height=400,scrollbars=yes,resizable=yes"
    );
  };

  const handleWhatsAppShare = () => {
    const { url, title } = getCurrentPageData();
    const whatsappUrl = `https://api.whatsapp.com/send?text=${title}%20${url}`;
    window.open(
      whatsappUrl,
      "whatsapp-share",
      "width=600,height=400,scrollbars=yes,resizable=yes"
    );
  };

  const handleFacebookShare = () => {
    const { url, title } = getCurrentPageData();
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${title}`;
    window.open(
      facebookUrl,
      "facebook-share",
      "width=600,height=400,scrollbars=yes,resizable=yes"
    );
  };

  const handleCopySnackbarClose = (_event?: unknown, reason?: string) => {
    if (reason === "clickaway") {
      return;
    }
    setCopySuccess(false);
  };
  return (
    <BaseContent
      onCloseCard={closeCard}
      title={shareTitle}
      description={shareDescription}
    >
      <Box
        sx={{
          flexWrap: "wrap",
        }}
        display={"flex"}
        justifyContent="center"
      >
        <IconButton
          onClick={handleCopyLink}
          sx={iconButton}
          color="primary"
          size="large"
        >
          <LinkIcon />
        </IconButton>

        <IconButton
          onClick={handleInstagramShare}
          sx={iconButton}
          color="primary"
          size="large"
        >
          <InstagramIcon />
        </IconButton>

        <IconButton
          onClick={handleTwitterShare}
          sx={iconButton}
          color="primary"
          size="large"
        >
          <XIcon />
        </IconButton>
        {/* Whatsapp */}
        <IconButton
          onClick={handleWhatsAppShare}
          sx={iconButton}
          color="primary"
          size="large"
        >
          <WhatsApp />
        </IconButton>
        <IconButton
          onClick={handleFacebookShare}
          sx={iconButton}
          color="primary"
          size="large"
        >
          <FacebookIcon />
        </IconButton>
      </Box>
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
    </BaseContent>
  );
}

export default ShareCard;
