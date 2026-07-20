"use client";

import { useState } from "react";
import { Button, Container, Stack, Typography } from "@mui/material";

import UpdateDialog from "@/components/ActNowCard/UpdateDialog";

const ALLOWED_SRC = "https://airtable.com/embed/appPreview/shrPreview";
const BLOCKED_SRC = "https://evil.example.com/embed/form";

const UpdateDialogPreview = () => {
  const [open, setOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);

  return (
    <Container sx={{ py: 8 }}>
      <Stack spacing={2} alignItems="flex-start">
        <Typography variant="h4" component="h1">
          Update dialog preview
        </Typography>
        <Typography>
          Development-only harness used by the Playwright security and
          accessibility tests.
        </Typography>
        <Button
          variant="contained"
          data-testid="open-update-dialog"
          onClick={() => setOpen(true)}
        >
          Open update form
        </Button>
        <Button
          variant="outlined"
          data-testid="open-blocked-dialog"
          onClick={() => setBlockedOpen(true)}
        >
          Open blocked embed
        </Button>
      </Stack>
      <UpdateDialog
        open={open}
        onClose={() => setOpen(false)}
        src={ALLOWED_SRC}
        title="Submit a promise update"
      />
      <UpdateDialog
        open={blockedOpen}
        onClose={() => setBlockedOpen(false)}
        src={BLOCKED_SRC}
        title="Blocked embed"
      />
    </Container>
  );
};

export default UpdateDialogPreview;
