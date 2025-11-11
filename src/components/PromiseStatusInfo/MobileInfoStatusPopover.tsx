"use client";

import { useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";

import {
  PromiseStatusList,
  type PromiseStatusListProps,
} from "@/components/PromiseStatusList";

export type MobileInfoStatusPopoverProps = {
  title?: string;
  statuses: PromiseStatusListProps["statuses"];
};

export const MobileInfoStatusPopover = ({
  title,
  statuses,
}: MobileInfoStatusPopoverProps) => {
  const [open, setOpen] = useState(false);
  const resolvedTitle = title?.trim() || "Promise status definitions";

  if (!resolvedTitle && statuses.length === 0) {
    return null;
  }

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  return (
    <>
      <IconButton
        aria-label="Show promise status info"
        size="small"
        onClick={handleOpen}
        sx={(theme) => ({
          backgroundColor: theme.palette.secondary.light,
          width: theme.typography.pxToRem(36),
          height: theme.typography.pxToRem(36),
          "&:hover": {
            backgroundColor: theme.palette.secondary.main,
          },
        })}
      >
        <InfoOutlinedIcon fontSize="small" />
      </IconButton>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
        <Stack direction="row" alignItems="center" spacing={1} sx={{ pr: 1 }}>
          <DialogTitle sx={{ flexGrow: 1 }}>
            <Typography variant="h5" sx={{ color: "primary.main" }}>
              {resolvedTitle}
            </Typography>
          </DialogTitle>
          <IconButton onClick={handleClose} aria-label="Close" sx={{ mr: 1 }}>
            <CloseIcon />
          </IconButton>
        </Stack>
        <DialogContent>
          <PromiseStatusList statuses={statuses} />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MobileInfoStatusPopover;
