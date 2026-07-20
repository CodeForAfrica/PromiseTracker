import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Box, Button, Container, Typography } from "@mui/material";

export const metadata: Metadata = {
  title: "Page not found | PromiseTracker",
};

export default function NotFound() {
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
        <Typography variant="h1" component="p" sx={{ fontWeight: 700 }}>
          404
        </Typography>
        <Typography variant="h4" component="h1">
          Page not found
        </Typography>
        <Typography variant="body1" color="text.secondary">
          The page you are looking for does not exist or may have been moved.
        </Typography>
        <Button component={Link} href="/" variant="contained" sx={{ mt: 2 }}>
          Go to the homepage
        </Button>
      </Box>
    </Container>
  );
}
