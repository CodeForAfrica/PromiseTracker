import { CollectionConfig } from 'payload'
import { Users } from './Users'
import { Media } from './Media'
import { Documents } from './Documents'
import { AIExtractions } from './Extractions'
import { Tenants } from './Tenant'
import { Pages } from './Pages'
import { SiteSettings } from './SiteSettings'

export const collections: CollectionConfig[] = [
  Documents,
  AIExtractions,
  Media,
  Pages,
  Users,
  SiteSettings,
  Tenants,
]
