"use client";

import React, { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Box, Button, Container, Typography } from "@mui/material";

export default function FrontendError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          minHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: 2,
          py: 8,
        }}
      >
        <Typography variant="h4" component="h1">
          Something went wrong
        </Typography>
        <Typography variant="body1" color="text.secondary">
          An unexpected error occurred while loading this page. Please try
          again.
        </Typography>
        <Button onClick={reset} variant="contained" sx={{ mt: 2 }}>
          Try again
        </Button>
      </Box>
    </Container>
  );
}
