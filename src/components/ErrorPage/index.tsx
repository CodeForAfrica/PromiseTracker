"use client";

import Link from "next/link";
import { Box, Button, Container, Stack, Typography } from "@mui/material";

type ErrorPageProps = {
  code: "404" | "500";
  title: string;
  description: string;
  retry?: () => void;
};

export default function ErrorPage({
  code,
  title,
  description,
  retry,
}: ErrorPageProps) {
  return (
    <Box
      component="section"
      role={retry ? "alert" : undefined}
      aria-labelledby="error-page-title"
      sx={{
        minHeight: "100dvh",
        bgcolor: "background.default",
        color: "primary.dark",
        display: "flex",
        overflow: "hidden",
      }}
    >
      <Container
        sx={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box
          component="header"
          sx={{
            py: { xs: 3, md: 4 },
            borderBottom: "1px solid",
            borderColor: "primary.dark",
          }}
        >
          <Box
            component={Link}
            href="/"
            aria-label="PromiseTracker home"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 1.5,
              color: "inherit",
              textDecoration: "none",
              "&:focus-visible": {
                outline: "3px solid",
                outlineColor: "info.main",
                outlineOffset: 5,
              },
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 42,
                height: 14,
                position: "relative",
                "&::before": {
                  content: '\"\"',
                  position: "absolute",
                  inset: "6px 0 auto",
                  borderTop: "2px solid",
                  borderColor: "primary.dark",
                },
                "&::after": {
                  content: '\"\"',
                  position: "absolute",
                  top: 2,
                  right: 0,
                  width: 10,
                  height: 10,
                  bgcolor: "info.main",
                  borderRadius: "50%",
                },
              }}
            />
            <Typography
              component="span"
              sx={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}
            >
              Promise Tracker
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "minmax(0, 4fr) minmax(0, 6fr)",
            },
            alignItems: "center",
            alignContent: { xs: "center", md: "normal" },
            gap: { xs: 4, md: 10 },
            py: { xs: 6, md: 10 },
          }}
        >
          <Box aria-hidden="true">
            <Typography
              component="p"
              sx={{
                m: 0,
                fontSize: "clamp(4.5rem, 12vw, 6rem)",
                fontWeight: 700,
                lineHeight: 0.9,
                letterSpacing: "-0.04em",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {code}
            </Typography>
            <Box
              sx={{
                mt: 4,
                width: "min(100%, 280px)",
                height: 12,
                position: "relative",
                "&::before": {
                  content: '\"\"',
                  position: "absolute",
                  inset: "5px 0 auto",
                  borderTop: "2px solid",
                  borderColor: "secondary.main",
                },
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  top: 1,
                  left: code === "404" ? "28%" : "65%",
                  width: 10,
                  height: 10,
                  bgcolor: code === "404" ? "info.main" : "warning.main",
                  borderRadius: "50%",
                  boxShadow: "0 0 0 5px #fff",
                }}
              />
            </Box>
          </Box>

          <Stack spacing={3} sx={{ maxWidth: 640 }}>
            <Typography
              id="error-page-title"
              component="h1"
              tabIndex={-1}
              sx={{
                m: 0,
                fontSize: "clamp(2.25rem, 5vw, 3.5rem)",
                fontWeight: 700,
                lineHeight: 1.08,
                letterSpacing: "-0.035em",
                textWrap: "balance",
              }}
            >
              {title}
            </Typography>
            <Typography
              component="p"
              sx={{
                m: 0,
                maxWidth: "62ch",
                color: "grey.700",
                fontSize: { xs: 16, md: 18 },
                lineHeight: 1.65,
              }}
            >
              {description}
            </Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{ pt: 1, alignItems: { xs: "stretch", sm: "center" } }}
            >
              {retry ? (
                <Button
                  type="button"
                  variant="contained"
                  onClick={retry}
                  sx={{
                    minHeight: 50,
                    px: 4,
                    "&:focus-visible": {
                      outline: "3px solid",
                      outlineColor: "info.main",
                      outlineOffset: 3,
                    },
                  }}
                >
                  Try again
                </Button>
              ) : null}
              <Button
                component={Link}
                href="/"
                variant={retry ? "outlined" : "contained"}
                sx={{
                  minHeight: 50,
                  px: 4,
                  "&:focus-visible": {
                    outline: "3px solid",
                    outlineColor: "info.main",
                    outlineOffset: 3,
                  },
                }}
              >
                Return home
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
