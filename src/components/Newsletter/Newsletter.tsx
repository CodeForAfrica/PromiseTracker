import { Box, Container, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import Image from "next/image";

import email from "@/assets/subscribe-email.svg?url";
import { getDomain } from "@/lib/domain";
import {
  getTenantBySubDomain,
  getTenantSiteSettings,
} from "@/lib/data/tenants";
import type {
  Media,
  NewsletterBlock as NewsletterBlockProps,
} from "@/payload-types";
import { getGlobalPayload } from "@/lib/payload";

const payload = await getGlobalPayload();

const Newsletter = async ({ image }: NewsletterBlockProps) => {
  const { subdomain } = await getDomain();
  const tenant = await getTenantBySubDomain(subdomain);
  let siteSettings;
  if (!tenant) {
    siteSettings = await payload.findGlobal({
      slug: "home-page",
    });
  } else {
    siteSettings = await getTenantSiteSettings(tenant);
  }

  const newsletter = siteSettings?.newsletter;

  if (!newsletter) {
    return null;
  }

  const { title, description, embedCode } = newsletter;

  if (!title || !embedCode) {
    return null;
  }
  const imageMedia =
    image && typeof image === "object" ? (image as Media) : null;

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
        opacity: 1,
      },
    },
    "& #mc_embed_signup input:not(.email):not(.button)": {
      display: "none",
    },
    "& #mc_embed_signup .button": {
      background: "none",
      outline: "none",
      backgroundImage: `url("${email}")`,
      backgroundRepeat: "no-repeat",
      backgroundSize: "100% 100%",
      border: "none",
      height: "100%",
      padding: 0,
      width: "100%",
      color: "transparent",
      fontSize: 0,
      textIndent: "-9999px",
      "&:hover": {
        background: "none",
        outline: "none",
        backgroundImage: `url("${email}")`,
        backgroundRepeat: "no-repeat",
        backgroundSize: "100% 100%",
        border: "none",
      },
      "&:focus": {
        background: "none",
        outline: "none",
        backgroundImage: `url("${email}")`,
        backgroundRepeat: "no-repeat",
        backgroundSize: "100% 100%",
        border: "none",
      },
    },
  } as const;

  return (
    <Box
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
        <Grid container justifyContent="space-between" rowSpacing={6}>
          <Grid
            size={{ xs: 12, lg: 8 }}
            sx={{
              display: "flex",
              justifyContent: {
                xs: "center",
                sm: "flex-start",
                lg: "flex-start",
              },
              alignItems: "center",
            }}
          >
            <Box
              component="figure"
              sx={{
                height: { xs: 250, lg: 350 },
                width: { xs: 314, lg: 458 },
                position: "relative",
                margin: 0,
              }}
            >
              {imageMedia?.url ? (
                <Image
                  src={imageMedia.url}
                  alt={imageMedia?.alt || "Newsletter subscribe"}
                  fill
                  sizes="(max-width: 1200px) 314px, 458px"
                  style={{ objectFit: "cover" }}
                />
              ) : null}
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
              {description ? (
                <Typography
                  variant="body1"
                  sx={{
                    fontSize: "18px",
                    color: "#202020",
                  }}
                >
                  {description}
                </Typography>
              ) : null}
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
};

export default Newsletter;
