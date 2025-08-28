import React, { Suspense } from 'react'

import '../styles.css'
import { getGlobalPayload } from '@/lib/payload'
import { Tenant } from '@/payload-types'
import { notFound } from 'next/navigation'
import { getDomain } from '@/lib/domain'
import { LocalhostWarning } from '@/components/LocalhostWarning'
import { CommonHomePage } from '@/components/CommonHomePage'
import { BlockRenderer } from '@/components/BlockRenderer'

type Args = {
  params: Promise<{
    slugs?: string[]
  }>
}

async function getPageSlug({ params: pageParams }: Args) {
  const params = await pageParams
  // We only have 2 slugs, for the page, ['promises'] or ['promises', 'promise-1']
  //The first is the slug of the page.
  // TODO: (@kelvinkipruto): check if we may need a third page: ['promises', 'political-entity', 'promise-1']
  const pageSlugIndex = 0
  return params?.slugs?.[pageSlugIndex] || 'index'
}

export default async function Page(params: Args) {
  const payload = await getGlobalPayload()
  const { isLocalhost, subdomain } = await getDomain()

  const { docs: allTenants } = await payload.find({
    collection: 'tenants',
    limit: -1,
  })

  if (isLocalhost) {
    return <LocalhostWarning />
  }

  const tenant = allTenants.find(
    (t) => t.country?.toLocaleLowerCase() === subdomain?.toLocaleLowerCase(),
  )

  if (!tenant) {
    return <CommonHomePage />
  }

  const slug = await getPageSlug(params)

  const page = await queryPageBySlug({ slug, tenant })

  if (!page) {
    return notFound()
  }

  if (tenant) {
    const { blocks } = page
    return (
      <div className="home">
        <div className="content">
          <Suspense>
            <BlockRenderer blocks={blocks} />
          </Suspense>
        </div>
      </div>
    )
  }
}

const queryPageBySlug = async ({ slug, tenant }: { slug: string; tenant?: Tenant }) => {
  const payload = await getGlobalPayload()
  const { docs: pages } = await payload.find({
    collection: 'pages',
    pagination: false,
    limit: 1,
    where: {
      and: [
        {
          tenant: {
            equals: tenant,
          },
        },
        {
          slug: {
            equals: slug,
          },
        },
      ],
    },
  })

  return pages[0]
}
