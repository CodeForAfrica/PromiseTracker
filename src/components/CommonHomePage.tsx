import { Container } from "@mui/material";
import { TenantList } from "./TenantList";
import Section from "./Section";

// TODO: (@kelvinkipruto): This should be configured from Payload
export const CommonHomePage = async () => {
  return (
    <Section>
      <TenantList />
    </Section>
  );
};
