import { Box, Dialog, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useMemo } from "react";

type UpdateDialogProps = {
  open: boolean;
  onClose: () => void;
  embedCode: string;
};

const UpdateDialog = ({ open, onClose, embedCode }: UpdateDialogProps) => {
  const iframeSrc = useMemo(() => {
    const match = embedCode.match(/<iframe[^>]*src=["']([^"']+)["']/i);
    return match?.[1] ?? "";
  }, [embedCode]);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        scroll="body"
        maxWidth="md"
        fullWidth
        keepMounted
        disableAutoFocus
        disableEnforceFocus
        PaperProps={{
          sx: {
            display: "none",
          },
        }}
      />
      <Box
        aria-hidden={!open}
        sx={(theme) => ({
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: { xs: "calc(100% - 24px)", sm: "calc(100% - 48px)" },
          maxWidth: theme.breakpoints.values.md,
          maxHeight: "calc(100% - 48px)",
          bgcolor: "common.white",
          borderRadius: 2,
          boxShadow: "0px 12px 40px rgba(0,0,0,0.2)",
          overflow: "hidden",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 160ms ease",
          zIndex: theme.zIndex.modal + 1,
        })}
      >
        <IconButton
          onClick={onClose}
          aria-label="Close update dialog"
          sx={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 1,
            bgcolor: "rgba(255,255,255,0.9)",
            boxShadow: "0px 2px 10px rgba(0,0,0,0.15)",
            "&:hover": {
              bgcolor: "common.white",
            },
          }}
        >
          <CloseIcon />
        </IconButton>
        {iframeSrc ? (
          <Box
            component="iframe"
            title="Update promise form"
            src={iframeSrc}
            sx={{
              width: "100%",
              minHeight: { xs: 640, md: 760 },
              border: "none",
            }}
          />
        ) : (
          <Box
            sx={{
              width: "100%",
              "& iframe": {
                width: "100%",
                minHeight: { xs: 640, md: 760 },
                border: "none",
              },
            }}
            dangerouslySetInnerHTML={{ __html: embedCode }}
          />
        )}
      </Box>
    </>
  );
};

export default UpdateDialog;
