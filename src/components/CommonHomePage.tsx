import { Container } from "@mui/material";
import { TenantList } from "./TenantList";

// TODO: (@kelvinkipruto): This should be configured from Payload
export const CommonHomePage = async () => {
  return (
    <Container>
      <TenantList />
    </Container>
  );
};
