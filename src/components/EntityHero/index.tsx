import { Box, Container, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";

import { countries, getCountryFlag } from "@/data/countries";
import { getTenantBySubDomain } from "@/lib/data/tenants";
import { getDomain } from "@/lib/domain";
import type { EntityHeroBlock } from "@/payload-types";
import { resolveTenantLocale } from "@/utils/locales";

const FLAG_WIDTH = 320;

export const EntityHero = async ({ title, description }: EntityHeroBlock) => {
  const { subdomain } = await getDomain();
  const tenant = await getTenantBySubDomain(subdomain);

  if (!tenant) {
    return null;
  }

  const normalizedCountryCode = tenant.country?.trim().toUpperCase() || null;
  const country =
    countries.find((entry) => {
      const alpha2 = entry.alpha2.toUpperCase();
      const alpha3 = entry.alpha3.toUpperCase();
      const slug = entry.slug.toUpperCase();

      return (
        alpha2 === normalizedCountryCode ||
        alpha3 === normalizedCountryCode ||
        slug === normalizedCountryCode
      );
    }) || null;
  const locale = resolveTenantLocale(tenant);
  const countryName =
    (country &&
      (country.label?.[locale] ?? country.label?.en ?? country.name)) ??
    null;

  const displayName = tenant.name ?? countryName ?? null;
  const flagUrl = getCountryFlag(tenant.country, FLAG_WIDTH);
  const flagAlt = country
    ? `Flag of ${country.name}`
    : displayName
      ? `${displayName} flag`
      : "Country flag";

  return (
    <Box component="section">
      <Container maxWidth="lg" sx={{ pt: 2 }}>
        <Grid
          container
          alignItems="center"
          columnSpacing={{ xs: 0, md: 6 }}
          rowSpacing={{ xs: 4, md: 0 }}
        >
          <Grid size={{ xs: 12, md: 7 }}>
            <Typography variant="subtitle2">{displayName}</Typography>
            <Typography
              component="h1"
              variant="h1"
              sx={{
                fontWeight: 700,
                mb: 2,
              }}
            >
              {title}
            </Typography>
            {description ? (
              <Typography variant="body2">{description}</Typography>
            ) : null}
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: { xs: "flex-start", md: "flex-end" },
              }}
            >
              <Box
                sx={{
                  width: { xs: "100%", md: "85%" },
                  maxWidth: 360,
                  aspectRatio: "5 / 3",
                  borderRadius: 2.5,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {flagUrl ? (
                  <Box
                    component="img"
                    src={flagUrl}
                    alt={flagAlt}
                    loading="lazy"
                    sx={{
                      display: "block",
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: "60%",
                      height: "60%",
                      borderRadius: 1,
                    }}
                  />
                )}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};
