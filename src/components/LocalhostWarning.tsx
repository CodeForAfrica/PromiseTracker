import {
  Alert,
  Card,
  CardContent,
  Container,
  Divider,
  Link,
  Typography,
} from "@mui/material";
import { TenantList, getTenantLinks } from "./TenantList";

export const LocalhostWarning = async () => {
  const tenantLinks = await getTenantLinks();
  return (
    <Container>
      <Alert severity="warning">
        Warning: Localhost does not work properly with subdomains
      </Alert>
      <Divider />
      <Typography>
        Please use{" "}
        <b>
          <Link href="http://localtest.me:3000">
            <i>localtest.me</i>
          </Link>
        </b>{" "}
        instead. This domain points to 127.0.0.1 and supports subdomains.
      </Typography>
      <Divider />
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
          dense
          title="Tenant shortcuts"
          subtitle="Open a tenant directly using localtest.me subdomains."
        />
      )}
    </Container>
  );
};
