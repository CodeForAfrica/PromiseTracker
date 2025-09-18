import { getGlobalPayload } from "@/lib/payload";
import { getDomain } from "@/lib/domain";
import { Card, List, ListItem, Link, Typography } from "@mui/material";

export const TenantList = async () => {
  const payload = await getGlobalPayload();
  const { port, isLocalhost, baseDomain, hostname } = await getDomain();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  const { docs: tenants } = await payload.find({
    collection: "tenants",
    limit: -1,
  });

  const createTenantUrl = (country?: string | null) => {
    if (!country) return null;

    const subdomain = country.toLowerCase();

    if (isLocalhost) {
      return `http://${subdomain}.localtest.me${port}`;
    }

    let protocol = "https";
    let host: string | null = hostname;

    if (appUrl) {
      try {
        const parsed = new URL(appUrl);
        protocol = parsed.protocol.replace(/:$/, "") || protocol;
        host = host ?? parsed.hostname;
      } catch {
        // Fall back to request host information
      }
    }

    if (!host && baseDomain) {
      const [baseHost] = baseDomain.split(":");
      host = baseHost || null;
    }

    if (host?.includes("localhost")) {
      // If upstream host is still localhost assume http
      protocol = "http";
    }

    if (!host) return null;

    return `${protocol}://${subdomain}.${host}`;
  };

  return (
    <Card variant="outlined">
      <Typography variant="h2">Available Tenants</Typography>
      <List>
        {tenants.map((t) => {
          const tenantUrl = createTenantUrl(t.country);
          if (!tenantUrl) return null;

          return (
            <ListItem key={t.id}>
              <Link href={tenantUrl}>{tenantUrl}</Link>
            </ListItem>
          );
        })}
      </List>
    </Card>
  );
};
