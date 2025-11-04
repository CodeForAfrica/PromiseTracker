"use client";

import { useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Card,
  Collapse,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  type SxProps,
  type Theme,
} from "@mui/material";
import AllInclusiveIcon from "@mui/icons-material/AllInclusive";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ControlPointIcon from "@mui/icons-material/ControlPoint";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import ShareIcon from "@mui/icons-material/Share";
import FacebookIcon from "@mui/icons-material/Facebook";
import InstagramIcon from "@mui/icons-material/Instagram";
import LinkIcon from "@mui/icons-material/Link";
import XIcon from "@mui/icons-material/X";
import { WhatsApp } from "@mui/icons-material";
import UpdateDialog from "./UpdateDialog";

type ShareContent = {
  title?: string;
  description?: string;
};

type ActionContent = {
  title?: string;
  description?: string;
  url?: string;
};

type EntitySummary = {
  name: string;
  position?: string | null;
  region?: string | null;
  image?: {
    url: string | null;
    alt?: string | null;
  } | null;
};

export interface ActNowButtonCardProps {
  title?: string;
  share?: ShareContent;
  connect?: ActionContent;
  petition?: ActionContent;
  follow?: ActionContent;
  update?: ActionContent;
  updateEmbed?: string | null;
  entity?: EntitySummary | null;
  sx?: SxProps<Theme>;
}

const baseButtonStyles: SxProps<Theme> = {
  borderRadius: 999,
  px: 2.5,
  py: 1,
  fontWeight: 600,
  letterSpacing: 0.5,
  textTransform: "none",
};

const shareIconButtonStyles: SxProps<Theme> = {
  backgroundColor: "grey.100",
  color: "text.primary",
  "&:hover": {
    backgroundColor: "grey.200",
  },
};

const getShareMetadata = (share?: ShareContent) => {
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

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

export const ActNowCard = ({
  share,
  connect,
  petition,
  follow,
  update,
  updateEmbed,
  entity,
  sx,
}: ActNowButtonCardProps) => {
  const [shareOpen, setShareOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);

  const handleCopyLink = async () => {
    const { rawUrl } = getShareMetadata(share);
    if (!rawUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(rawUrl);
    } catch (error) {
      console.error("Failed to copy link", error);
    }
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
    const { encodedUrl, encodedTitle } = getShareMetadata(share);
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedTitle}`;
    window.open(
      facebookUrl,
      "facebook-share",
      "width=600,height=400,scrollbars=yes,resizable=yes"
    );
  };

  const embedCode = (updateEmbed ?? "").trim();
  const payloadConfigured = Boolean(embedCode);

  const updateButtonLabel = (update?.title ?? "").trim() || "Update";

  const handleOpenUpdate = () => {
    if (!payloadConfigured) {
      return;
    }
    setUpdateOpen(true);
  };

  const handleCloseUpdate = () => {
    setUpdateOpen(false);
  };

  const disabledActions: Array<{
    label: string;
    icon: React.ReactNode;
  }> = [
    // {
    //   label: connect?.title || "Connect",
    //   icon: <AllInclusiveIcon />,
    // },
    // {
    //   label: petition?.title || "Petition",
    //   icon: <ChatBubbleOutlineIcon />,
    // },
    // {
    //   label: follow?.title || "Follow",
    //   icon: <ControlPointIcon />,
    // },
  ];

  const avatarSrc = entity?.image?.url ?? undefined;
  const avatarAlt = entity?.image?.alt || entity?.name || "Profile";
  const secondaryLine = [entity?.position, entity?.region]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card
      sx={[
        {
          borderRadius: 4,
          p: { xs: 3, md: 3.5 },
          boxShadow: "0px 18px 48px rgba(32, 32, 32, 0.08)",
          backgroundColor: "#F6F5F5",
          height: "auto",
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <Stack spacing={3}>
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar
              src={avatarSrc}
              alt={avatarAlt}
              sx={{ width: 56, height: 56 }}
            />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {entity?.name || "Political entity"}
              </Typography>
              {secondaryLine ? (
                <Typography variant="body2" sx={{ color: "text.primary" }}>
                  {secondaryLine}
                </Typography>
              ) : null}
            </Box>
          </Stack>
          <Tooltip title="Share">
            <IconButton
              onClick={() => setShareOpen((prev) => !prev)}
              sx={{
                px: 1.5,
                py: 1,
                borderRadius: "50%",
                backgroundColor: shareOpen ? "text.primary" : "grey.100",
                color: shareOpen ? "common.white" : "text.primary",
                "&:hover": {
                  backgroundColor: shareOpen ? "text.primary" : "grey.200",
                },
              }}
            >
              <ShareIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={1}
          useFlexGap
          flexWrap="wrap"
        >
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
            disabled={!payloadConfigured}
          >
            {updateButtonLabel}
          </Button>
          {disabledActions.map((action) => (
            <Button
              key={action.label}
              startIcon={action.icon}
              variant="contained"
              sx={{
                ...baseButtonStyles,
                backgroundColor: "text.primary",
                color: "common.white",
                "&:hover": {
                  backgroundColor: "text.primary",
                },
                "&.Mui-disabled": {
                  backgroundColor: "text.primary",
                  color: "common.white",
                  opacity: 1,
                },
              }}
              disabled
            >
              {action.label}
            </Button>
          ))}
        </Stack>

        <Collapse in={shareOpen} unmountOnExit>
          <Stack spacing={1.5}>
            {share?.description ? (
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", maxWidth: 360 }}
              >
                {share.description}
              </Typography>
            ) : null}
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
          </Stack>
        </Collapse>
      </Stack>
      {payloadConfigured ? (
        <UpdateDialog
          open={updateOpen}
          onClose={handleCloseUpdate}
          embedCode={embedCode}
        />
      ) : null}
    </Card>
  );
};

export default ActNowCard;
