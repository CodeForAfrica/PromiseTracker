import { Box, Container, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";

import { countries, getCountryFlag } from "@/data/countries";
import { resolveMedia } from "@/lib/data/media";
import { getTenantBySubDomain } from "@/lib/data/tenants";
import { getDomain } from "@/lib/domain";
import type { EntityHeroBlock } from "@/payload-types";
import { resolveTenantLocale } from "@/utils/locales";

import { EntityHeroCarousel, type EntityHeroCarouselImage } from "./Carousel";

const FLAG_WIDTH = 40;

const resolveCarouselImages = async (
  carousel: EntityHeroBlock["carousel"],
  tenantId: string | undefined,
  fallbackAlt: string | null
): Promise<EntityHeroCarouselImage[]> => {
  if (!carousel?.length) {
    return [];
  }

  const matchingItem = carousel.find((entry) => {
    const tenantRef = entry.carouselItems?.tenant;
    const itemTenantId =
      typeof tenantRef === "string" ? tenantRef : tenantRef?.id;

    return Boolean(itemTenantId && tenantId && itemTenantId === tenantId);
  });

  if (!matchingItem) {
    return [];
  }

  const images = matchingItem.carouselItems?.images ?? [];
  const resolved = await Promise.all(
    images.map((media) => resolveMedia(media))
  );

  return resolved
    .filter((item): item is NonNullable<typeof item> => Boolean(item?.url))
    .map((item) => ({
      url: item.url,
      alt: item.alt || fallbackAlt || "Carousel image",
    }));
};

export const EntityHero = async ({
  title,
  description,
  carousel,
}: EntityHeroBlock) => {
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

  const displayName = tenant.name ?? countryName ?? tenant.country ?? null;
  const flagUrl = getCountryFlag(tenant.country, FLAG_WIDTH);
  const flagAlt = country
    ? `Flag of ${country.name}`
    : displayName
      ? `${displayName} flag`
      : "Country flag";
  const carouselImages = await resolveCarouselImages(
    carousel,
    tenant.id,
    displayName
  );

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
            <Typography
              variant="subtitle2"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1.5,
              }}
            >
              {flagUrl ? (
                <Box
                  component="img"
                  src={flagUrl}
                  alt={flagAlt}
                  loading="lazy"
                  sx={{
                    width: 32,
                    height: 32,
                    objectFit: "cover",
                    borderRadius: "50%",
                    boxShadow: "0px 6px 16px rgba(0,0,0,0.12)",
                  }}
                />
              ) : null}
              {displayName}
            </Typography>
            <Typography
              component="h1"
              variant="h1"
              sx={{
                fontWeight: 700,
                mb: 2,
                wordBreak: "break-word",
                overflowWrap: "anywhere",
              }}
            >
              {title}
            </Typography>
            {description ? (
              <Typography variant="body2">{description}</Typography>
            ) : null}
          </Grid>
          {carouselImages.length ? (
            <Grid size={{ xs: 12, md: 5 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: { xs: "flex-start", md: "flex-end" },
                }}
              >
                <EntityHeroCarousel images={carouselImages} />
              </Box>
            </Grid>
          ) : null}
        </Grid>
      </Container>
    </Box>
  );
};
