import React, { Suspense } from "react";

import { queryPageBySlug } from "@/lib/payload";
import { notFound } from "next/navigation";
import { getDomain } from "@/lib/domain";
import { LocalhostWarning } from "@/components/LocalhostWarning";
import { CommonHomePage } from "@/components/CommonHomePage";
import { BlockRenderer } from "@/components/BlockRenderer";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { getTenantBySubDomain, getTenantNavigation } from "@/lib/data/tenants";

type Args = {
  params: Promise<{
    slugs?: string[];
  }>;
};

async function getPageSlug({ params: pageParams }: Args) {
  const params = await pageParams;
  // We only have 2 slugs, for the page, ['promises'] or ['promises', 'promise-1']
  //The first is the slug of the page.
  // TODO: (@kelvinkipruto): check if we may need a third page: ['promises', 'political-entity', 'promise-1']
  const pageSlugIndex = 0;
  return params?.slugs?.[pageSlugIndex] || "index";
}

export default async function Page(params: Args) {
  const { isLocalhost, subdomain } = await getDomain();

  if (isLocalhost) {
    return <LocalhostWarning />;
  }

  const tenant = await getTenantBySubDomain(subdomain);

  if (!tenant) {
    return <CommonHomePage />;
  }

  const slug = await getPageSlug(params);

  const page = await queryPageBySlug({ slug, tenant });

  if (!page) {
    return notFound();
  }

  const { title, description, navigation, footer } =
    await getTenantNavigation(tenant);

  const { blocks } = page;
  return (
    <>
      <Navigation title={title} {...navigation} />
      <Suspense>
        <BlockRenderer blocks={blocks} />
      </Suspense>
      <Footer title={title} description={description} {...footer} />
    </>
  );
}
