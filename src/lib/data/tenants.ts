import { getGlobalPayload } from "@/lib/payload";
import { Tenant } from "node_modules/@payloadcms/plugin-multi-tenant/dist/types";
import type {
  Logo,
  MenuLink,
  SecondaryNavColumn,
  LegalLinks,
} from "@/types/navigation";
import type { Media, Page } from "@/payload-types";

const payload = await getGlobalPayload();

export const getAllTenants = async () => {
  const { docs } = await payload.find({
    collection: "tenants",
    limit: -1,
  });

  return docs;
};

export const getTenantBySubDomain = async (subdomain: string | null) => {
  const tenants = await getAllTenants();

  const tenant = tenants.find(
    (t) => t.country?.toLocaleLowerCase() === subdomain?.toLocaleLowerCase()
  );

  return tenant;
};

export const getTenantSiteSettings = async (tenant: Tenant) => {
  const { docs } = await payload.find({
    collection: "site-settings",
    where: {
      tenant: {
        equals: tenant,
      },
    },
    depth: 2,
  });

  return docs[0];
};

export const getTenantNavigation = async (tenant: Tenant) => {
  const tenantSettings = await getTenantSiteSettings(tenant);

  const {
    title,
    description,
    primaryLogo,
    secondaryLogo,
    alternateLogo,
    primaryNavigation,
    secondaryNavigationList,
    connect,
    legal,
  } = tenantSettings;

  const toLogo = (m: string | Media): Logo => {
    if (!m || typeof m === "string") return { url: null, alt: "Logo" };
    return { url: m.url || null, alt: m.alt || "Logo" };
  };

  const toRefValue = (value: string | Page | number | undefined) => {
    if (!value) return null;
    if (typeof value === "string" || typeof value === "number") return value;
    return { slug: value.slug };
  };

  const toMenuLink = (link?: any): MenuLink | null => {
    if (!link || !link.label) return null;
    const res: MenuLink = {
      label: link.label,
      newTab: link.newTab ?? null,
      type: link.type ?? null,
      url: link.url ?? null,
      reference: link.reference
        ? {
            relationTo: link.reference.relationTo,
            value: toRefValue(link.reference.value) as any,
          }
        : null,
    };
    return res;
  };

  const navMenus: MenuLink[] = (primaryNavigation?.menus || [])
    .map((m) => toMenuLink(m.link))
    .filter((x): x is MenuLink => Boolean(x));

  const secondaryNavColumns: SecondaryNavColumn[] = (
    secondaryNavigationList || []
  )
    .map((entry) => {
      const group = entry?.secondaryNavigation;
      const links: MenuLink[] = (group?.menus || [])
        .map((m) => toMenuLink(m.link))
        .filter((x): x is MenuLink => Boolean(x));
      return { title: group?.titles || null, links };
    })
    .filter((col) => col.title || col.links.length > 0);

  const legalLinks: LegalLinks = {
    copyright: legal?.copyright || title || "PromiseTracker",
    links: (legal?.links || [])
      .map((l) => toMenuLink(l.link))
      .filter((x): x is MenuLink => Boolean(x)),
  };

  return {
    title,
    description,
    navigation: {
      primaryLogo: toLogo(primaryLogo),
      menus: navMenus,
    },
    footer: {
      secondaryLogo: toLogo(secondaryLogo),
      alternateLogo: toLogo(alternateLogo),
      secondaryNavColumns,
      connect,
      legal: legalLinks,
    },
  } as const;
};
