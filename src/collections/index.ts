import { CollectionConfig } from "payload";
import { Users } from "./Users";
import { Media } from "./Media";
import { Documents } from "./Documents";
import { AIExtractions } from "./AIExtractions";
import { Promises } from "./Promises";
import { Tenants } from "./Tenant";
import { Pages } from "./Pages";
import { SiteSettings } from "./SiteSettings";
import { Partners } from "./Partners";
import { PoliticalEntities } from "./PoliticalEntities";
import { PromiseStatus } from "./PromiseStatus";

export const collections: CollectionConfig[] = [
  Documents,
  AIExtractions,
  Promises,
  Media,
  Pages,
  Users,
  SiteSettings,
  Tenants,
  Partners,
  PoliticalEntities,
  PromiseStatus,
];
