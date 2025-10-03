import type { Metadata } from "next";
import { resolveMedia } from "@/lib/data/media";
import type {
  Media,
  SiteSetting,
  PoliticalEntity,
  Page as PayloadPage,
  Tenant,
} from "@/payload-types";
import { convertLexicalToPlaintext } from "@payloadcms/richtext-lexical/plaintext";
import { capitalizeFirstLetter } from "@/utils/utils";
import {
  getTenantBySubDomain,
  getTenantSiteSettings,
} from "@/lib/data/tenants";

const clean = (value?: string | null): string => (value ?? "").trim();

const formatSegment = (value?: string | null): string => {
  const text = clean(value);
  return text ? capitalizeFirstLetter(text) : "";
};

export const composeTitleSegments = (
  ...segments: (string | null | undefined)[]
): string => {
  const formatted = segments
    .map((segment) => formatSegment(segment))
    .filter((segment) => segment.length > 0);
  return formatted.join(" | ");
};

type NullableSeo = {
  title?: string | null;
  description?: string | null;
  image?: (string | null) | Media;
};

type SeoContent = {
  title: string;
  description: string;
  image?: (string | null) | Media;
};

export const buildSeoMetadata = async ({
  meta,
  defaults,
}: {
  meta?: NullableSeo;
  defaults: SeoContent;
}): Promise<Metadata> => {
  const title = formatSegment(meta?.title) || defaults.title;
  const description = clean(meta?.description) || defaults.description;

  const image = await (meta?.image
    ? resolveMedia(meta.image)
    : defaults.image
    ? resolveMedia(defaults.image)
    : Promise.resolve(null));

  const metadata: Metadata = {};

  if (title) {
    metadata.title = title;
  }

  if (description) {
    metadata.description = description;
  }

  if (title || description || image) {
    metadata.openGraph = {
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(image
        ? {
            images: [
              {
                url: image.url,
                alt: image.alt || title || undefined,
              },
            ],
          }
        : {}),
    };

    metadata.twitter = {
      card: image ? "summary_large_image" : "summary",
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(image ? { images: [image.url] } : {}),
    };
  }

  return metadata;
};

export const getDefaultSeo = (): SeoContent => ({
  title: "PromiseTracker",
  description: "PromiseTracker",
});

export const getTenantSeo = ({
  tenant,
  settings,
  defaultSeo = getDefaultSeo(),
}: {
  tenant?: Tenant | null;
  settings?: SiteSetting | null;
  defaultSeo?: SeoContent;
}): { seo: SeoContent; titleBase: string } => {
  const baseTitle =
    formatSegment(settings?.title) ||
    formatSegment(settings?.meta?.title) ||
    formatSegment(tenant?.name);

  const shouldAppendPromiseTracker =
    baseTitle && !baseTitle.toLowerCase().includes("promisetracker");

  const title =
    composeTitleSegments(
      baseTitle || undefined,
      shouldAppendPromiseTracker ? "PromiseTracker" : undefined,
    ) || defaultSeo.title;

  let description = clean(settings?.meta?.description);

  if (!description && settings?.description) {
    try {
      description = clean(convertLexicalToPlaintext({ data: settings.description }));
    } catch (error) {
      description = clean(String(settings.description));
    }
  }

  if (!description) {
    description = defaultSeo.description;
  }

  const image = settings?.meta?.image ?? defaultSeo.image;

  return {
    seo: {
      title,
      description,
      image,
    },
    titleBase: baseTitle,
  };
};

export const getEntitySeo = ({
  entity,
  tenant,
  tenantSeo,
  tenantTitleBase,
}: {
  entity: PoliticalEntity;
  tenant?: Tenant | null;
  tenantSeo: SeoContent;
  tenantTitleBase: string;
}): { seo: SeoContent; positionRegion: string } => {
  const name = formatSegment(entity.name);
  const position = formatSegment(entity.position);
  const region = formatSegment(entity.region) || formatSegment(tenant?.name);
  const positionRegion = [position, region].filter(Boolean).join(" ").trim();
  const metaTitle = formatSegment(entity.meta?.title);

  const title =
    metaTitle || composeTitleSegments(name, positionRegion, tenantTitleBase) || tenantSeo.title;
  const description = clean(entity.meta?.description) || tenantSeo.description;
  const image = entity.meta?.image ?? tenantSeo.image;

  return {
    seo: {
      title,
      description,
      image,
    },
    positionRegion,
  };
};

export const getPageSeo = ({
  page,
  entity,
  tenantSeo,
  entitySeo,
  positionRegion,
}: {
  page: PayloadPage;
  entity: PoliticalEntity;
  tenantSeo: SeoContent;
  entitySeo: SeoContent;
  positionRegion: string;
}): { defaults: SeoContent; meta?: NullableSeo } => {
  const role = positionRegion;
  const metaTitle = formatSegment(page.meta?.title);

  const fallbackTitle =
    composeTitleSegments(page.title, entity.name, role) ||
    entitySeo.title ||
    tenantSeo.title;

  const defaults: SeoContent = {
    title: fallbackTitle,
    description: entitySeo.description || tenantSeo.description,
    image: entitySeo.image ?? tenantSeo.image,
  };

  if (!metaTitle) {
    return { defaults };
  }

  const meta: NullableSeo = {
    title: composeTitleSegments(page.meta?.title, entity.name, role) || page.meta?.title,
    description: page.meta?.description,
    image: page.meta?.image,
  };

  return { defaults, meta };
};

export type TenantSeoContext = {
  tenant: Tenant;
  tenantSettings: SiteSetting | null;
  tenantSeo: SeoContent;
  tenantTitleBase: string;
  defaultSeo: SeoContent;
};

export type TenantSeoResolution =
  | { status: "missing"; metadata: Metadata; defaultSeo: SeoContent }
  | { status: "resolved"; context: TenantSeoContext };

export const resolveTenantSeoContext = async (
  subdomain: string | null,
): Promise<TenantSeoResolution> => {
  const defaultSeo = getDefaultSeo();
  const tenant = await getTenantBySubDomain(subdomain);

  if (!tenant) {
    const metadata = await buildSeoMetadata({ defaults: defaultSeo });
    return { status: "missing", metadata, defaultSeo };
  }

  const tenantSettings = await getTenantSiteSettings(tenant);
  const { seo: tenantSeo, titleBase: tenantTitleBase } = getTenantSeo({
    tenant,
    settings: tenantSettings,
    defaultSeo,
  });

  return {
    status: "resolved",
    context: {
      tenant,
      tenantSettings,
      tenantSeo,
      tenantTitleBase,
      defaultSeo,
    },
  };
};
