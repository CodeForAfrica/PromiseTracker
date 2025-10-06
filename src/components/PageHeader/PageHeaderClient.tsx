"use client";

import { Box, Container, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import Image from "next/image";
import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical";

import { RichText } from "@/components/RichText";

type PageHeaderImage = {
  url: string;
  alt?: string | null;
} | null;

type Props = {
  title: string;
  description: DefaultTypedEditorState;
  image: PageHeaderImage;
};

export const PageHeaderClient = ({ title, description, image }: Props) => {
  if (!title && !description && !image) {
    return null;
  }

  return (
    <Box
      component="section"
      sx={(theme) => ({
        backgroundImage: `linear-gradient(180deg, ${theme.palette.grey[100]} 0%, ${theme.palette.common.white} 100%)`,
        paddingTop: theme.spacing(8),
        paddingBottom: theme.spacing(8),
        [theme.breakpoints.up("md")]: {
          paddingTop: theme.spacing(12),
          paddingBottom: theme.spacing(12),
        },
      })}
    >
      <Container>
        <Grid container justifyContent="space-between" rowSpacing={6}>
          <Grid size={{ xs: 12, lg: 7 }}>
            <Typography
              variant="h1"
              sx={{
                fontWeight: 700,
                p: 0,
              }}
            >
              {title}
            </Typography>
            <Box
              sx={(theme) => ({
                width: theme.typography.pxToRem(72),
                height: theme.typography.pxToRem(4),
                backgroundColor: theme.palette.text.primary,
                marginBottom: theme.spacing(3),
              })}
            />
            <RichText
              data={description}
              sx={(theme) => ({
                color: theme.palette.text.primary,
                fontSize: theme.typography.pxToRem(16),
                lineHeight: 1.7,
                maxWidth: "100%",
                [theme.breakpoints.up("md")]: {
                  fontSize: theme.typography.pxToRem(18),
                  maxWidth: "80%",
                },
              })}
            />
          </Grid>
          {image ? (
            <Grid
              size={{ xs: 12, lg: 5 }}
              display="flex"
              justifyContent={{ xs: "center", lg: "flex-end" }}
            >
              <Box
                component="figure"
                sx={(theme) => ({
                  margin: 0,
                  position: "relative",
                  width: {
                    xs: theme.typography.pxToRem(260),
                    sm: theme.typography.pxToRem(320),
                    lg: theme.typography.pxToRem(400),
                  },
                  height: {
                    xs: theme.typography.pxToRem(220),
                    sm: theme.typography.pxToRem(260),
                    lg: theme.typography.pxToRem(320),
                  },
                })}
              >
                <Image
                  src={image.url}
                  alt={image.alt || title || "Page illustration"}
                  fill
                  priority
                  sizes="(max-width: 992px) 320px, 400px"
                  style={{ objectFit: "contain" }}
                />
              </Box>
            </Grid>
          ) : null}
        </Grid>
      </Container>
    </Box>
  );
};
