import { Box } from "@mui/material";
import { BlockRenderer } from "./BlockRenderer";
import { getGlobalPayload } from "@/lib/payload";

export const CommonHomePage = async () => {
  const payload = await getGlobalPayload();
  const homePage = await payload.findGlobal({
    slug: "home-page",
  });

  const tenantBlocks = homePage?.tenantSelector?.blocks ?? [];

  return (
    <Box component="main" sx={{ bgcolor: "background.default" }}>
      <BlockRenderer blocks={tenantBlocks} />
    </Box>
  );
};
