import { TenantList } from "./TenantList";
import { Box, Container } from "@mui/material";

export const CommonHomePage = async () => {
  return (
    <Box component="main" sx={{ bgcolor: "background.default" }}>
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <TenantList />
      </Container>
    </Box>
  );
};
