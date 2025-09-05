import { getGlobalPayload } from "@/lib/payload";
import { getDomain } from "@/lib/domain";
import { Card, List, ListItem, Link, Typography } from "@mui/material";

export const TenantList = async () => {
  const payload = await getGlobalPayload();
  const { port } = await getDomain();

  const { docs: tenants } = await payload.find({
    collection: "tenants",
    limit: -1,
  });

  return (
    <Card variant="outlined">
      <Typography variant="h2">Available Tenants</Typography>
      <List>
        {tenants.map((t) => (
          <ListItem key={t.id}>
            <Link
              href={`http://${t.country?.toLowerCase()}.localtest.me${port}`}
            >{`http://${t.country?.toLowerCase()}.localtest.me${port}`}</Link>
          </ListItem>
        ))}
      </List>
    </Card>
  );
};
