import { Box, Dialog, DialogContent, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

type UpdateDialogProps = {
  open: boolean;
  onClose: () => void;
  embedCode: string;
};

const UpdateDialog = ({ open, onClose, embedCode }: UpdateDialogProps) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      scroll="body"
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          position: "relative",
          borderRadius: 2,
          overflow: "hidden",
          mx: { xs: 1.5, sm: 0 },
        },
      }}
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
      <DialogContent sx={{ p: 0 }}>
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
      </DialogContent>
    </Dialog>
  );
};

export default UpdateDialog;
