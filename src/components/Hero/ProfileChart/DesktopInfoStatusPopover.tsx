"use client";

import { useState } from "react";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {
  Box,
  ClickAwayListener,
  Fade,
  IconButton,
  Paper,
  Popper,
  Typography,
} from "@mui/material";

import PromiseStatusList, {
  type PromiseStatusListProps,
} from "@/components/PromiseStatusList";

export type DesktopInfoStatusPopoverProps = {
  title?: string;
  statuses: PromiseStatusListProps["statuses"];
};

export const DesktopInfoStatusPopover = ({
  title,
  statuses,
}: DesktopInfoStatusPopoverProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const resolvedTitle = title?.trim() || "Promise status definitions";

  if (!resolvedTitle && statuses.length === 0) {
    return null;
  }

  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setAnchorEl(event.currentTarget);
    setOpen((prev) => !prev);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <ClickAwayListener onClickAway={handleClose}>
      <Box component="span">
        <IconButton
          aria-label="Show promise status info"
          size="small"
          onClick={handleToggle}
          sx={(theme) => ({
            backgroundColor: theme.palette.secondary.light,
            width: theme.typography.pxToRem(40),
            height: theme.typography.pxToRem(40),
            "&:hover": {
              backgroundColor: theme.palette.secondary.main,
            },
          })}
        >
          <InfoOutlinedIcon fontSize="small" />
        </IconButton>
        <Popper
          open={open}
          anchorEl={anchorEl}
          placement="bottom-end"
          transition
          modifiers={[
            {
              name: "offset",
              options: {
                offset: [0, 12],
              },
            },
          ]}
        >
          {({ TransitionProps }) => (
            <Fade {...TransitionProps} timeout={200}>
              <Paper
                elevation={6}
                sx={(theme) => ({
                  maxWidth: theme.typography.pxToRem(664),
                  width: theme.typography.pxToRem(664),
                  p: theme.typography.pxToRem(24),
                  position: "relative",
                  overflow: "auto",
                  maxHeight: theme.typography.pxToRem(520),
                })}
              >
                {resolvedTitle ? (
                  <Typography
                    variant="h5"
                    sx={(theme) => ({
                      color: theme.palette.primary.main,
                      mb: theme.typography.pxToRem(16),
                    })}
                  >
                    {resolvedTitle}
                  </Typography>
                ) : null}
                <PromiseStatusList statuses={statuses} />
              </Paper>
            </Fade>
          )}
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

export default DesktopInfoStatusPopover;
