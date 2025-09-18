import { TenantList, getTenantLinks } from "./TenantList";
import { getGlobalPayload } from "@/lib/payload";
import type { HomePage as HomePageSettings } from "@/payload-types";
import { Box, Card, CardContent, Container, Typography } from "@mui/material";

export const CommonHomePage = async () => {
  const payload = await getGlobalPayload();

  const settings = await payload.findGlobal({
    slug: "home-page",
  });

  const tenantLinks = await getTenantLinks();

  return (
    <Box component="main" sx={{ bgcolor: "background.default" }}>
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        {tenantLinks.length === 0 ? (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                No tenants available yet
              </Typography>
              <Typography variant="body2">
                Once tenants are published they will appear here automatically.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <TenantList
            items={tenantLinks}
            title={settings.tenantSelector.title}
            subtitle={settings.tenantSelector.subtitle}
          />
        )}
      </Container>
    </Box>
  );
};
