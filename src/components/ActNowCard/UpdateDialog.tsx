import { useMemo } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { PromiseUpdateQuestion } from "@/types/promiseUpdates";

type UpdateDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  title: string;
  description: string;
  submitLabel: string;
  uploadDropLabel: string;
  uploadBrowseLabel: string;
  questions: PromiseUpdateQuestion[];
  answers: Record<string, string>;
  fileAnswers: Record<string, File[]>;
  onFieldChange: (
    id: string
  ) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  onFileChange: (
    id: string
  ) => (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (id: string) => (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
};

export const UpdateDialog = ({
  open,
  onClose,
  onSubmit,
  title,
  description,
  submitLabel,
  uploadDropLabel,
  uploadBrowseLabel,
  questions,
  answers,
  fileAnswers,
  onFieldChange,
  onFileChange,
  onDrop,
  onDragOver,
}: UpdateDialogProps) => {
  const requiredMissing = useMemo(() => {
    return questions
      .filter((question) => question.required)
      .some((question) => {
        if (question.type === "upload") {
          return !fileAnswers[question.id]?.length;
        }
        return !answers[question.id]?.trim();
      });
  }, [answers, fileAnswers, questions]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      scroll="body"
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: "#F7F7F7",
          borderRadius: { xs: 2, md: 2.5 },
          border: "1px solid #EBEBEB",
          overflow: "hidden",
          maxWidth: { xs: "100%", sm: 720 },
          width: "100%",
          mx: { xs: 1.5, sm: 0 },
        },
      }}
    >
      <Box
        component="form"
        onSubmit={onSubmit}
        noValidate
        sx={{ display: "contents" }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            px: { xs: 3, sm: 4, md: 6.5 },
            py: { xs: 2.25, sm: 2.75, md: 3 },
            bgcolor: "#F7F7F7",
            borderBottom: "1px solid #EBEBEB",
            minHeight: { sm: 100 },
          }}
        >
          <Typography
            component="span"
            variant="inherit"
            sx={{
              color: "text.primary",
              textTransform: "none",
              fontWeight: 300,
              fontSize: { xs: "23px", md: "32px" },
              lineHeight: 1.2,
            }}
          >
            {title}
          </Typography>
          <IconButton
            onClick={onClose}
            aria-label="Close update dialog"
            sx={{
              flexShrink: 0,
              color: "#909090",
              "&:hover": {
                color: "text.primary",
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent
          dividers={false}
          sx={{
            bgcolor: "#F7F7F7",
            px: { xs: 3, sm: 4, md: 6.5 },
            pt: { xs: 2.75, sm: 3.25, md: 4 },
            pb: { xs: 3.25, sm: 4.25, md: 5 },
          }}
        >
          <Typography
            variant="body1"
            sx={{
              color: "text.primary",
              mb: { xs: 3, md: 4 },
              fontSize: { xs: "16px", md: "18px" },
              lineHeight: 1.8,
            }}
          >
            {description}
          </Typography>
          <Stack spacing={{ xs: 3, md: 3.5 }}>
            {questions.map((question) => {
              if (question.type === "upload") {
                const helperText =
                  typeof question.description === "string"
                    ? question.description.trim()
                    : "";
                const files = fileAnswers[question.id] || [];

                return (
                  <Stack key={question.id} spacing={1.25}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 700,
                        letterSpacing: 1,
                        textTransform: "uppercase",
                        color: "text.primary",
                        fontSize: "16px",
                      }}
                    >
                      {question.label}
                      {question.required ? "*" : null}
                    </Typography>
                    {helperText ? (
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.primary",
                          fontSize: { xs: "14px", md: "16px" },
                          lineHeight: 1.8,
                        }}
                      >
                        {helperText}
                      </Typography>
                    ) : null}
                    <Paper
                      variant="outlined"
                      onDragOver={onDragOver}
                      onDrop={onDrop(question.id)}
                      sx={{
                        mt: 1,
                        py: { xs: 4.5, md: 5.5 },
                        px: { xs: 3, md: 4 },
                        textAlign: "center",
                        borderColor: "#EBEBEB",
                        borderRadius: 2,
                        bgcolor: "#F7F7F7",
                        cursor: "pointer",
                      }}
                    >
                      <Stack spacing={2} alignItems="center">
                        <Typography
                          variant="overline"
                          sx={{
                            letterSpacing: "0.4px",
                            textTransform: "uppercase",
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "#20202059",
                          }}
                        >
                          {uploadDropLabel}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: "text.primary",
                            fontSize: "13px",
                            textTransform: "uppercase",
                            fontWeight: 600,
                          }}
                        >
                          or
                        </Typography>
                        <Button
                          variant="outlined"
                          component="label"
                          sx={{
                            borderColor: "#909090",
                            color: "#202020",
                            backgroundColor: "common.white",
                            borderRadius: 1.25,
                            textTransform: "uppercase",
                            fontWeight: 700,
                            fontSize: "12px",
                            letterSpacing: "0.4px",
                            px: 3,
                            py: 1,
                            "&:hover": {
                              borderColor: "text.primary",
                              color: "text.primary",
                              backgroundColor: "common.white",
                            },
                          }}
                        >
                          {uploadBrowseLabel}
                          <input
                            type="file"
                            hidden
                            multiple
                            onChange={onFileChange(question.id)}
                          />
                        </Button>
                      </Stack>
                    </Paper>
                    {files.length ? (
                      <Stack spacing={0.5} sx={{ textAlign: "left" }}>
                        {files.map((file) => (
                          <Typography
                            key={file.name}
                            variant="caption"
                            sx={{
                              color: "text.primary",
                              fontSize: "13px",
                            }}
                          >
                            {file.name}
                          </Typography>
                        ))}
                      </Stack>
                    ) : null}
                  </Stack>
                );
              }

              const isLongInput = question.type === "textarea";
              const helperText =
                typeof question.description === "string"
                  ? question.description.trim()
                  : "";

              return (
                <Stack key={question.id} spacing={1.5}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 700,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      color: "text.primary",
                      fontSize: "16px",
                    }}
                  >
                    {question.label}
                    {question.required ? "*" : null}
                  </Typography>
                  {helperText ? (
                    <Typography
                      variant="body2"
                      sx={{
                        color: "text.primary",
                        fontSize: { xs: "14px", md: "16px" },
                        lineHeight: 1.8,
                      }}
                    >
                      {helperText}
                    </Typography>
                  ) : null}
                  <TextField
                    value={answers[question.id] || ""}
                    onChange={onFieldChange(question.id)}
                    required={question.required ?? false}
                    fullWidth
                    multiline={isLongInput}
                    minRows={isLongInput ? 4 : undefined}
                    variant="outlined"
                    InputProps={{
                      sx: {
                        backgroundColor: "#F7F7F7",
                        borderRadius: 1,
                        fontSize: "16px",
                        "& fieldset": {
                          borderColor: "#EBEBEB",
                        },
                        "&:hover fieldset": {
                          borderColor: "#909090",
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: "text.primary",
                        },
                      },
                    }}
                  />
                </Stack>
              );
            })}
          </Stack>
          <Typography
            variant="body2"
            sx={{
              display: "block",
              color: "text.primary",
              mt: { xs: 3, md: 4 },
              textTransform: "uppercase",
              fontWeight: 600,
              fontSize: "12px",
              letterSpacing: "0.4px",
            }}
          >
            * Mandatory fields
          </Typography>
        </DialogContent>
        <DialogActions
          sx={{
            px: { xs: 3, sm: 4, md: 6.5 },
            pb: { xs: 3.5, sm: 4.5, md: 5 },
            pt: 0,
            bgcolor: "#F7F7F7",
            justifyContent: "center",
          }}
        >
          <Button
            type="submit"
            variant="contained"
            disabled={requiredMissing}
            sx={{
              minWidth: { xs: 160, sm: 200 },
              borderRadius: 999,
              px: { xs: 4, sm: 5 },
              py: 1.5,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              fontSize: "12px",
              backgroundColor: "text.primary",
              border: "1px solid",
              borderColor: "text.primary",
              color: "common.white",
              "&:hover": {
                backgroundColor: "text.primary",
                borderColor: "text.primary",
              },
              "&.Mui-disabled": {
                backgroundColor: "grey.400",
                borderColor: "grey.400",
                color: "common.white",
              },
            }}
          >
            {submitLabel}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default UpdateDialog;
