import { GlobalConfig } from "payload";
import { Settings } from "./Settings";
import { PromiseUpdates } from "./PromiseUpdates";
import { EntityPage } from "./EntityPage";
import { GlobalSiteSettings } from "./GlobalSettings";

export const globals: GlobalConfig[] = [
  EntityPage,
  Settings,
  PromiseUpdates,
  GlobalSiteSettings,
];
