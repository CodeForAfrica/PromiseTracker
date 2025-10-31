import React, { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getGlobalPayload, queryPageBySlug } from "@/lib/payload";
import { getDomain } from "@/lib/domain";
import { CommonHomePage } from "@/components/CommonHomePage";
import { BlockRenderer } from "@/components/BlockRenderer";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { getTenantBySubDomain, getTenantNavigation } from "@/lib/data/tenants";
import { getPoliticalEntitiesByTenant } from "@/lib/data/politicalEntities";
import {
  buildSeoMetadata,
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

  const { subdomain } = await getDomain();
  const tenantResolution = await resolveTenantSeoContext(subdomain);

  if (tenantResolution.status === "missing") {
    return tenantResolution.metadata;
  }

  const { tenant, tenantSettings, tenantSeo, tenantTitleBase } =
    tenantResolution.context;

  const politicalEntities = await getPoliticalEntitiesByTenant(tenant);
  const [maybePoliticalEntitySlug, pageSlugCandidate] = slugs;
  const politicalEntity = politicalEntities.find(
    (entity) => entity.slug === maybePoliticalEntitySlug,
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

  const pageSlug = pageSlugCandidate ?? "index";
  const page = await queryPageBySlug({ slug: pageSlug, tenant });

  if (!page) {
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

  if (!tenant) {
    return (
      <>
        <Navigation
          title={title}
          {...navigation}
          tenantSelectionHref={tenantSelectionHref}
        />
        <CommonHomePage />
        <Footer title={title} description={description} {...footer} />
      </>
    );
  }

  const paramsValue = await params.params;
  const slugs = paramsValue?.slugs ?? [];
  const [maybePoliticalEntitySlug, pageSlugCandidate] = slugs;

  const politicalEntities = await getPoliticalEntitiesByTenant(tenant);

  const politicalEntity = politicalEntities.find(
    (entity) => entity.slug === maybePoliticalEntitySlug,
  );

  if (!politicalEntity) {
    if (politicalEntities.length === 1) {
      const [onlyEntity] = politicalEntities;
      if (onlyEntity) {
        const fallbackPageSlugs = slugs.length > 0 ? slugs : ["index"];
        const sanitizedPageSlugs = fallbackPageSlugs.filter(
          (slug) => slug && slug !== "index",
        );
        const segments = [onlyEntity.slug, ...sanitizedPageSlugs].filter(
          Boolean,
        );
        const targetPath = segments.length > 0 ? `/${segments.join("/")}` : "/";
        redirect(targetPath);
      }
    }
    const fallbackPageSlugs = slugs.length > 0 ? slugs : ["index"];
    const payload = await getGlobalPayload();
    const homePage = await payload.findGlobal({
      slug: "home-page",
    });
    const entityBlocks = (homePage?.entitySelector?.blocks ?? []).map(
      (block) =>
        block.blockType === "entity-selection"
          ? { ...block, pageSlugs: fallbackPageSlugs }
          : block,
    );

    return (
      <>
        <Navigation
          title={title}
          {...navigation}
          tenantSelectionHref={tenantSelectionHref}
        />
        <BlockRenderer blocks={entityBlocks} />
        <Footer title={title} description={description} {...footer} />
      </>
    );
  }

  const pageSlug = pageSlugCandidate ?? "index";

  const page = await queryPageBySlug({ slug: pageSlug, tenant });

  if (!page) {
    return notFound();
  }

  const { blocks } = page;
  return (
    <>
      <Navigation
        title={title}
        {...navigation}
        entitySlug={politicalEntity.slug}
        tenantSelectionHref={tenantSelectionHref}
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
