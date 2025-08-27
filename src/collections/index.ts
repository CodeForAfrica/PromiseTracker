import { CollectionConfig } from 'payload'
import { Users } from './Users'
import { Media } from './Media'
import { Documents } from './Documents'
import { AIExtractions } from './Extractions'
import { Tenants } from './Tenant'

export const collections: CollectionConfig[] = [Users, Media, Documents, AIExtractions, Tenants]
