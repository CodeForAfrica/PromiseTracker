"use client";
import { Box, Grid, Typography, Container } from "@mui/material";
import { FC, forwardRef, useEffect, useRef } from "react";
import Image from "next/image";
import { Image as ImageType } from "@/types/image";

interface Props {
  description?: string;
  title: string;
  image?: ImageType;
  embedCode: TrustedHTML;
  entitySlug?: string;
}
const Newsletter: FC<Props> = forwardRef(function Newsletter(
  { description: descriptionProp, title, image, embedCode },
  ref
) {
  const description =
    (descriptionProp && descriptionProp.length > 0 && descriptionProp) ||
    undefined;

  const formContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = formContainerRef.current;

    if (!container) {
      return undefined;
    }

    const emailInputs = Array.from(
      container.querySelectorAll<HTMLInputElement>("input[type='email']")
    );

    if (!emailInputs.length) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") {
        return;
      }

      const target = event.target as HTMLInputElement | null;
      const form = target?.form;

      if (!form) {
        return;
      }

      event.preventDefault();

      if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
      } else {
        form.submit();
      }
    };

    emailInputs.forEach((input) => {
      input.addEventListener("keydown", handleKeyDown);
    });

    return () => {
      emailInputs.forEach((input) => {
        input.removeEventListener("keydown", handleKeyDown);
      });
    };
  }, [embedCode]);

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
      fontFamily: "inherit",
      fontSize: "18px",
      fontStyle: "normal",
      fontWeight: 400,
      margin: "1rem 0",
      width: "100%",
      "&:focus": {
        outline: "none",
      },
      "&::placeholder": {
        color: "#757575",
        direction: "inherit",
        fontFamily: "inherit",
        fontSize: "18px",
        fontStyle: "normal",
        fontWeight: 400,
        opacity: 1.0,
        pointerEvents: "none",
        textOrientation: "inherit",
        WebkitTextSecurity: "none",
        writingMode: "inherit",
      },
      "&::-webkit-input-placeholder": {
        color: "#757575",
        direction: "inherit",
        fontFamily: "inherit",
        fontSize: "18px",
        fontStyle: "normal",
        fontWeight: 400,
        pointerEvents: "none",
        textOrientation: "inherit",
        WebkitTextSecurity: "none",
        writingMode: "inherit",
      },
      "&::-moz-placeholder": {
        color: "#757575",
        direction: "inherit",
        fontFamily: "inherit",
        fontSize: "18px",
        fontStyle: "normal",
        fontWeight: 400,
        opacity: 1,
        pointerEvents: "none",
        textOrientation: "inherit",
        writingMode: "inherit",
      },
      "&:-ms-input-placeholder": {
        color: "#757575",
        direction: "inherit",
        fontFamily: "inherit",
        fontSize: "18px",
        fontStyle: "normal",
        fontWeight: 400,
        pointerEvents: "none",
        textOrientation: "inherit",
        WebkitTextSecurity: "none",
        writingMode: "inherit",
      },
      "&:-moz-placeholder": {
        color: "#757575",
        direction: "inherit",
        fontFamily: "inherit",
        fontSize: "18px",
        fontStyle: "normal",
        fontWeight: 400,
        opacity: 1,
        pointerEvents: "none",
        textOrientation: "inherit",
        writingMode: "inherit",
      },
    },
    "& #mc_embed_signup_scroll > input[type='text']": {
      display: "none",
    },
    "& #mc_embed_signup input[type='submit']": {
      display: "none",
    },
    "& #mc_embed_signup .clear": {
      display: "none",
    },
    "& #mc_embed_signup .button": {
      display: "none",
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
        <Grid container justifyContent="space-between" alignItems="stretch">
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
                m: 0,
                ml: { lg: "54px" },
              }}
              component="figure"
            >
              {image?.url && (
                <Image
                  src={image.url}
                  alt={image.alt || "Newsletter Subscribe"}
                  fill
                  style={{ objectFit: "contain" }}
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
                ref={formContainerRef}
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
