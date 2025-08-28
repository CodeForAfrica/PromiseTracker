import { Plugin } from 'payload'
import { sentryPlugin } from '@payloadcms/plugin-sentry'
import * as Sentry from '@sentry/nextjs'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { Config } from '@/payload-types'
import { isProd } from '@/utils/utils'
export const plugins: Plugin[] = [
  multiTenantPlugin<Config>({
    collections: {
      pages: {},
    },
    cleanupAfterTenantDelete: false,
    tenantField: {
      access: {
        read: () => true,
      },
    },
    debug: !isProd,
    userHasAccessToAllTenants: () => true,
  }),
  sentryPlugin({ Sentry }),
]
