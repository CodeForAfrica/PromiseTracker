import React, { Suspense } from "react";

import { getGlobalPayload, queryPageBySlug } from "@/lib/payload";
import { notFound } from "next/navigation";
import { getDomain } from "@/lib/domain";
import { LocalhostWarning } from "@/components/LocalhostWarning";
import { CommonHomePage } from "@/components/CommonHomePage";
import { BlockRenderer } from "@/components/BlockRenderer";

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
  const payload = await getGlobalPayload();
  const { isLocalhost, subdomain } = await getDomain();

  const { docs: allTenants } = await payload.find({
    collection: "tenants",
    limit: -1,
  });

  if (isLocalhost) {
    return <LocalhostWarning />;
  }

  const tenant = allTenants.find(
    (t) => t.country?.toLocaleLowerCase() === subdomain?.toLocaleLowerCase()
  );

  if (!tenant) {
    return <CommonHomePage />;
  }

  const slug = await getPageSlug(params);

  const page = await queryPageBySlug({ slug, tenant });

  if (!page) {
    return notFound();
  }

  const { blocks } = page;
  return (
    <>
      <Suspense>
        <BlockRenderer blocks={blocks} />
      </Suspense>
    </>
  );
}
