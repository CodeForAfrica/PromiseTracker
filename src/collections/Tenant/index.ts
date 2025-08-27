import { isSuperAdminAccess } from '@/access/isSuperAdmin'
import { countriesByContinent } from '@/data/countries'
import { CollectionConfig } from 'payload'
import { updateAndDeleteAccess } from './access/updateAndDelete'

const africanCountries = countriesByContinent('Africa')

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  access: {
    create: isSuperAdminAccess,
    delete: updateAndDeleteAccess,
    read: ({ req }) => Boolean(req.user),
    update: updateAndDeleteAccess,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'locale'],
  },
  labels: {
    singular: {
      en: 'Tenant',
      fr: 'Locataire',
    },
    plural: {
      en: 'Tenants',
      fr: 'Locataires',
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: {
        en: 'Name',
        fr: 'Nom',
      },
    },
    {
      name: 'locale',
      type: 'select',
      label: {
        en: 'Locale',
        fr: 'Lieu',
      },
      options: [
        {
          value: 'en',
          label: {
            en: 'English',
            fr: 'Anglais',
          },
        },
        {
          value: 'fr',
          label: {
            en: 'French',
            fr: 'Français',
          },
        },
      ],
    },
    {
      name: 'country',
      type: 'select',
      options: africanCountries,
      unique: true,
      label: {
        en: 'Country',
        fr: 'Pays',
      },
    },
  ],
}
