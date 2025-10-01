import { Box, Container } from "@mui/material";
import { BlockRenderer } from "./BlockRenderer";
import { getGlobalPayload } from "@/lib/payload";
import type { HomePage } from "@/payload-types";

export const CommonHomePage = async () => {
  const payload = await getGlobalPayload();
  const homePage = await payload.findGlobal({
    slug: "home-page",
  });

  const tenantBlocks = homePage?.tenantSelector?.blocks ?? [];

  return (
    <Box component="main" sx={{ bgcolor: "background.default" }}>
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <BlockRenderer blocks={tenantBlocks} />
      </Container>
    </Box>
  );
};
