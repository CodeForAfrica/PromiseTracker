import { Page } from "@/payload-types";

export type MenuLink = {
  label: string;
  newTab?: boolean | null;
  type?: "custom" | "reference" | null;
  url?: string | null;
  reference?: {
    relationTo: "pages" | "global-pages";
    value: Page | string | number;
  } | null;
};

export type Logo = {
  url: string | null;
  alt: string;
};

export type SecondaryNavColumn = {
  title: string | null;
  links: MenuLink[];
};

export type LegalLinks = {
  copyright?: string | null;
  links: MenuLink[];
};
