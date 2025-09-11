import { Box, Grid, Typography, Container } from "@mui/material";
import React, { FC, forwardRef } from "react";
import Image from "next/image";
import { Image as ImageType } from "@/types/image";

import email from "@/assets/subscribe-email.svg?url";

interface Props {
  description?: string;
  title: string;
  image?: ImageType;
  embedCode: TrustedHTML;
}
const Newsletter: FC<Props> = forwardRef(function Newsletter(
  { description: descriptionProp, title, image, embedCode },
  ref,
) {
  const description =
    (descriptionProp && descriptionProp.length > 0 && descriptionProp) ||
    undefined;

  const formSx = {
    "& #mc_embed_signup": {
      background: "inherit",
      color: "inherit",
    },
    "& #mc_embed_signup form": {
      padding: 0,
    },
    "& #mc_embed_signup label": {
      display: "none",
    },
    "& #mc_embed_signup input.email": {
      background: "none",
      border: "none",
      borderBottom: "1px solid currentColor",
      borderRadius: 0,
      color: "currentColor",
      margin: "1rem 0",
      width: "100%",
      "&:focus": {
        outline: "none",
      },
      "&::placeholder": {
        opacity: 1.0,
      },
    },
    "& #mc_embed_signup .button": {
      background: "none",
      outline: "none",
      backgroundImage: `url("${email}")`,
      backgroundRepeat: "no-repeat",
      backgroundSize: `100% 100%`,
      border: "none",
      height: "100%",
      padding: 0,
      width: "100%",
      "&:hover": {
        background: "none",
        outline: "none",
        backgroundImage: `url("${email}")`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `100% 100%`,
        border: "none",
      },
      "&:focus": {
        background: "none",
        outline: "none",
        backgroundImage: `url("${email}")`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `100% 100%`,
        border: "none",
      },
    },
  };

  return (
    <Box
      ref={ref}
      component="section"
      sx={{
        backgroundColor: "#90DAFF",
        width: "100%",
        padding: {
          xs: `36px 0 49px`,
          lg: `25px 0`,
        },
      }}
    >
      <Container>
        <Grid container justifyContent="space-between">
          <Grid
            sx={{
              display: "flex",
              justifyContent: {
                xs: "center",
                sm: "flex-start",
                lg: "flex-start",
              },
              alignItems: "center",
            }}
            size={{ xs: 12, lg: 8 }}
          >
            <Box
              sx={{
                height: { xs: 250, lg: 350 },
                width: { xs: 314, lg: 458 },
                position: "relative",
              }}
              component={"figure"}
            >
              {image?.url && (
                <Image
                  src={image.url}
                  alt={image.alt || "Newsletter Subscribe"}
                  fill
                />
              )}
            </Box>
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }} display="flex" alignItems="center">
            <Box
              sx={{
                mt: { xs: 2, lg: 0 },
                width: "100%",
              }}
            >
              <Typography
                variant="h1"
                sx={{
                  padding: 0,
                  textAlign: "left",
                  textTransform: "capitalize",
                }}
              >
                {title}
              </Typography>
              {description && (
                <Typography
                  variant="body1"
                  sx={{
                    fontSize: "18px",
                    color: "#202020",
                  }}
                >
                  {description}
                </Typography>
              )}
              <Box
                sx={formSx}
                dangerouslySetInnerHTML={{
                  __html: embedCode,
                }}
              />
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
});

export default Newsletter;
