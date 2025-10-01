import React, { Suspense } from "react";

import { getGlobalPayload, queryPageBySlug } from "@/lib/payload";
import { notFound, redirect } from "next/navigation";
import { getDomain } from "@/lib/domain";
import { CommonHomePage } from "@/components/CommonHomePage";
import { BlockRenderer } from "@/components/BlockRenderer";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { getTenantBySubDomain, getTenantNavigation } from "@/lib/data/tenants";
import { getPoliticalEntitiesByTenant } from "@/lib/data/politicalEntities";

type Args = {
  params: Promise<{
    slugs?: string[];
  }>;
};

export default async function Page(params: Args) {
  const { subdomain, tenantSelectionHref } = await getDomain();

  const tenant = await getTenantBySubDomain(subdomain);

  if (!tenant) {
    return <CommonHomePage />;
  }

  const { title, description, navigation, footer } =
    await getTenantNavigation(tenant);

  const paramsValue = await params.params;
  const slugs = paramsValue?.slugs ?? [];
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
    const fallbackPageSlugs = slugs.length > 0 ? slugs : ["index"];
    const payload = await getGlobalPayload();
    const homePage = await payload.findGlobal({
      slug: "home-page",
    });
    const entityBlocks = (homePage?.entitySelector?.blocks ?? []).map(
      (block) =>
        block.blockType === "entity-selection"
          ? { ...block, pageSlugs: fallbackPageSlugs }
          : block
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
