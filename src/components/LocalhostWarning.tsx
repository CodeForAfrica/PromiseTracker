import { Alert, Divider, Link, Typography } from "@mui/material";
import { TenantList } from "./TenantList";
import Section from "./Section";

export const LocalhostWarning = async () => {
  return (
    <Section>
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
      <Typography>
        You can also visit individual tenants listed below
      </Typography>
      <TenantList />
    </Section>
  );
};
