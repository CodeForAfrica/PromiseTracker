"use client";

import {
  ClickAwayListener,
  Fade,
  IconButton,
  Paper,
  Popper,
  Stack,
  type IconButtonProps,
  type SxProps,
  type Theme,
} from "@mui/material";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import FacebookIcon from "@mui/icons-material/Facebook";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import XIcon from "@mui/icons-material/X";
import React, { useMemo, useState } from "react";
import {
  FacebookShareButton,
  LinkedinShareButton,
  TwitterShareButton,
} from "react-share";
import { sendGAEvent } from "@next/third-parties/google";

export type ShareProps = {
  link?: string;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  iconButtonProps?: IconButtonProps;
  popperSx?: SxProps<Theme>;
};

export const Share = ({
  link,
  title,
  description,
  icon,
  iconButtonProps,
  popperSx,
}: ShareProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);

  const shareUrl = useMemo(() => {
    if (link && link.length > 0) {
      return link;
    }
    if (typeof window !== "undefined") {
      return window.location.href;
    }
    return "";
  }, [link]);

  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setAnchorEl(event.currentTarget);
    setOpen((prevOpen) => !prevOpen);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const resolvedIcon = icon ?? <ShareOutlinedIcon fontSize="small" />;

  const handleShareClick = (platform: "twitter" | "facebook" | "linkedin") => {
    return () => {
      sendGAEvent({
        event: "share",
        category: platform,
        label: title ?? shareUrl,
        value: shareUrl,
      });
      setOpen(false);
    };
  };

  return (
    <ClickAwayListener onClickAway={handleClose}>
      <div>
        <IconButton
          aria-label="share"
          size="small"
          onClick={handleToggle}
          {...iconButtonProps}
        >
          {resolvedIcon}
        </IconButton>
        <Popper
          open={open}
          anchorEl={anchorEl}
          placement="bottom-start"
          transition
          sx={popperSx}
        >
          {({ TransitionProps }) => (
            <Fade {...TransitionProps} timeout={200}>
              <Paper elevation={6} sx={{ p: 1.5 }}>
                <Stack direction="row" spacing={1}>
                  <TwitterShareButton
                    title={title}
                    url={shareUrl}
                    onClick={handleShareClick("twitter")}
                  >
                    <XIcon fontSize="small" />
                  </TwitterShareButton>
                  <FacebookShareButton
                    content={title}
                    url={shareUrl}
                    onClick={handleShareClick("facebook")}
                  >
                    <FacebookIcon fontSize="small" />
                  </FacebookShareButton>
                  <LinkedinShareButton
                    title={title}
                    url={shareUrl}
                    source={description ?? shareUrl}
                    summary={description}
                    onClick={handleShareClick("linkedin")}
                  >
                    <LinkedInIcon fontSize="small" />
                  </LinkedinShareButton>
                </Stack>
              </Paper>
            </Fade>
          )}
        </Popper>
      </div>
    </ClickAwayListener>
  );
};

export default Share;
