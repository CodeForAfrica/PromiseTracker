import { TestBlock } from '@/blocks/TestBlock'
import { CollectionConfig } from 'payload'
import { ensureUniqueSlug } from './hooks/ensureUniqueSlug'
import { OtherBlock } from '@/blocks/OtherBlock'

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    group: { en: 'Publication', fr: 'Publication' },
    defaultColumns: ['title', 'slug', 'tenant'],
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      admin: {
        position: 'sidebar',
      },
      index: true,
      hooks: {
        beforeValidate: [ensureUniqueSlug],
      },
    },
    {
      name: 'blocks',
      type: 'blocks',
      blocks: [TestBlock, OtherBlock],
    },
  ],
}
