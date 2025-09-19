import React, { Suspense } from "react";

import { queryPageBySlug } from "@/lib/payload";
import { notFound } from "next/navigation";
import { getDomain } from "@/lib/domain";
import { CommonHomePage } from "@/components/CommonHomePage";
import { BlockRenderer } from "@/components/BlockRenderer";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { PoliticalEntityList } from "@/components/PoliticalEntityList";
import { getTenantBySubDomain, getTenantNavigation } from "@/lib/data/tenants";
import {
  getPoliticalEntitiesByTenant,
  getExtractionCountsForEntities,
} from "@/lib/data/politicalEntities";

type Args = {
  params: Promise<{
    slugs?: string[];
  }>;
};

export default async function Page(params: Args) {
  const { subdomain } = await getDomain();

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
    const fallbackPageSlugs = slugs.length > 0 ? slugs : ["index"];
    const extractionCounts = await getExtractionCountsForEntities(
      politicalEntities.map((entity) => entity.id)
    );

    return (
      <>
        <Navigation title={title} {...navigation} />
        <PoliticalEntityList
          tenant={tenant}
          politicalEntities={politicalEntities}
          pageSlugs={fallbackPageSlugs}
          extractionCounts={extractionCounts}
        />
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
