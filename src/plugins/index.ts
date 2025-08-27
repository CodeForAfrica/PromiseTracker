import { Plugin } from 'payload'
import { sentryPlugin } from '@payloadcms/plugin-sentry'
import * as Sentry from '@sentry/nextjs'
export const plugins: Plugin[] = [sentryPlugin({ Sentry })]
