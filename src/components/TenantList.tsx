import { getDomain } from "@/lib/domain";
import { getAllTenants } from "@/lib/data/tenants";
import type { HomePage, Tenant } from "@/payload-types";
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Link,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
} from "@mui/material";
import { OpenInNew } from "@mui/icons-material";

export type TenantLink = {
  id: string;
  name: string;
  url: string;
  countryCode?: Tenant["country"] | string | null;
  flag?: string | null;
};

const getSubdomain = (tenant: Tenant): string | null => {
  if (tenant.country) return tenant.country.toLowerCase();
  if (tenant.name) {
    return tenant.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
  return null;
};

const buildTenantUrl = (
  tenant: Tenant,
  hostname: string | null,
  baseDomain: string | null,
  isLocalhost: boolean,
  port: string
) => {
  const subdomain = getSubdomain(tenant);
  if (!subdomain) return null;

  if (isLocalhost || hostname?.includes("localtest")) {
    return `http://${subdomain}.localtest.me${port}`;
  }

  let host = hostname ?? null;
  const protocol = "http";

  if (!host && baseDomain) {
    const [baseHost] = baseDomain.split(":");
    host = baseHost || null;
  }

  if (!host) return null;

  return `${protocol}://${subdomain}.${host}`;
};

export const getTenantLinks = async (): Promise<TenantLink[]> => {
  const tenants = await getAllTenants();
  const { port, isLocalhost, baseDomain, hostname } = await getDomain();

  const entries: TenantLink[] = [];

  for (const tenant of tenants) {
    const url = buildTenantUrl(
      tenant,
      hostname,
      baseDomain ?? null,
      isLocalhost,
      port
    );
    if (!url) continue;
    entries.push({
      id: tenant.id,
      name: tenant.name,
      url,
      countryCode: tenant.country ?? null,
      flag: tenant.flag ?? null,
    });
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
};

type TenantSelectionBlock = Extract<
  HomePage["tenantSelector"]["blocks"][number],
  { blockType: "tenant-selection" }
>;

type TenantListProps = TenantSelectionBlock & {
  dense?: boolean;
};

export const TenantList = async ({
  dense = false,
  title,
  subtitle,
  ctaLabel,
  emptyListLabel,
}: TenantListProps) => {
  const tenantLinks = await getTenantLinks();

  if (tenantLinks.length === 0) {
    return (
      <Card>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="body1">{emptyListLabel}</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          <Typography variant="body2" sx={{ mb: 3 }}>
            {subtitle}
          </Typography>
          <List disablePadding dense={dense}>
            {tenantLinks.map((tenant, index) => {
              const initials = tenant.name
                .split(" ")
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join("");

              return (
                <Box key={tenant.id}>
                  <ListItem disableGutters sx={{ py: dense ? 0.75 : 1.25 }}>
                    <ListItemAvatar sx={{ minWidth: dense ? 36 : 46 }}>
                      <Avatar
                        src={tenant.flag ?? undefined}
                        alt={tenant.name}
                        sx={{
                          bgcolor: "primary.light",
                          color: "primary.dark",
                          width: dense ? 32 : 40,
                          height: dense ? 32 : 40,
                          fontSize: dense ? "0.75rem" : "0.875rem",
                        }}
                      >
                        {initials}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={tenant.name}
                      secondary={tenant.url.replace(/^https?:\/\//, "")}
                      primaryTypographyProps={{
                        variant: "subtitle1",
                        sx: { fontWeight: 600 },
                      }}
                      secondaryTypographyProps={{
                        variant: "body2",
                        color: "primary.dark",
                      }}
                    />
                    <Chip
                      component={Link}
                      href={tenant.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      label={ctaLabel}
                      clickable
                      color="primary"
                      sx={{ px: 1 }}
                      icon={<OpenInNew fontSize="small" />}
                    />
                  </ListItem>
                  {index < tenantLinks.length - 1 ? (
                    <Divider component="div" />
                  ) : null}
                </Box>
              );
            })}
          </List>
        </CardContent>
      </Card>
    </Container>
  );
};
