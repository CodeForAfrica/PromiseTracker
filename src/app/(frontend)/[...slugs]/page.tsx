import React, { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

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

type Args = {
  params: Promise<{
    slugs?: string[];
  }>;
};

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const paramsValue = await params;
  const slugs = paramsValue?.slugs ?? [];
  const pageSlug = slugs[0] ?? "index";

  const { subdomain } = await getDomain();
  const tenantResolution = await resolveTenantSeoContext(subdomain);

  if (tenantResolution.status === "missing") {
    const globalPage = await queryGlobalPageBySlug({ slug: pageSlug });

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

  const politicalEntities = await getPoliticalEntitiesByTenant(tenant);
  const [maybePoliticalEntitySlug, pageSlugCandidate] = slugs;
  const politicalEntity = politicalEntities.find(
    (entity) => entity.slug === maybePoliticalEntitySlug
  );

  if (!politicalEntity) {
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
  const page = await queryPageBySlug({ slug: tenantPageSlug, tenant });

  if (!page) {
    const globalPage = await queryGlobalPageBySlug({ slug: tenantPageSlug });

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

  const { title, description, navigation, footer } =
    await getTenantNavigation(tenant);

  const paramsValue = await params.params;
  const slugs = paramsValue?.slugs ?? [];

  if (!tenant) {
    const pageSlug = slugs[0] ?? "index";
    const globalPage = await queryGlobalPageBySlug({ slug: pageSlug });

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
      </>
    );
  }

  const [maybePoliticalEntitySlug, pageSlugCandidate] = slugs;

  const politicalEntities = await getPoliticalEntitiesByTenant(tenant);

  const politicalEntity = politicalEntities.find(
    (entity) => entity.slug === maybePoliticalEntitySlug
  );

  if (!politicalEntity) {
    if (politicalEntities.length === 1) {
      const [onlyEntity] = politicalEntities;
      if (onlyEntity) {
        const fallbackPageSlugs = slugs.length > 0 ? slugs : ["index"];
        const sanitizedPageSlugs = fallbackPageSlugs.filter(
          (slug) => slug && slug !== "index"
        );
        const segments = [onlyEntity.slug, ...sanitizedPageSlugs].filter(
          Boolean
        );
        const targetPath = segments.length > 0 ? `/${segments.join("/")}` : "/";
        redirect(targetPath);
      }
    }

    const payload = await getGlobalPayload();
    const homePage = await payload.findGlobal({
      slug: "home-page",
    });
    const entityBlocks = homePage?.entitySelector?.blocks ?? [];

    return (
      <>
        <Navigation
          title={title}
          {...navigation}
          tenantSelectionHref={tenantSelectionHref}
        />
        <Suspense>
          <BlockRenderer blocks={entityBlocks} />
        </Suspense>
        <Footer title={title} description={description} {...footer} />
      </>
    );
  }

  const tenantPageSlug = pageSlugCandidate ?? "index";

  const page = await queryPageBySlug({ slug: tenantPageSlug, tenant });

  if (!page) {
    const globalPage = await queryGlobalPageBySlug({ slug: tenantPageSlug });
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
