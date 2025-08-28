import { GlobalConfig } from 'payload'

export const Settings: GlobalConfig = {
  slug: 'settings',
  label: {
    en: 'Settings',
    fr: 'Paramètres',
  },
  admin: {
    group: {
      en: 'Settings',
      fr: 'Paramètres',
    },
  },
  fields: [
    {
      type: 'tabs',
      label: {
        en: 'Airtable',
        fr: 'Airtable',
      },
      tabs: [
        {
          label: {
            en: 'Airtable',
            fr: 'Airtable',
          },
          fields: [
            {
              name: 'airtable',
              type: 'group',
              label: '',
              admin: {
                hideGutter: true,
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'airtableAPIKey',
                      label: {
                        en: 'Airtable API Key',
                        fr: 'Clé API Airtable',
                      },
                      type: 'text',
                      required: true,
                    },
                    {
                      name: 'airtableBaseID',
                      label: {
                        en: 'Airtable Base ID',
                        fr: 'ID de Base Airtable',
                      },
                      type: 'text',
                      required: true,
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: {
            en: 'Generative AI',
            fr: 'IA Générative',
          },
          fields: [
            {
              name: 'ai',
              type: 'group',
              label: '',
              admin: {
                hideGutter: true,
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      //TODO: (@kelvinkipruto):(@kelvinkipruto): Explore adding more models.
                      name: 'model',
                      type: 'select',
                      label: {
                        en: 'Model',
                        fr: 'Modèle',
                      },
                      options: [
                        {
                          value: 'gemini-2.5-pro',
                          label: 'Gemini 2.5 Pro',
                        },
                      ],
                      required: true,
                    },
                    {
                      name: 'apiKey',
                      label: {
                        en: 'API Key',
                        fr: 'Clé API',
                      },
                      type: 'text',
                      required: true,
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: {
            en: 'Meedan',
            fr: 'Meedan',
          },
          fields: [
            {
              name: 'meedan',
              type: 'group',
              label: {
                en: 'Meedan Settings',
                fr: 'Paramètres Meedan',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'meedanAPIKey',
                      type: 'text',
                      required: true,
                      label: {
                        en: 'Meedan API Key',
                        fr: 'Clé API Meedan',
                      },
                    },
                    {
                      name: 'teamId',
                      type: 'text',
                      required: true,
                      label: {
                        en: 'Team ID',
                        fr: "ID d'Équipe",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
