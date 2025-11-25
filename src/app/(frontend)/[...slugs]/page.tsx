import React, { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  getGlobalPayload,
  queryGlobalPageBySlug,
  queryPageBySlug,
} from "@/lib/payload";
import { getDomain } from "@/lib/domain";
import { BlockRenderer } from "@/components/BlockRenderer";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { getTenantBySubDomain, getTenantNavigation } from "@/lib/data/tenants";
import { getPoliticalEntitiesByTenant } from "@/lib/data/politicalEntities";
import {
  buildSeoMetadata,
  composeTitleSegments,
  getEntitySeo,
  getPageSeo,
  resolveTenantSeoContext,
} from "@/lib/seo";
import { resolveTenantLocale } from "@/utils/locales";
import { resolveBrowserLocale } from "../layout";
import type { EntityPage } from "@/payload-types";
import type { MenuLink } from "@/types/navigation";

type Args = {
  params: Promise<{
    slugs?: string[];
  }>;
};

type EntityNavMenu = NonNullable<
  NonNullable<EntityPage["primaryNavigation"]>["menus"]
>[number];

const toMenuLink = (
  menu?: EntityNavMenu | EntityNavMenu["link"] | null | undefined
): MenuLink | null => {
  if (!menu) return null;
  const link = "link" in menu ? menu.link : menu;
  if (!link?.label) return null;

  const refValue = link.reference?.value;
  let normalizedRef: MenuLink["reference"] = null;
  if (refValue !== undefined && refValue !== null) {
    if (typeof refValue === "string" || typeof refValue === "number") {
      normalizedRef = {
        relationTo: link.reference?.relationTo ?? "pages",
        value: refValue,
      } as MenuLink["reference"];
    } else if ("slug" in refValue) {
      normalizedRef = {
        relationTo: link.reference?.relationTo ?? "pages",
        value: { slug: refValue.slug as string },
      } as MenuLink["reference"];
    }
  }

  return {
    label: link.label,
    newTab: link.newTab ?? null,
    type: link.type ?? null,
    url: link.url ?? null,
    reference: normalizedRef,
  };
};

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const paramsValue = await params;
  const slugs = paramsValue?.slugs ?? [];
  const pageSlug = slugs[0] ?? "index";

  const { subdomain } = await getDomain();
  const tenantResolution = await resolveTenantSeoContext(subdomain);

  if (tenantResolution.status === "missing") {
    const locale = await resolveBrowserLocale();
    const globalPage = await queryGlobalPageBySlug({ slug: pageSlug, locale });

    if (!globalPage) {
      return tenantResolution.metadata;
    }

    return buildSeoMetadata({
      defaults: {
        ...tenantResolution.defaultSeo,
        title: globalPage.title || tenantResolution.defaultSeo.title,
      },
    });
  }

  const { tenant, tenantSettings, tenantSeo, tenantTitleBase } =
    tenantResolution.context;
  const tenantLocale = resolveTenantLocale(tenant);

  const politicalEntities = await getPoliticalEntitiesByTenant(
    tenant,
    tenantLocale
  );
  const [maybePoliticalEntitySlug, pageSlugCandidate] = slugs;
  const politicalEntity = politicalEntities.find(
    (entity) => entity.slug === maybePoliticalEntitySlug
  );

  if (!politicalEntity) {
    const hasExplicitPageSlug =
      Boolean(pageSlugCandidate) || Boolean(maybePoliticalEntitySlug);

    if (!hasExplicitPageSlug) {
      return buildSeoMetadata({
        meta: tenantSettings?.meta,
        defaults: tenantSeo,
      });
    }

    const fallbackPageSlug =
      pageSlugCandidate ?? maybePoliticalEntitySlug ?? "index";
    const tenantPage = await queryPageBySlug({
      slug: fallbackPageSlug,
      tenant,
      locale: tenantLocale,
    });

    if (tenantPage) {
      return buildSeoMetadata({
        meta: tenantPage.meta,
        defaults: {
          ...tenantSeo,
          title: tenantPage.title || tenantSeo.title,
        },
      });
    }

    const globalPage = await queryGlobalPageBySlug({
      slug: fallbackPageSlug,
      locale: tenantLocale,
    });

    if (globalPage) {
      return buildSeoMetadata({
        meta: globalPage.meta,
        defaults: {
          ...tenantSeo,
          title: globalPage.title || tenantSeo.title,
        },
      });
    }

    return buildSeoMetadata({
      meta: tenantSettings?.meta,
      defaults: tenantSeo,
    });
  }

  const { seo: entitySeo, positionRegion } = getEntitySeo({
    entity: politicalEntity,
    tenant,
    tenantSeo,
    tenantTitleBase,
  });

  const tenantPageSlug = pageSlugCandidate ?? "index";
  const page = await queryPageBySlug({
    slug: tenantPageSlug,
    tenant,
    locale: tenantLocale,
  });

  if (!page) {
    const globalPage = await queryGlobalPageBySlug({
      slug: tenantPageSlug,
      locale: tenantLocale,
    });

    if (globalPage) {
      return buildSeoMetadata({
        defaults: {
          ...entitySeo,
          title:
            composeTitleSegments(globalPage.title, politicalEntity.name) ||
            entitySeo.title,
        },
      });
    }

    return buildSeoMetadata({
      meta: politicalEntity.meta,
      defaults: entitySeo,
    });
  }

  const { defaults: pageSeoDefaults, meta: pageSeoMeta } = getPageSeo({
    page,
    entity: politicalEntity,
    tenantSeo,
    entitySeo,
    positionRegion,
  });

  return buildSeoMetadata({
    meta: pageSeoMeta ?? page.meta,
    defaults: pageSeoDefaults,
  });
}

export default async function Page(params: Args) {
  const { subdomain, tenantSelectionHref } = await getDomain();

  const tenant = await getTenantBySubDomain(subdomain);
  const locale = tenant
    ? resolveTenantLocale(tenant)
    : await resolveBrowserLocale();

  const { title, description, navigation, footer } = await getTenantNavigation(
    tenant,
    locale
  );

  const paramsValue = await params.params;
  const slugs = paramsValue?.slugs ?? [];

  if (!tenant) {
    const pageSlug = slugs[0] ?? "index";
    const globalPage = await queryGlobalPageBySlug({ slug: pageSlug, locale });

    if (!globalPage) {
      return notFound();
    }

    return (
      <>
        <Navigation
          title={title}
          {...navigation}
          tenantSelectionHref={tenantSelectionHref}
          showSearch={false}
        />
        <Suspense>
          <BlockRenderer blocks={globalPage.blocks} />
        </Suspense>
        <Footer title={title} description={description} {...footer} />
      </>
    );
  }

  const [maybePoliticalEntitySlug, pageSlugCandidate] = slugs;

  const politicalEntities = await getPoliticalEntitiesByTenant(tenant, locale);

  const politicalEntity = politicalEntities.find(
    (entity) => entity.slug === maybePoliticalEntitySlug
  );
  const payload = await getGlobalPayload();

  if (!politicalEntity) {
    const hasExplicitPageSlug =
      Boolean(pageSlugCandidate) || Boolean(maybePoliticalEntitySlug);

    if (!hasExplicitPageSlug) {
      const entityPageSettings = await payload.findGlobal({
        slug: "entity-page",
        locale,
      });
      const entityBlocks = entityPageSettings?.entitySelector?.blocks ?? [];

      const entityNavMenus =
        (entityPageSettings?.primaryNavigation?.menus || [])
          .map((m) => toMenuLink(m?.link ?? m))
          .filter((x: MenuLink | null): x is MenuLink => Boolean(x)) || [];

      const entitySecondaryNavColumns =
        (entityPageSettings?.secondaryNavigationList || [])
          .map((entry) => {
            const menus = entry?.secondaryNavigation?.menus || [];
            const links = menus
              .map((m) => toMenuLink(m?.link ?? m))
              .filter((x: MenuLink | null): x is MenuLink => Boolean(x));
            if (!entry?.secondaryNavigation?.titles && links.length === 0) {
              return null;
            }
            return {
              title: entry?.secondaryNavigation?.titles || null,
              links,
            };
          })
          .filter((col): col is { title: string | null; links: MenuLink[] } =>
            Boolean(col)
          ) || [];

      const navigationForEntity = { ...navigation, menus: entityNavMenus };

      const footerForTenant =
        entitySecondaryNavColumns.length > 0
          ? { ...footer, secondaryNavColumns: entitySecondaryNavColumns }
          : footer;

      return (
        <>
          <Navigation
            title={title}
            {...navigationForEntity}
            tenantSelectionHref={tenantSelectionHref}
          />
          <Suspense>
            <BlockRenderer blocks={entityBlocks} />
          </Suspense>
          <Footer title={title} description={description} {...footerForTenant} />
        </>
      );
    }

    const fallbackPageSlug =
      pageSlugCandidate ?? maybePoliticalEntitySlug ?? "index";

    const tenantPage = await queryPageBySlug({
      slug: fallbackPageSlug,
      tenant,
      locale,
    });

    if (tenantPage) {
      return (
        <>
          <Navigation
            title={title}
            {...navigation}
            tenantName={tenant?.name ?? null}
            tenantSelectionHref={tenantSelectionHref}
            tenantFlag={tenant?.flag ?? null}
            tenantFlagLabel={tenant?.name ?? tenant?.country ?? null}
          />
          <Suspense>
            <BlockRenderer blocks={tenantPage.blocks} />
          </Suspense>
          <Footer title={title} description={description} {...footer} />
        </>
      );
    }

    const globalPage = await queryGlobalPageBySlug({
      slug: fallbackPageSlug,
      locale,
    });

    if (globalPage) {
      return (
        <>
          <Navigation
            title={title}
            {...navigation}
            tenantName={tenant?.name ?? null}
            tenantSelectionHref={tenantSelectionHref}
            tenantFlag={tenant?.flag ?? null}
            tenantFlagLabel={tenant?.name ?? tenant?.country ?? null}
          />
          <Suspense>
            <BlockRenderer blocks={globalPage.blocks} />
          </Suspense>
          <Footer title={title} description={description} {...footer} />
        </>
      );
    }

    const entityPageSettings = await payload.findGlobal({
      slug: "entity-page",
      locale,
    });
    const entityBlocks = entityPageSettings?.entitySelector?.blocks ?? [];

    const entityNavMenus =
      (entityPageSettings?.primaryNavigation?.menus || [])
        .map((m) => toMenuLink(m?.link ?? m))
        .filter((x: MenuLink | null): x is MenuLink => Boolean(x)) || [];

    const entitySecondaryNavColumns =
      (entityPageSettings?.secondaryNavigationList || [])
        .map((entry) => {
          const menus = entry?.secondaryNavigation?.menus || [];
          const links = menus
            .map((m) => toMenuLink(m?.link ?? m))
            .filter((x: MenuLink | null): x is MenuLink => Boolean(x));
          if (!entry?.secondaryNavigation?.titles && links.length === 0) {
            return null;
          }
          return {
            title: entry?.secondaryNavigation?.titles || null,
            links,
          };
        })
        .filter((col): col is { title: string | null; links: MenuLink[] } =>
          Boolean(col)
        ) || [];

    const navigationForEntity = { ...navigation, menus: entityNavMenus };

    const footerForTenant =
      entitySecondaryNavColumns.length > 0
        ? { ...footer, secondaryNavColumns: entitySecondaryNavColumns }
        : footer;

    return (
      <>
        <Navigation
          title={title}
          {...navigationForEntity}
          tenantSelectionHref={tenantSelectionHref}
        />
        <Suspense>
          <BlockRenderer blocks={entityBlocks} />
        </Suspense>
        <Footer title={title} description={description} {...footerForTenant} />
      </>
    );
  }

  const tenantPageSlug = pageSlugCandidate ?? "index";

  const page = await queryPageBySlug({
    slug: tenantPageSlug,
    tenant,
    locale,
  });

  if (!page) {
    const globalPage = await queryGlobalPageBySlug({
      slug: tenantPageSlug,
      locale,
    });
    if (!globalPage) {
      return notFound();
    }

    return (
      <>
        <Navigation
          title={title}
          {...navigation}
          entitySlug={politicalEntity.slug}
          tenantName={tenant?.name ?? null}
          tenantSelectionHref={tenantSelectionHref}
          tenantFlag={tenant?.flag ?? null}
          tenantFlagLabel={tenant?.name ?? tenant?.country ?? null}
        />
        <Suspense>
          <BlockRenderer blocks={globalPage.blocks} entity={politicalEntity} />
        </Suspense>
        <Footer
          title={title}
          description={description}
          {...footer}
          entitySlug={politicalEntity.slug}
        />
      </>
    );
  }

  const { blocks } = page;
  return (
    <>
      <Navigation
        title={title}
        {...navigation}
        entitySlug={politicalEntity.slug}
        tenantName={tenant?.name ?? null}
        tenantSelectionHref={tenantSelectionHref}
        tenantFlag={tenant?.flag ?? null}
        tenantFlagLabel={tenant?.name ?? tenant?.country ?? null}
      />
      <Suspense>
        <BlockRenderer blocks={blocks} entity={politicalEntity} />
      </Suspense>
      <Footer
        title={title}
        description={description}
        {...footer}
        entitySlug={politicalEntity.slug}
      />
    </>
  );
}
